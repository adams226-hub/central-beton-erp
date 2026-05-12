const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

// ─── Utilitaires ─────────────────────────────────────────────────────────────

const getNow = () => new Date();
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfYear = (d = new Date()) => new Date(d.getFullYear(), 0, 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const subMonths = (d, n) => addMonths(d, -n);

// Régression linéaire simple en JS (fallback quand ML service indisponible)
function linearRegression(series) {
  const n = series.length;
  if (n < 2) return { slope: 0, intercept: series[0] || 0, r2: 0 };
  const sumX = series.reduce((a, _, i) => a + i, 0);
  const sumY = series.reduce((a, v) => a + v, 0);
  const sumXY = series.reduce((a, v, i) => a + i * v, 0);
  const sumX2 = series.reduce((a, _, i) => a + i * i, 0);
  const meanY = sumY / n;
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const ss_res = series.reduce((a, v, i) => a + Math.pow(v - (intercept + slope * i), 2), 0);
  const ss_tot = series.reduce((a, v) => a + Math.pow(v - meanY, 2), 0);
  const r2 = ss_tot > 0 ? 1 - ss_res / ss_tot : 0;
  return { slope, intercept, r2 };
}

function forecastLinear(series, periods = 3) {
  const { slope, intercept, r2 } = linearRegression(series);
  const n = series.length;
  const predictions = Array.from({ length: periods }, (_, i) =>
    Math.max(0, Math.round((intercept + slope * (n + i)) * 100) / 100)
  );
  const confidence = Math.round(Math.min(95, Math.max(50, r2 * 100)));
  return { predictions, slope, r2, confidence };
}

function movingAverage(series, window = 3) {
  if (series.length < window) return series.length > 0 ? [series[series.length - 1]] : [0];
  return series.slice(-window).reduce((a, v) => a + v, 0) / window;
}

// ─── KPIs Temps Réel ─────────────────────────────────────────────────────────

const getKPIsTempsReel = async () => {
  const now = getNow();
  const todayStart = startOfDay();
  const monthStart = startOfMonth();
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = startOfMonth(now);
  const yearStart = startOfYear();

  const [
    caJour, caMois, caMoisPrec, caAnnee,
    productionMois, productionJour,
    encaisseMois, paiementsEnAttente,
    commandesActives, commandesJour,
    stocksAlerte, livraisonsEnCours,
    equipementsActifs,
  ] = await Promise.all([
    // CA jour
    prisma.commande.aggregate({
      where: { createdAt: { gte: todayStart }, montantCommande: { gt: 0 } },
      _sum: { montantCommande: true, beneficeNetReel: true },
      _count: { id: true },
    }),
    // CA mois
    prisma.commande.aggregate({
      where: { createdAt: { gte: monthStart }, montantCommande: { gt: 0 } },
      _sum: { montantCommande: true, beneficeNetReel: true, depensesReelles: true },
      _count: { id: true },
    }),
    // CA mois précédent (comparaison)
    prisma.commande.aggregate({
      where: { createdAt: { gte: prevMonthStart, lt: prevMonthEnd }, montantCommande: { gt: 0 } },
      _sum: { montantCommande: true, beneficeNetReel: true },
    }),
    // CA année
    prisma.commande.aggregate({
      where: { createdAt: { gte: yearStart }, montantCommande: { gt: 0 } },
      _sum: { montantCommande: true, beneficeNetReel: true },
      _count: { id: true },
    }),
    // Production mois
    prisma.production.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { volumeProduit: true, gasoilConsomme: true, coutTotal: true },
      _count: { id: true },
    }),
    // Production jour
    prisma.production.aggregate({
      where: { createdAt: { gte: todayStart } },
      _sum: { volumeProduit: true },
      _count: { id: true },
    }),
    // Encaissé mois
    prisma.paiement.aggregate({
      where: { statut: 'PAYE', datePaiement: { gte: monthStart } },
      _sum: { montant: true },
    }),
    // Paiements en attente
    prisma.paiement.aggregate({
      where: { statut: 'EN_ATTENTE' },
      _sum: { montant: true },
      _count: { id: true },
    }),
    // Commandes actives
    prisma.commande.count({
      where: { statut: { in: ['VALIDEE', 'EN_PRODUCTION', 'EN_ATTENTE_SECRETAIRE', 'EN_ATTENTE_CHEF_SITE', 'EN_ATTENTE_PDG'] } },
    }),
    // Commandes du jour
    prisma.commande.count({ where: { createdAt: { gte: todayStart } } }),
    // Stocks en alerte (calculé après avec logique correcte)
    Promise.resolve(0),
    // Livraisons en cours
    prisma.livraison.count({ where: { statut: 'EN_ROUTE' } }),
    // Équipements actifs
    prisma.equipement.count({ where: { statut: 'EN_SERVICE' } }),
  ]);

  const caM = caMois._sum.montantCommande || 0;
  const caMPrec = caMoisPrec._sum.montantCommande || 0;
  const beneficeM = caMois._sum.beneficeNetReel || 0;
  const depensesM = caMois._sum.depensesReelles || 0;
  const evolCA = caMPrec > 0 ? ((caM - caMPrec) / caMPrec) * 100 : 0;

  // Stocks alerte (avec logique correcte)
  const stocks = await prisma.stockMatiere.findMany({ select: { quantite: true, seuilAlerte: true, seuilCritique: true } });
  const stocksCritiques = stocks.filter((s) => s.quantite <= s.seuilCritique).length;
  const stocksFaibles = stocks.filter((s) => s.quantite <= s.seuilAlerte && s.quantite > s.seuilCritique).length;

  return {
    aujourdhui: {
      ca: caJour._sum.montantCommande || 0,
      benefice: caJour._sum.beneficeNetReel || 0,
      commandes: commandesJour,
      volume: productionJour._sum.volumeProduit || 0,
      productions: productionJour._count.id,
    },
    mois: {
      ca: caM,
      benefice: beneficeM,
      depenses: depensesM,
      tauxMarge: caM > 0 ? Math.round((beneficeM / caM) * 10000) / 100 : 0,
      evolution: Math.round(evolCA * 10) / 10,
      commandes: caMois._count.id,
      volumeProduit: productionMois._sum.volumeProduit || 0,
      productions: productionMois._count.id,
      gasoil: productionMois._sum.gasoilConsomme || 0,
      encaisse: encaisseMois._sum.montant || 0,
    },
    annee: {
      ca: caAnnee._sum.montantCommande || 0,
      benefice: caAnnee._sum.beneficeNetReel || 0,
      commandes: caAnnee._count.id,
    },
    operations: {
      commandesActives,
      livraisonsEnCours,
      equipementsActifs,
      paiementsEnAttente: paiementsEnAttente._count.id,
      montantEnAttente: paiementsEnAttente._sum.montant || 0,
    },
    stocks: {
      critiques: stocksCritiques,
      faibles: stocksFaibles,
      total: stocks.length,
    },
    generatedAt: new Date().toISOString(),
  };
};

// ─── Tendances 12 Mois ───────────────────────────────────────────────────────

const getTendancesMensuelles = async (annee) => {
  const year = annee || new Date().getFullYear();
  const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

  // Récupérer données des 12 mois
  const months = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(year, i, 1);
    const end = new Date(year, i + 1, 1);
    return { start, end, label: moisLabels[i], mois: i + 1 };
  });

  const commandes = await prisma.commande.findMany({
    where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }, montantCommande: { gt: 0 } },
    select: { createdAt: true, montantCommande: true, beneficeNetReel: true, depensesReelles: true, volumeBeton: true, typeBeton: true },
  });

  const productions = await prisma.production.findMany({
    where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
    select: { createdAt: true, volumeProduit: true, gasoilConsomme: true, coutTotal: true, cimentConsomme: true, sableConsomme: true },
  });

  const paiements = await prisma.paiement.findMany({
    where: { statut: 'PAYE', datePaiement: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
    select: { datePaiement: true, montant: true },
  });

  const tendances = months.map(({ start, end, label, mois }) => {
    const cmds = commandes.filter((c) => c.createdAt >= start && c.createdAt < end);
    const prods = productions.filter((p) => p.createdAt >= start && p.createdAt < end);
    const pays = paiements.filter((p) => p.datePaiement >= start && p.datePaiement < end);

    const ca = cmds.reduce((a, c) => a + (c.montantCommande || 0), 0);
    const benefice = cmds.reduce((a, c) => a + (c.beneficeNetReel || 0), 0);
    const depenses = cmds.reduce((a, c) => a + (c.depensesReelles || 0), 0);
    const volume = prods.reduce((a, p) => a + (p.volumeProduit || 0), 0);
    const gasoil = prods.reduce((a, p) => a + (p.gasoilConsomme || 0), 0);
    const ciment = prods.reduce((a, p) => a + (p.cimentConsomme || 0), 0);
    const encaisse = pays.reduce((a, p) => a + p.montant, 0);

    return {
      mois,
      label,
      ca: Math.round(ca),
      benefice: Math.round(benefice),
      depenses: Math.round(depenses),
      tauxMarge: ca > 0 ? Math.round((benefice / ca) * 10000) / 100 : 0,
      volume: Math.round(volume * 100) / 100,
      gasoil: Math.round(gasoil * 100) / 100,
      ciment: Math.round(ciment),
      encaisse: Math.round(encaisse),
      commandes: cmds.length,
    };
  });

  // Calcul totaux
  const totaux = tendances.reduce((acc, t) => {
    acc.ca += t.ca;
    acc.benefice += t.benefice;
    acc.depenses += t.depenses;
    acc.volume += t.volume;
    acc.commandes += t.commandes;
    return acc;
  }, { ca: 0, benefice: 0, depenses: 0, volume: 0, commandes: 0 });

  totaux.tauxMarge = totaux.ca > 0 ? Math.round((totaux.benefice / totaux.ca) * 10000) / 100 : 0;

  // Prévisions mois restants (si année en cours)
  const now = new Date();
  const moisCourant = now.getFullYear() === year ? now.getMonth() : 11;
  const historique = tendances.slice(0, moisCourant).map((t) => t.ca).filter((v) => v > 0);
  const prevCA = historique.length >= 2 ? forecastLinear(historique, 12 - moisCourant) : null;

  return { annee: year, tendances, totaux, previsions: prevCA };
};

// ─── Rentabilité par Client ───────────────────────────────────────────────────

const getRentabiliteParClient = async (params = {}) => {
  const dateDebut = params.dateDebut ? new Date(params.dateDebut) : subMonths(new Date(), 12);
  const dateFin = params.dateFin ? new Date(params.dateFin) : new Date();

  const commandes = await prisma.commande.findMany({
    where: {
      createdAt: { gte: dateDebut, lte: dateFin },
      montantCommande: { gt: 0 },
      statut: { in: ['VALIDEE', 'EN_PRODUCTION', 'LIVREE'] },
    },
    select: {
      nomClient: true, telephone: true, volumeBeton: true,
      montantCommande: true, beneficeNetReel: true, depensesReelles: true,
      statut: true, createdAt: true,
    },
  });

  // Grouper par client
  const clientMap = {};
  commandes.forEach((c) => {
    const k = c.nomClient.trim().toUpperCase();
    if (!clientMap[k]) {
      clientMap[k] = {
        nom: c.nomClient, telephone: c.telephone,
        ca: 0, benefice: 0, depenses: 0, volume: 0, commandes: 0,
        derniereCommande: c.createdAt,
      };
    }
    const cl = clientMap[k];
    cl.ca += c.montantCommande || 0;
    cl.benefice += c.beneficeNetReel || 0;
    cl.depenses += c.depensesReelles || 0;
    cl.volume += c.volumeBeton || 0;
    cl.commandes++;
    if (c.createdAt > cl.derniereCommande) cl.derniereCommande = c.createdAt;
  });

  const clients = Object.values(clientMap)
    .map((c) => ({
      ...c,
      ca: Math.round(c.ca),
      benefice: Math.round(c.benefice),
      depenses: Math.round(c.depenses),
      volume: Math.round(c.volume * 100) / 100,
      tauxMarge: c.ca > 0 ? Math.round((c.benefice / c.ca) * 10000) / 100 : 0,
      prixMoyenM3: c.volume > 0 ? Math.round(c.ca / c.volume) : 0,
    }))
    .sort((a, b) => b.ca - a.ca);

  return {
    clients,
    total: clients.length,
    caTotal: clients.reduce((a, c) => a + c.ca, 0),
    volumeTotal: Math.round(clients.reduce((a, c) => a + c.volume, 0) * 100) / 100,
  };
};

// ─── Rentabilité par Type Béton ───────────────────────────────────────────────

const getRentabiliteParTypeBeton = async (params = {}) => {
  const dateDebut = params.dateDebut ? new Date(params.dateDebut) : subMonths(new Date(), 12);
  const dateFin = params.dateFin ? new Date(params.dateFin) : new Date();

  const commandes = await prisma.commande.findMany({
    where: {
      createdAt: { gte: dateDebut, lte: dateFin },
      montantCommande: { gt: 0 },
    },
    select: {
      typeBeton: true, volumeBeton: true,
      montantCommande: true, beneficeNetReel: true,
      coutMateriaux: true, coutGasoil: true, coutAmortissement: true,
    },
  });

  const typeMap = {};
  commandes.forEach((c) => {
    const k = c.typeBeton || 'Inconnu';
    if (!typeMap[k]) typeMap[k] = { type: k, ca: 0, benefice: 0, volume: 0, commandes: 0, coutMat: 0, coutGaz: 0, coutAmort: 0 };
    const t = typeMap[k];
    t.ca += c.montantCommande || 0;
    t.benefice += c.beneficeNetReel || 0;
    t.volume += c.volumeBeton || 0;
    t.commandes++;
    t.coutMat += c.coutMateriaux || 0;
    t.coutGaz += c.coutGasoil || 0;
    t.coutAmort += c.coutAmortissement || 0;
  });

  return Object.values(typeMap).map((t) => ({
    ...t,
    ca: Math.round(t.ca),
    benefice: Math.round(t.benefice),
    volume: Math.round(t.volume * 100) / 100,
    tauxMarge: t.ca > 0 ? Math.round((t.benefice / t.ca) * 10000) / 100 : 0,
    prixMoyenM3: t.volume > 0 ? Math.round(t.ca / t.volume) : 0,
    coutMoyenM3: t.volume > 0 ? Math.round((t.ca - t.benefice) / t.volume) : 0,
  })).sort((a, b) => b.volume - a.volume);
};

// ─── Analyse Consommation Matières ────────────────────────────────────────────

const getConsommationsMatieres = async (moisCount = 6) => {
  const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const now = new Date();
  const months = Array.from({ length: moisCount }, (_, i) => {
    const d = subMonths(now, moisCount - 1 - i);
    return {
      label: `${moisLabels[d.getMonth()]} ${d.getFullYear()}`,
      start: startOfMonth(d),
      end: startOfMonth(addMonths(d, 1)),
      mois: d.getMonth() + 1,
      annee: d.getFullYear(),
    };
  });

  const mouvements = await prisma.mouvementStock.findMany({
    where: {
      createdAt: { gte: months[0].start, lt: months[months.length - 1].end },
      type: { in: ['SORTIE_PRODUCTION'] },
    },
    include: { stock: { select: { materiau: true, designation: true, unite: true, prixUnitaire: true } } },
  });

  const matieres = ['CIMENT', 'SABLE', 'GRAVIER_515', 'GRAVIER_1525', 'GASOIL', 'HYDROFUGE', 'POWERFLOW'];
  const labels = { CIMENT: 'Ciment', SABLE: 'Sable', GRAVIER_515: 'Gravier 5/15', GRAVIER_1525: 'Gravier 15/25', GASOIL: 'Gasoil', HYDROFUGE: 'Hydrofuge', POWERFLOW: 'Powerflow' };

  const data = months.map(({ label, start, end }) => {
    const mvts = mouvements.filter((m) => m.createdAt >= start && m.createdAt < end);
    const row = { mois: label };
    matieres.forEach((mat) => {
      const mvt = mvts.filter((m) => m.stock?.materiau === mat);
      row[labels[mat] || mat] = Math.round(mvt.reduce((a, m) => a + m.quantite, 0) * 100) / 100;
    });
    return row;
  });

  // Stock actuel + prévision rupture
  const stocks = await prisma.stockMatiere.findMany({
    where: { materiau: { in: matieres } },
    select: { materiau: true, designation: true, quantite: true, seuilCritique: true, unite: true },
  });

  const previsionRupture = stocks.map((s) => {
    const consomMensuelles = months.map(({ start, end }) => {
      const mvts = mouvements.filter(
        (m) => m.createdAt >= start && m.createdAt < end && m.stock?.materiau === s.materiau
      );
      return mvts.reduce((a, m) => a + m.quantite, 0);
    }).filter((v) => v > 0);

    const consoMoyenne = consomMensuelles.length > 0
      ? consomMensuelles.reduce((a, v) => a + v, 0) / consomMensuelles.length
      : 0;

    const moisRestants = consoMoyenne > 0 ? Math.floor(s.quantite / consoMoyenne) : 99;
    return {
      materiau: s.materiau,
      designation: s.designation,
      quantite: s.quantite,
      unite: s.unite,
      consoMoyenneMois: Math.round(consoMoyenne * 100) / 100,
      moisRestants,
      risqueRupture: moisRestants <= 1 ? 'CRITIQUE' : moisRestants <= 2 ? 'AVERTISSEMENT' : 'OK',
    };
  });

  return { consommations: data, previsionRupture };
};

// ─── Prévisions Budgétaires ───────────────────────────────────────────────────

const getPrevisionsbudgetaires = async (periodesAhead = 3) => {
  const now = new Date();

  // Historique 12 derniers mois
  const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const historique = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i);
    return { start: startOfMonth(d), end: startOfMonth(addMonths(d, 1)), label: `${moisLabels[d.getMonth()]} ${d.getFullYear()}` };
  });

  const commandes = await prisma.commande.findMany({
    where: { createdAt: { gte: historique[0].start }, montantCommande: { gt: 0 } },
    select: { createdAt: true, montantCommande: true, beneficeNetReel: true, depensesReelles: true, volumeBeton: true },
  });

  const productions = await prisma.production.findMany({
    where: { createdAt: { gte: historique[0].start } },
    select: { createdAt: true, gasoilConsomme: true, cimentConsomme: true, volumeProduit: true },
  });

  const seriesCA = historique.map(({ start, end }) =>
    commandes.filter((c) => c.createdAt >= start && c.createdAt < end).reduce((a, c) => a + (c.montantCommande || 0), 0)
  );
  const seriesBenefice = historique.map(({ start, end }) =>
    commandes.filter((c) => c.createdAt >= start && c.createdAt < end).reduce((a, c) => a + (c.beneficeNetReel || 0), 0)
  );
  const seriesVolume = historique.map(({ start, end }) =>
    productions.filter((p) => p.createdAt >= start && p.createdAt < end).reduce((a, p) => a + (p.volumeProduit || 0), 0)
  );
  const seriesGasoil = historique.map(({ start, end }) =>
    productions.filter((p) => p.createdAt >= start && p.createdAt < end).reduce((a, p) => a + (p.gasoilConsomme || 0), 0)
  );

  // Essayer le ML service Python, sinon fallback JS
  let previsions;
  try {
    const resp = await axios.post(`${ML_SERVICE_URL}/predict`, {
      ca: seriesCA, benefice: seriesBenefice, volume: seriesVolume, gasoil: seriesGasoil, periods: periodesAhead,
    }, { timeout: 3000 });
    previsions = { ...resp.data, source: 'ml' };
  } catch {
    // Fallback JS
    const prevCA = forecastLinear(seriesCA.filter((v) => v > 0), periodesAhead);
    const prevBenefice = forecastLinear(seriesBenefice, periodesAhead);
    const prevVolume = forecastLinear(seriesVolume.filter((v) => v > 0), periodesAhead);
    const prevGasoil = forecastLinear(seriesGasoil.filter((v) => v > 0), periodesAhead);
    previsions = { ca: prevCA, benefice: prevBenefice, volume: prevVolume, gasoil: prevGasoil, source: 'linear_js' };
  }

  // Construire les mois futurs
  const moisFuturs = Array.from({ length: periodesAhead }, (_, i) => {
    const d = addMonths(now, i + 1);
    return {
      label: `${moisLabels[d.getMonth()]} ${d.getFullYear()}`,
      mois: d.getMonth() + 1,
      annee: d.getFullYear(),
      caPrevu: previsions.ca?.predictions?.[i] || 0,
      beneficePrevu: previsions.benefice?.predictions?.[i] || 0,
      volumePrevu: previsions.volume?.predictions?.[i] || 0,
      gasoilPrevu: previsions.gasoil?.predictions?.[i] || 0,
      confidenceCA: previsions.ca?.confidence || 70,
    };
  });

  // Budgets existants (objectifs manuels)
  const budgets = await prisma.budgetPrevisionnel.findMany({
    where: {
      OR: moisFuturs.map((m) => ({ mois: m.mois, annee: m.annee })),
    },
  });

  const moisFutursAvecBudget = moisFuturs.map((m) => {
    const budget = budgets.find((b) => b.mois === m.mois && b.annee === m.annee);
    return { ...m, budget };
  });

  return {
    historique: historique.map(({ label }, i) => ({
      label,
      ca: Math.round(seriesCA[i]),
      benefice: Math.round(seriesBenefice[i]),
      volume: Math.round(seriesVolume[i] * 100) / 100,
      gasoil: Math.round(seriesGasoil[i] * 100) / 100,
    })),
    previsions: moisFutursAvecBudget,
    source: previsions.source,
    tendance: {
      ca: Math.round((previsions.ca?.slope || 0) * 100) / 100,
      benefice: Math.round((previsions.benefice?.slope || 0) * 100) / 100,
    },
  };
};

// ─── Performance Production ───────────────────────────────────────────────────

const getPerformanceProduction = async (params = {}) => {
  const dateDebut = params.dateDebut ? new Date(params.dateDebut) : subMonths(new Date(), 3);
  const dateFin = params.dateFin ? new Date(params.dateFin) : new Date();

  const productions = await prisma.production.findMany({
    where: { createdAt: { gte: dateDebut, lte: dateFin }, statut: 'TERMINE' },
    include: {
      commande: { select: { nomClient: true, typeBeton: true, montantCommande: true } },
      operateur: { select: { prenom: true, nom: true } },
    },
  });

  // Rendement global
  const rendementMoyen = productions.length > 0
    ? productions.reduce((a, p) => a + (p.rendement || 0), 0) / productions.length : 0;

  const volumeTotalPlanifie = productions.reduce((a, p) => a + (p.volumePlanifie || 0), 0);
  const volumeTotalReel = productions.reduce((a, p) => a + (p.volumeProduit || 0), 0);

  // Performance par opérateur
  const operateurMap = {};
  productions.forEach((p) => {
    const k = p.operateurId;
    if (!operateurMap[k]) {
      operateurMap[k] = {
        nom: `${p.operateur?.prenom} ${p.operateur?.nom}`,
        productions: 0, volumePlanifie: 0, volumeReel: 0,
        gasoil: 0, dureeTotal: 0,
      };
    }
    const op = operateurMap[k];
    op.productions++;
    op.volumePlanifie += p.volumePlanifie || 0;
    op.volumeReel += p.volumeProduit || 0;
    op.gasoil += p.gasoilConsomme || 0;
    op.dureeTotal += p.dureeHeures || 0;
  });

  const operateurs = Object.values(operateurMap).map((op) => ({
    ...op,
    rendement: op.volumePlanifie > 0 ? Math.round((op.volumeReel / op.volumePlanifie) * 10000) / 100 : 0,
    productiviteM3H: op.dureeTotal > 0 ? Math.round((op.volumeReel / op.dureeTotal) * 100) / 100 : 0,
    coutGasoilM3: op.volumeReel > 0 ? Math.round((op.gasoil * 675) / op.volumeReel) : 0,
  })).sort((a, b) => b.volumeReel - a.volumeReel);

  // Livraisons performance
  const livraisons = await prisma.livraison.findMany({
    where: { createdAt: { gte: dateDebut, lte: dateFin }, statut: 'LIVREE' },
    select: { chauffeur: true, dureeTrajet: true, volumeReel: true, volumePlanifie: true },
  });

  const chauffeurMap = {};
  livraisons.forEach((l) => {
    const k = l.chauffeur || 'Inconnu';
    if (!chauffeurMap[k]) chauffeurMap[k] = { nom: k, livraisons: 0, dureeTotal: 0, volume: 0 };
    const c = chauffeurMap[k];
    c.livraisons++;
    c.dureeTotal += l.dureeTrajet || 0;
    c.volume += l.volumeReel || 0;
  });

  const chauffeurs = Object.values(chauffeurMap).map((c) => ({
    ...c,
    dureeMoyenne: c.livraisons > 0 ? Math.round(c.dureeTotal / c.livraisons) : 0,
  })).sort((a, b) => b.livraisons - a.livraisons);

  return {
    global: {
      productions: productions.length,
      rendementMoyen: Math.round(rendementMoyen * 100) / 100,
      volumePlanifie: Math.round(volumeTotalPlanifie * 100) / 100,
      volumeReel: Math.round(volumeTotalReel * 100) / 100,
      ecartVolume: Math.round((volumeTotalReel - volumeTotalPlanifie) * 100) / 100,
    },
    operateurs,
    chauffeurs,
  };
};

// ─── Analyse Paiements & Créances ─────────────────────────────────────────────

const getAnalysePaiements = async () => {
  const commandes = await prisma.commande.findMany({
    where: { statut: { in: ['LIVREE', 'EN_PRODUCTION', 'VALIDEE'] }, montantCommande: { gt: 0 } },
    select: {
      id: true, reference: true, nomClient: true, telephone: true,
      montantCommande: true, montantPaye: true, montantRestant: true,
      dateLivraison: true, statut: true, createdAt: true,
      paiements: { where: { statut: 'PAYE' }, select: { montant: true, datePaiement: true, modePaiement: true } },
    },
  });

  const now = new Date();
  const creances = commandes
    .map((c) => {
      const totalPaye = c.paiements.reduce((a, p) => a + p.montant, 0);
      const restant = (c.montantCommande || 0) - totalPaye;
      const joursDepuisLivraison = c.dateLivraison
        ? Math.floor((now - new Date(c.dateLivraison)) / 86400000) : 0;
      return {
        ...c,
        totalPaye,
        restant,
        joursDepuisLivraison,
        enRetard: restant > 0 && joursDepuisLivraison > 30,
        risque: joursDepuisLivraison > 90 ? 'ELEVE' : joursDepuisLivraison > 30 ? 'MOYEN' : 'FAIBLE',
      };
    })
    .filter((c) => c.restant > 100)
    .sort((a, b) => b.restant - a.restant);

  const totalCreances = creances.reduce((a, c) => a + c.restant, 0);
  const creancesEnRetard = creances.filter((c) => c.enRetard);
  const totalEnRetard = creancesEnRetard.reduce((a, c) => a + c.restant, 0);

  // Mode de paiement préféré
  const tousLesPayements = await prisma.paiement.findMany({
    where: { statut: 'PAYE' },
    select: { modePaiement: true, montant: true },
  });

  const modeStats = {};
  tousLesPayements.forEach((p) => {
    if (!modeStats[p.modePaiement]) modeStats[p.modePaiement] = { mode: p.modePaiement, count: 0, montant: 0 };
    modeStats[p.modePaiement].count++;
    modeStats[p.modePaiement].montant += p.montant;
  });

  return {
    creances: creances.slice(0, 20),
    statistiques: {
      totalCreances: Math.round(totalCreances),
      totalEnRetard: Math.round(totalEnRetard),
      nbCreances: creances.length,
      nbEnRetard: creancesEnRetard.length,
      tauxRecouvrement: creances.length > 0
        ? Math.round((commandes.reduce((a, c) => a + (c.montantPaye || 0), 0) /
            commandes.reduce((a, c) => a + (c.montantCommande || 0), 0)) * 10000) / 100
        : 0,
    },
    modesPaiement: Object.values(modeStats).sort((a, b) => b.montant - a.montant),
  };
};

module.exports = {
  getKPIsTempsReel,
  getTendancesMensuelles,
  getRentabiliteParClient,
  getRentabiliteParTypeBeton,
  getConsommationsMatieres,
  getPrevisionsbudgetaires,
  getPerformanceProduction,
  getAnalysePaiements,
};
