const prisma = require('../../config/prisma');

const getDateRange = (debut, fin) => {
  const d = debut ? new Date(debut) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const f = fin ? new Date(fin) : new Date();
  return { gte: d, lte: f };
};

const tableauDeBordPDG = async (params) => {
  const range = getDateRange(params.debut, params.fin);

  const [
    statsCommandes, statsProduction, statsPaiements, statsStocks,
    commandesRecentes, productionsRecentes
  ] = await prisma.$transaction([
    // Commandes
    prisma.commande.groupBy({
      by: ['statut'],
      where: { createdAt: range },
      _count: { id: true },
      _sum: { montantCommande: true, beneficeNetReel: true },
    }),
    // Production
    prisma.production.aggregate({
      where: { createdAt: range },
      _sum: { volumeProduit: true, coutTotal: true, gasoilConsomme: true },
      _count: { id: true },
    }),
    // Paiements
    prisma.paiement.aggregate({
      where: { statut: 'PAYE', datePaiement: range },
      _sum: { montant: true },
    }),
    // Stocks
    prisma.stockMatiere.findMany({ select: { designation: true, quantite: true, seuilAlerte: true, seuilCritique: true, prixUnitaire: true } }),
    // Dernières commandes
    prisma.commande.findMany({
      where: { createdAt: range },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { reference: true, nomClient: true, volumeBeton: true, montantCommande: true, statut: true, beneficeNetReel: true },
    }),
    // Productions récentes
    prisma.production.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { commande: { select: { reference: true, nomClient: true } } },
    }),
  ]);

  const caTotal = statsCommandes.reduce((a, s) => a + (s._sum.montantCommande || 0), 0);
  const beneficeTotal = statsCommandes.reduce((a, s) => a + (s._sum.beneficeNetReel || 0), 0);
  const alertesStock = statsStocks.filter((s) => s.quantite <= s.seuilAlerte).length;
  const valeurStock = statsStocks.reduce((a, s) => a + s.quantite * s.prixUnitaire, 0);

  const parStatut = {};
  statsCommandes.forEach((s) => { parStatut[s.statut] = s._count.id; });

  return {
    commandes: {
      total: Object.values(parStatut).reduce((a, v) => a + v, 0),
      parStatut,
      caTotal,
      beneficeTotal,
      tauxMarge: caTotal > 0 ? Math.round((beneficeTotal / caTotal) * 100 * 100) / 100 : 0,
    },
    production: {
      total: statsProduction._count.id,
      volumeTotal: statsProduction._sum.volumeProduit || 0,
      coutTotal: statsProduction._sum.coutTotal || 0,
      gasoilTotal: statsProduction._sum.gasoilConsomme || 0,
    },
    paiements: {
      encaisse: statsPaiements._sum.montant || 0,
    },
    stocks: {
      alertes: alertesStock,
      valeurTotale: valeurStock,
    },
    commandesRecentes,
    productionsRecentes,
  };
};

const rapportProduction = async (params) => {
  const range = getDateRange(params.debut, params.fin);

  const productions = await prisma.production.findMany({
    where: { createdAt: range },
    include: {
      commande: { select: { reference: true, nomClient: true, typeBeton: true } },
      equipements: { include: { equipement: { select: { nom: true, type: true } } } },
    },
    orderBy: { dateDebut: 'desc' },
  });

  const volumeTotal = productions.reduce((a, p) => a + (p.volumeProduit || 0), 0);
  const coutTotal = productions.reduce((a, p) => a + (p.coutTotal || 0), 0);
  const gasoilTotal = productions.reduce((a, p) => a + (p.gasoilConsomme || 0), 0);

  return { productions, volumeTotal, coutTotal, gasoilTotal, total: productions.length };
};

const rapportFinancier = async (params) => {
  const range = getDateRange(params.debut, params.fin);

  const commandes = await prisma.commande.findMany({
    where: { createdAt: range, montantCommande: { gt: 0 } },
    include: {
      paiements: { where: { statut: 'PAYE' }, select: { montant: true, modePaiement: true } },
      productions: { select: { coutTotal: true, coutMatieres: true, coutCarburant: true, coutAmortissement: true, coutPersonnel: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totaux = commandes.reduce((acc, c) => {
    acc.ca += c.montantCommande || 0;
    acc.paye += c.paiements.reduce((a, p) => a + p.montant, 0);
    acc.benefice += c.beneficeNetReel || 0;
    acc.depenses += c.depensesReelles || 0;
    return acc;
  }, { ca: 0, paye: 0, benefice: 0, depenses: 0 });

  totaux.impaye = totaux.ca - totaux.paye;
  totaux.tauxMarge = totaux.ca > 0 ? (totaux.benefice / totaux.ca) * 100 : 0;

  return { commandes, totaux, periode: { debut: range.gte, fin: range.lte } };
};

const rapportStocks = async () => {
  const stocks = await prisma.stockMatiere.findMany({
    include: {
      mouvements: {
        where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return stocks.map((s) => ({
    ...s,
    valeurStock: s.quantite * s.prixUnitaire,
    statut: s.quantite <= s.seuilCritique ? 'CRITIQUE' : s.quantite <= s.seuilAlerte ? 'FAIBLE' : 'OK',
    mouvementsMois: s.mouvements.length,
    entreesMois: s.mouvements.filter((m) => m.type.startsWith('ENTREE')).reduce((a, m) => a + m.quantite, 0),
    sortiesMois: s.mouvements.filter((m) => m.type.startsWith('SORTIE')).reduce((a, m) => a + m.quantite, 0),
  }));
};

const rapportEquipements = async () => {
  const equipements = await prisma.equipement.findMany({
    include: {
      maintenances: { orderBy: { dateDebut: 'desc' }, take: 5 },
      _count: { select: { maintenances: true, productions: true } },
    },
  });

  const coutMaintenanceTotal = await prisma.maintenanceEquipement.aggregate({ _sum: { cout: true } });

  return {
    equipements: equipements.map((e) => ({
      ...e,
      amortissementCumule: e.coutAcquisition - e.valeurActuelle,
      pourcentageUse: Math.round((e.heuresUtilisees / e.dureeVieHeures) * 100),
      alerte: e.prochainRevisionH && e.heuresUtilisees >= e.prochainRevisionH,
    })),
    coutMaintenanceTotal: coutMaintenanceTotal._sum.cout || 0,
    valeurTotaleActuelle: equipements.reduce((a, e) => a + e.valeurActuelle, 0),
  };
};

const rapportBenefices = async (params) => {
  const range = getDateRange(params.debut, params.fin);

  const commandes = await prisma.commande.findMany({
    where: { createdAt: range, beneficeNetReel: { not: null } },
    select: {
      reference: true, nomClient: true, volumeBeton: true, typeBeton: true,
      montantCommande: true, depensesReelles: true, beneficeNetReel: true,
      tauxMargeReel: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalCA = commandes.reduce((a, c) => a + (c.montantCommande || 0), 0);
  const totalDepenses = commandes.reduce((a, c) => a + (c.depensesReelles || 0), 0);
  const totalBenefice = commandes.reduce((a, c) => a + (c.beneficeNetReel || 0), 0);

  return {
    commandes,
    totaux: {
      ca: totalCA,
      depenses: totalDepenses,
      benefice: totalBenefice,
      tauxMarge: totalCA > 0 ? Math.round((totalBenefice / totalCA) * 100 * 100) / 100 : 0,
    },
  };
};

const beneficeParCommande = async (commandeId) => {
  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    include: {
      formulation: true,
      productions: { include: { mouvementsStock: { include: { stock: true } }, equipements: true } },
      paiements: { where: { statut: 'PAYE' } },
    },
  });
  if (!commande) throw Object.assign(new Error('Commande introuvable'), { statusCode: 404 });

  const totalPaye = commande.paiements.reduce((a, p) => a + p.montant, 0);
  const depenses = commande.depensesReelles || commande.coutTotal || 0;
  const benefice = (commande.montantCommande || 0) - depenses;

  return {
    commande: {
      reference: commande.reference,
      nomClient: commande.nomClient,
      volumeBeton: commande.volumeBeton,
      typeBeton: commande.typeBeton,
      montantCommande: commande.montantCommande,
    },
    financier: {
      chiffreAffaires: commande.montantCommande || 0,
      coutMateriaux: commande.coutMateriaux || 0,
      coutGasoil: commande.coutGasoil || 0,
      coutAmortissement: commande.coutAmortissement || 0,
      coutPersonnel: commande.coutPersonnel || 0,
      depensesReelles: depenses,
      beneficeNet: benefice,
      tauxMarge: commande.montantCommande > 0 ? Math.round((benefice / commande.montantCommande) * 100 * 100) / 100 : 0,
    },
    paiements: {
      totalPaye,
      restant: (commande.montantCommande || 0) - totalPaye,
      detail: commande.paiements,
    },
    productions: commande.productions,
  };
};

module.exports = { tableauDeBordPDG, rapportProduction, rapportFinancier, rapportStocks, rapportEquipements, rapportBenefices, beneficeParCommande };
