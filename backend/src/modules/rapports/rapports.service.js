const prisma = require('../../config/prisma');

// Le frontend envoie tantôt dateDebut/dateFin (pages Rapports/Dashboard), tantôt debut/fin
// (export PDF/Excel) — on accepte les deux pour que le filtre de période fonctionne partout.
const getDateRange = (params = {}) => {
  const debut = params.dateDebut || params.debut;
  const fin = params.dateFin || params.fin;
  const d = debut ? new Date(debut) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const f = fin ? new Date(fin) : new Date();
  return { gte: d, lte: f };
};

const tableauDeBordPDG = async (params) => {
  const range = getDateRange(params);

  const [
    commandesPeriode, statsPaiements, statsStocks,
    commandesActives, livraisonsEnCours, paiementsEnAttente,
  ] = await prisma.$transaction([
    prisma.commande.findMany({
      where: { createdAt: range },
      select: {
        id: true, reference: true, nomClient: true, volumeBeton: true,
        montantCommande: true, beneficeNetReel: true, margePrevisionnelle: true, statut: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.paiement.aggregate({
      where: { statut: 'PAYE', datePaiement: range },
      _sum: { montant: true },
    }),
    prisma.stockMatiere.findMany({ select: { designation: true, quantite: true, seuilAlerte: true, seuilCritique: true, prixUnitaire: true } }),
    prisma.commande.count({ where: { statut: { notIn: ['LIVREE', 'ANNULEE', 'REJETEE'] } } }),
    prisma.livraison.count({ where: { statut: 'EN_ROUTE' } }),
    prisma.paiement.count({ where: { statut: 'EN_ATTENTE' } }),
  ]);

  const caTotal = commandesPeriode.reduce((a, c) => a + (c.montantCommande || 0), 0);
  const beneficeTotal = commandesPeriode.reduce((a, c) => a + (c.beneficeNetReel ?? c.margePrevisionnelle ?? 0), 0);
  const volumeTotal = commandesPeriode.reduce((a, c) => a + (c.volumeBeton || 0), 0);
  const tauxMarge = caTotal > 0 ? Math.round((beneficeTotal / caTotal) * 100 * 100) / 100 : 0;
  const encaisse = statsPaiements._sum.montant || 0;

  const alertesStock = statsStocks.filter((s) => s.quantite <= s.seuilAlerte).length;
  const critiquesStock = statsStocks.filter((s) => s.quantite <= s.seuilCritique).length;
  const valeurStock = statsStocks.reduce((a, s) => a + s.quantite * s.prixUnitaire, 0);

  const topCommandes = [...commandesPeriode]
    .sort((a, b) => (b.montantCommande || 0) - (a.montantCommande || 0))
    .slice(0, 5);

  const parStatut = {};
  commandesPeriode.forEach((c) => { parStatut[c.statut] = (parStatut[c.statut] || 0) + 1; });

  return {
    // ── Format attendu par DashboardPDG.jsx ──────────────────────────────
    mois: {
      ca: caTotal,
      benefice: beneficeTotal,
      tauxMarge,
      volumeLivre: volumeTotal,
      commandes: commandesPeriode.length,
      encaisse,
    },
    operations: {
      commandesActives,
      livraisonsEnCours,
      paiementsEnAttente,
    },
    stocks: {
      alertes: alertesStock,
      critiques: critiquesStock,
      valeurTotale: valeurStock,
    },

    // ── Format attendu par Rapports.jsx (onglet "Vue PDG") ───────────────
    chiffreAffaires: caTotal,
    beneficeNet: beneficeTotal,
    nombreCommandes: commandesPeriode.length,
    volumeTotal,
    montantEncaisse: encaisse,
    topCommandes,

    // ── Détail (legacy) ───────────────────────────────────────────────
    commandes: { total: commandesPeriode.length, parStatut, caTotal, beneficeTotal, tauxMarge },
    commandesRecentes: commandesPeriode.slice(0, 5),
  };
};

const rapportProduction = async (params) => {
  const range = getDateRange(params);

  const livraisons = await prisma.livraison.findMany({
    where: { createdAt: range },
    include: {
      commande: { select: { reference: true, nomClient: true, typeBeton: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const volumeTotal = livraisons.reduce((a, l) => a + (l.volumeReel || l.volumePlanifie || 0), 0);

  return {
    productions: livraisons,
    stats: {
      total: livraisons.length,
      volumeTotal,
      gasoilTotal: 0,     // non suivi au niveau livraison (voir coûts gasoil par commande)
      coutCarburant: 0,
    },
    total: livraisons.length,
  };
};

const rapportFinancier = async (params) => {
  const range = getDateRange(params);

  const commandes = await prisma.commande.findMany({
    where: { createdAt: range, montantCommande: { gt: 0 } },
    include: {
      paiements: { where: { statut: 'PAYE' }, select: { montant: true, modePaiement: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totaux = commandes.reduce((acc, c) => {
    const depenses = c.depensesReelles ?? c.coutTotal ?? 0;
    acc.ca += c.montantCommande || 0;
    acc.paye += c.paiements.reduce((a, p) => a + p.montant, 0);
    acc.benefice += c.beneficeNetReel ?? (c.montantCommande || 0) - depenses;
    acc.depenses += depenses;
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
    consommePeriode: s.mouvements.filter((m) => m.type.startsWith('SORTIE')).reduce((a, m) => a + m.quantite, 0),
    achetePeriode: s.mouvements.filter((m) => m.type.startsWith('ENTREE')).reduce((a, m) => a + m.quantite, 0),
    entreesMois: s.mouvements.filter((m) => m.type.startsWith('ENTREE')).reduce((a, m) => a + m.quantite, 0),
    sortiesMois: s.mouvements.filter((m) => m.type.startsWith('SORTIE')).reduce((a, m) => a + m.quantite, 0),
  }));
};

const rapportEquipements = async () => {
  const equipements = await prisma.equipement.findMany({
    include: {
      maintenances: { orderBy: { dateDebut: 'desc' }, take: 5 },
      _count: { select: { maintenances: true, livraisons: true } },
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
  const range = getDateRange(params);

  const commandes = await prisma.commande.findMany({
    where: { createdAt: range, montantCommande: { gt: 0 } },
    select: {
      id: true, reference: true, nomClient: true, volumeBeton: true, typeBeton: true,
      montantCommande: true, coutMateriaux: true, coutTotal: true, margePrevisionnelle: true,
      depensesReelles: true, beneficeNetReel: true, tauxMargeReel: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const enrichies = commandes.map((c) => {
    const depenses = c.depensesReelles ?? c.coutTotal ?? 0;
    const benefice = c.beneficeNetReel ?? (c.montantCommande || 0) - depenses;
    const tauxMarge = c.tauxMargeReel ?? (c.montantCommande > 0 ? Math.round((benefice / c.montantCommande) * 100 * 100) / 100 : 0);
    return {
      id: c.id,
      reference: c.reference,
      nomClient: c.nomClient,
      typeBeton: c.typeBeton,
      volumeBeton: c.volumeBeton,
      volumeCommande: c.volumeBeton,
      montantCommande: c.montantCommande,
      coutMatieresPrevisionnel: c.coutMateriaux || 0,
      coutTotalPrevisionnel: c.coutTotal || 0,
      margePrevisionnelle: c.margePrevisionnelle || 0,
      depensesReelles: depenses,
      beneficeNetReel: benefice,
      beneficeNet: benefice,
      tauxMargeReel: tauxMarge,
      createdAt: c.createdAt,
    };
  });

  const totalCA = enrichies.reduce((a, c) => a + (c.montantCommande || 0), 0);
  const totalCoutMatieres = enrichies.reduce((a, c) => a + (c.coutMatieresPrevisionnel || 0), 0);
  const totalDepenses = enrichies.reduce((a, c) => a + (c.depensesReelles || 0), 0);
  const totalBenefice = enrichies.reduce((a, c) => a + (c.beneficeNetReel || 0), 0);
  const tauxMargeGlobal = totalCA > 0 ? Math.round((totalBenefice / totalCA) * 100 * 100) / 100 : 0;

  return {
    commandes: enrichies,
    totaux: {
      nbCommandes: enrichies.length,
      ca: totalCA,
      caTotal: totalCA,
      coutMatieres: totalCoutMatieres,
      coutTotal: totalDepenses,
      depenses: totalDepenses,
      benefice: totalBenefice,
      beneficeNet: totalBenefice,
      tauxMarge: tauxMargeGlobal,
    },
  };
};

const beneficeParCommande = async (commandeId) => {
  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    include: {
      formulation: true,
      livraisons: true,
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
    livraisons: commande.livraisons,
  };
};

module.exports = { tableauDeBordPDG, rapportProduction, rapportFinancier, rapportStocks, rapportEquipements, rapportBenefices, beneficeParCommande };
