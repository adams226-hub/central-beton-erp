const { emitToAll, emitToRole } = require('../../config/socket');
const logger = require('../../config/logger');
const prisma = require('../../config/prisma');

// Seuils d'alerte (jours de production)
const UNITES = {
  CIMENT: { unite: 'kg', label: 'Ciment' },
  SABLE: { unite: 'm³', label: 'Sable naturel' },
  GRAVIER_515: { unite: 't', label: 'Gravier 5/15' },
  GRAVIER_1525: { unite: 't', label: 'Gravier 15/25' },
  EAU: { unite: 'm³', label: 'Eau' },
  HYDROFUGE: { unite: 'L', label: 'Hydrofuge' },
  POWERFLOW: { unite: 'L', label: 'Powerflow 6425' },
  GASOIL: { unite: 'L', label: 'Gasoil' },
  AUTRE: { unite: 'u', label: 'Autre' },
};

const listerStocks = async () => {
  const stocks = await prisma.stockMatiere.findMany({
    include: {
      mouvements: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { nom: true, prenom: true } } },
      },
    },
    orderBy: { materiau: 'asc' },
  });

  return stocks.map((s) => ({
    ...s,
    statut: getStatutStock(s),
    valeurStock: s.quantite * s.prixUnitaire,
  }));
};

const getAlertes = async () => {
  const stocks = await prisma.stockMatiere.findMany();
  return stocks
    .filter((s) => s.quantite <= s.seuilAlerte)
    .map((s) => ({
      ...s,
      niveau: s.quantite <= s.seuilCritique ? 'CRITIQUE' : 'FAIBLE',
      statut: getStatutStock(s),
    }));
};

const getTableauDeBord = async () => {
  const stocks = await prisma.stockMatiere.findMany();
  const valeurTotale = stocks.reduce((acc, s) => acc + s.quantite * s.prixUnitaire, 0);
  const alertes = stocks.filter((s) => s.quantite <= s.seuilAlerte).length;
  const critiques = stocks.filter((s) => s.quantite <= s.seuilCritique).length;

  return {
    totalMatieres: stocks.length,
    valeurTotale,
    alertes,
    critiques,
    stocks: stocks.map((s) => ({ ...s, statut: getStatutStock(s), valeurStock: s.quantite * s.prixUnitaire })),
  };
};

const getMouvements = async (stockId, params = {}) => {
  return prisma.mouvementStock.findMany({
    where: { stockId },
    include: { user: { select: { nom: true, prenom: true } } },
    orderBy: { createdAt: 'desc' },
    take: params.limit ? parseInt(params.limit) : 50,
  });
};

const enregistrerEntree = async (data, userId) => {
  const stock = await prisma.stockMatiere.findUnique({ where: { id: data.stockId } });
  if (!stock) throw Object.assign(new Error('Matière introuvable'), { statusCode: 404 });

  const quantiteApres = stock.quantite + parseFloat(data.quantite);
  const montantTotal = parseFloat(data.quantite) * (data.prixUnitaire || stock.prixUnitaire);

  const [mouvement, updatedStock] = await prisma.$transaction([
    prisma.mouvementStock.create({
      data: {
        stockId: data.stockId,
        type: 'ENTREE_ACHAT',
        quantite: parseFloat(data.quantite),
        quantiteAvant: stock.quantite,
        quantiteApres,
        prixUnitaire: data.prixUnitaire || stock.prixUnitaire,
        montantTotal,
        motif: data.motif || 'Achat fournisseur',
        reference: data.reference,
        userId,
      },
    }),
    prisma.stockMatiere.update({
      where: { id: data.stockId },
      data: {
        quantite: quantiteApres,
        prixUnitaire: data.prixUnitaire || stock.prixUnitaire,
        fournisseur: data.fournisseur || stock.fournisseur,
        dernierMouvement: new Date(),
      },
    }),
  ]);

  await prisma.activite.create({
    data: {
      userId,
      type: 'MOUVEMENT_STOCK',
      action: `Entrée stock : ${parseFloat(data.quantite)} ${stock.unite} de ${stock.designation}`,
      details: { stockId: data.stockId, quantite: data.quantite, type: 'ENTREE_ACHAT' },
    },
  });

  // Vérifier si le stock a récupéré
  emitToAll('stock:mise_a_jour', { stockId: data.stockId, quantite: quantiteApres });

  logger.info(`Entrée stock : +${data.quantite} ${stock.unite} ${stock.designation}`);
  return { mouvement, stock: updatedStock };
};

const deduireStockProduction = async (productionId, commandeId, formulation, volume, userId) => {
  const mouvements = [];

  const matieres = [
    { type: 'CIMENT',      quantite: formulation.ciment * volume },
    { type: 'SABLE',       quantite: formulation.sable * volume },
    { type: 'GRAVIER_515', quantite: formulation.gravier515 * volume * 1000 },
    { type: 'GRAVIER_1525',quantite: formulation.gravier1525 * volume * 1000 },
    { type: 'HYDROFUGE',   quantite: formulation.hydrofuge * volume },
    { type: 'POWERFLOW',   quantite: formulation.powerflow * volume },
    { type: 'GASOIL',      quantite: (formulation.gasoilToupie + formulation.gasoilChargeur + formulation.gasoilPompe + formulation.gasoilGroupe) * (volume / 200) },
  ].filter((m) => m.quantite > 0);

  for (const m of matieres) {
    const stock = await prisma.stockMatiere.findFirst({ where: { materiau: m.type } });
    if (!stock) continue;

    const quantiteApres = Math.max(0, stock.quantite - m.quantite);

    // Mouvement + mise à jour stock en batch (atomique, rapide)
    await prisma.$transaction([
      prisma.mouvementStock.create({
        data: {
          stockId: stock.id,
          type: 'SORTIE_PRODUCTION',
          quantite: m.quantite,
          quantiteAvant: stock.quantite,
          quantiteApres,
          motif: `Production commande ${commandeId}`,
          productionId,
          commandeId,
          userId,
        },
      }),
      prisma.stockMatiere.update({
        where: { id: stock.id },
        data: { quantite: quantiteApres, dernierMouvement: new Date() },
      }),
    ]);

    // Alertes stock après déduction (hors transaction)
    if (quantiteApres <= stock.seuilCritique) {
      const users = await prisma.user.findMany({ where: { role: { in: ['PDG', 'CHEF_DE_SITE'] } } });
      for (const u of users) {
        await prisma.notification.create({
          data: {
            userId: u.id,
            titre: 'STOCK_CRITIQUE',
            message: `Stock CRITIQUE : ${stock.designation} — ${quantiteApres.toFixed(1)} ${stock.unite} restants`,
            type: 'STOCK_CRITIQUE',
          },
        });
        emitToRole(u.role, 'notification:nouvelle', { type: 'STOCK_CRITIQUE', message: `Stock critique : ${stock.designation}` });
      }
    } else if (quantiteApres <= stock.seuilAlerte) {
      emitToRole('CHEF_DE_SITE', 'stock:alerte', { materiau: m.type, designation: stock.designation, quantite: quantiteApres });
    }

    mouvements.push({ materiau: m.type, quantite: m.quantite });
  }

  return mouvements;
};

const ajusterStock = async (data, userId) => {
  const stock = await prisma.stockMatiere.findUnique({ where: { id: data.stockId } });
  if (!stock) throw Object.assign(new Error('Matière introuvable'), { statusCode: 404 });

  const quantiteApres = parseFloat(data.nouvelleQuantite);
  const diff = quantiteApres - stock.quantite;

  await prisma.$transaction([
    prisma.mouvementStock.create({
      data: {
        stockId: data.stockId,
        type: 'INVENTAIRE',
        quantite: Math.abs(diff),
        quantiteAvant: stock.quantite,
        quantiteApres,
        motif: data.motif || `Inventaire physique — ${new Date().toLocaleDateString('fr-FR')}`,
        userId,
      },
    }),
    prisma.stockMatiere.update({
      where: { id: data.stockId },
      data: { quantite: quantiteApres, dernierMouvement: new Date() },
    }),
  ]);

  return { success: true };
};

const mettreAJourPrix = async (id, prixUnitaire, userId) => {
  const updated = await prisma.stockMatiere.update({
    where: { id },
    data: { prixUnitaire: parseFloat(prixUnitaire) },
  });
  return updated;
};

const getStatutStock = (s) => {
  if (s.quantite <= s.seuilCritique) return 'CRITIQUE';
  if (s.quantite <= s.seuilAlerte) return 'FAIBLE';
  return 'OK';
};

module.exports = { listerStocks, getAlertes, getTableauDeBord, getMouvements, enregistrerEntree, deduireStockProduction, ajusterStock, mettreAJourPrix };
