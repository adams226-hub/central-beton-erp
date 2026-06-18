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
  HYDROFUGE:    { unite: 'L', label: 'Hydrofuge' },
  POWERFLOW:    { unite: 'L', label: 'Powerflow 6425' },
  GASOIL:       { unite: 'L', label: 'Gasoil' },
  RETARDATEUR:  { unite: 'L', label: 'Retardateur de prise' },
  ACCELERATEUR: { unite: 'L', label: 'Accélérateur de prise' },
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

const deduireStockProduction = async (commandeId, formulation, volume, userId) => {
  const besoins = [
    { type: 'CIMENT',       quantite: formulation.ciment * volume },
    { type: 'SABLE',        quantite: formulation.sable * volume },
    { type: 'GRAVIER_515',  quantite: formulation.gravier515 * volume * 1000 },
    { type: 'GRAVIER_1525', quantite: formulation.gravier1525 * volume * 1000 },
    { type: 'HYDROFUGE',    quantite: (formulation.hydrofuge    || 0) * volume },
    { type: 'POWERFLOW',    quantite: (formulation.powerflow    || 0) * volume },
    { type: 'RETARDATEUR',  quantite: (formulation.retardateur  || 0) * volume },
    { type: 'ACCELERATEUR', quantite: (formulation.accelerateur || 0) * volume },
    { type: 'GASOIL',       quantite: (formulation.gasoilToupie + formulation.gasoilChargeur + formulation.gasoilPompe + formulation.gasoilGroupe) * (volume / 200) },
  ].filter((m) => m.quantite > 0);

  // 1. Récupérer tous les stocks en UNE seule requête
  const types = besoins.map((m) => m.type);
  const stocks = await prisma.stockMatiere.findMany({ where: { materiau: { in: types } } });
  const stockMap = Object.fromEntries(stocks.map((s) => [s.materiau, s]));

  // 2. Calculer les nouvelles quantités
  const now = new Date();
  const mouvements = [];
  const operations = [];

  for (const m of besoins) {
    const stock = stockMap[m.type];
    if (!stock) continue;
    const quantiteApres = Math.max(0, stock.quantite - m.quantite);

    operations.push(
      prisma.mouvementStock.create({
        data: {
          stockId: stock.id,
          type: 'SORTIE_PRODUCTION',
          quantite: m.quantite,
          quantiteAvant: stock.quantite,
          quantiteApres,
          motif: `Production commande ${commandeId}`,
          commandeId,
          userId,
        },
      }),
      prisma.stockMatiere.update({
        where: { id: stock.id },
        data: { quantite: quantiteApres, dernierMouvement: now },
      })
    );

    mouvements.push({ materiau: m.type, quantite: m.quantite, quantiteApres, stock });
  }

  // 3. Une seule transaction pour toutes les matières
  if (operations.length > 0) {
    await prisma.$transaction(operations, { timeout: 30000 });
  }

  // 4. Alertes stock APRÈS la transaction (sans bloquer le démarrage)
  const usersAlerte = await prisma.user.findMany({
    where: { role: { in: ['PDG', 'CHEF_DE_SITE', 'CHEF_COMPTABLE'] }, isActive: true },
    select: { id: true, role: true },
  });

  for (const { materiau, quantiteApres, stock } of mouvements) {
    if (quantiteApres <= stock.seuilCritique) {
      const notifOps = usersAlerte.map((u) =>
        prisma.notification.create({
          data: {
            userId: u.id,
            titre: 'STOCK_CRITIQUE',
            message: `Stock CRITIQUE : ${stock.designation} — ${quantiteApres.toFixed(1)} ${stock.unite} restants`,
            type: 'STOCK_CRITIQUE',
          },
        })
      );
      if (notifOps.length > 0) await prisma.$transaction(notifOps, { timeout: 15000 });
      emitToAll('stock:alerte', { niveau: 'CRITIQUE', designation: stock.designation, quantite: quantiteApres });
    } else if (quantiteApres <= stock.seuilAlerte) {
      emitToRole('CHEF_DE_SITE', 'stock:alerte', { materiau, designation: stock.designation, quantite: quantiteApres });
    }
  }

  return mouvements.map(({ materiau, quantite }) => ({ materiau, quantite }));
};

const enregistrerSortie = async (data, userId) => {
  const stock = await prisma.stockMatiere.findUnique({ where: { id: data.stockId } });
  if (!stock) throw Object.assign(new Error('Matière introuvable'), { statusCode: 404 });

  const qte = parseFloat(data.quantite);
  if (!(qte > 0)) throw Object.assign(new Error('Quantité invalide'), { statusCode: 400 });
  if (stock.quantite < qte) throw Object.assign(new Error(`Stock insuffisant (dispo : ${stock.quantite} ${stock.unite})`), { statusCode: 400 });

  let commandeId = null;
  if (data.referenceCommande) {
    const commande = await prisma.commande.findUnique({ where: { reference: data.referenceCommande } });
    if (!commande) throw Object.assign(new Error(`Commande ${data.referenceCommande} introuvable`), { statusCode: 404 });
    commandeId = commande.id;
  }

  const type = data.type || (commandeId ? 'SORTIE_COMMANDE' : 'SORTIE_AUTRE');
  const motif = data.motif || (commandeId ? `Sortie commande ${data.referenceCommande}` : 'Sortie manuelle');
  const quantiteApres = stock.quantite - qte;

  const [mouvement, updatedStock] = await prisma.$transaction([
    prisma.mouvementStock.create({
      data: { stockId: data.stockId, type, quantite: qte, quantiteAvant: stock.quantite, quantiteApres, motif, commandeId, userId },
    }),
    prisma.stockMatiere.update({
      where: { id: data.stockId },
      data: { quantite: quantiteApres, dernierMouvement: new Date() },
    }),
  ]);

  if (quantiteApres <= stock.seuilAlerte) {
    emitToAll('stock:alerte', {
      niveau: quantiteApres <= stock.seuilCritique ? 'CRITIQUE' : 'FAIBLE',
      designation: stock.designation,
      quantite: quantiteApres,
    });
  }
  emitToAll('stock:mise_a_jour', { stockId: data.stockId, quantite: quantiteApres });

  logger.info(`Sortie stock : -${qte} ${stock.unite} ${stock.designation} (${motif})`);
  return { mouvement, stock: updatedStock };
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

module.exports = { listerStocks, getAlertes, getTableauDeBord, getMouvements, enregistrerEntree, enregistrerSortie, deduireStockProduction, ajusterStock, mettreAJourPrix };
