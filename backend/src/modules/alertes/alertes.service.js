const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Génération automatique des alertes ─────────────────────────────────────

const genererAlertes = async () => {
  const alertes = [];
  const now = new Date();

  // 1. Alertes stock
  const stocks = await prisma.stockMatiere.findMany();
  for (const s of stocks) {
    if (s.quantite <= s.seuilCritique) {
      alertes.push({
        type: 'STOCK_CRITIQUE',
        niveau: 'CRITIQUE',
        titre: `Stock critique : ${s.designation}`,
        message: `Le stock de ${s.designation} est à ${s.quantite.toLocaleString('fr-FR')} ${s.unite}, en dessous du seuil critique (${s.seuilCritique.toLocaleString('fr-FR')} ${s.unite}).`,
        entiteType: 'STOCK',
        entiteId: s.id,
        donnees: { quantite: s.quantite, seuil: s.seuilCritique, unite: s.unite },
      });
    } else if (s.quantite <= s.seuilAlerte) {
      alertes.push({
        type: 'STOCK_FAIBLE',
        niveau: 'AVERTISSEMENT',
        titre: `Stock faible : ${s.designation}`,
        message: `Le stock de ${s.designation} est à ${s.quantite.toLocaleString('fr-FR')} ${s.unite}, proche du seuil d'alerte (${s.seuilAlerte.toLocaleString('fr-FR')} ${s.unite}).`,
        entiteType: 'STOCK',
        entiteId: s.id,
        donnees: { quantite: s.quantite, seuil: s.seuilAlerte, unite: s.unite },
      });
    }
  }

  // 2. Alertes équipements (révision dépassée)
  const equipements = await prisma.equipement.findMany({ where: { isActive: true } });
  for (const e of equipements) {
    if (e.statut === 'PANNE') {
      alertes.push({
        type: 'EQUIPEMENT_PANNE',
        niveau: 'CRITIQUE',
        titre: `Panne : ${e.nom}`,
        message: `L'équipement ${e.nom} (${e.code}) est en panne et bloque la production.`,
        entiteType: 'EQUIPEMENT',
        entiteId: e.id,
        donnees: { nom: e.nom, code: e.code, statut: e.statut },
      });
    }
    if (e.prochainRevisionH && e.heuresUtilisees >= e.prochainRevisionH) {
      alertes.push({
        type: 'EQUIPEMENT_REVISION',
        niveau: 'AVERTISSEMENT',
        titre: `Révision requise : ${e.nom}`,
        message: `${e.nom} a dépassé ${e.prochainRevisionH.toLocaleString('fr-FR')} heures d'utilisation. Une révision préventive est nécessaire.`,
        entiteType: 'EQUIPEMENT',
        entiteId: e.id,
        donnees: { heuresUtilisees: e.heuresUtilisees, heuresRevision: e.prochainRevisionH },
      });
    }
  }

  // 3. Alertes paiements en retard
  const commandesImpayees = await prisma.commande.findMany({
    where: {
      statut: 'LIVREE',
      dateLivraison: { lt: new Date(now.getTime() - 30 * 86400000) },
      montantRestant: { gt: 0 },
    },
    select: { id: true, reference: true, nomClient: true, montantRestant: true, dateLivraison: true },
  });

  for (const c of commandesImpayees) {
    const joursRetard = Math.floor((now - new Date(c.dateLivraison)) / 86400000);
    const niveau = joursRetard > 90 ? 'CRITIQUE' : 'AVERTISSEMENT';
    alertes.push({
      type: 'PAIEMENT_RETARD',
      niveau,
      titre: `Impayé : ${c.nomClient}`,
      message: `La commande ${c.reference} (${c.nomClient}) a un solde impayé de ${c.montantRestant?.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 })} depuis ${joursRetard} jours.`,
      entiteType: 'COMMANDE',
      entiteId: c.id,
      donnees: { reference: c.reference, montantRestant: c.montantRestant, joursRetard },
    });
  }

  // 4. Alertes marge faible
  const commandesMargesFaibles = await prisma.commande.findMany({
    where: {
      tauxMargeReel: { lt: 10, not: null },
      statut: 'LIVREE',
      createdAt: { gte: new Date(now.getTime() - 30 * 86400000) },
    },
    select: { id: true, reference: true, nomClient: true, tauxMargeReel: true, montantCommande: true },
  });

  for (const c of commandesMargesFaibles) {
    alertes.push({
      type: 'MARGE_FAIBLE',
      niveau: 'INFO',
      titre: `Marge faible : ${c.reference}`,
      message: `La commande ${c.reference} (${c.nomClient}) a une marge nette de ${c.tauxMargeReel?.toFixed(1)}%, en dessous du seuil cible de 10%.`,
      entiteType: 'COMMANDE',
      entiteId: c.id,
      donnees: { reference: c.reference, tauxMarge: c.tauxMargeReel },
    });
  }

  // 5. Sauvegarder les nouvelles alertes (éviter doublons actifs)
  const alertesActives = await prisma.alerteIntelligente.findMany({
    where: { resolu: false },
    select: { entiteId: true, type: true },
  });

  const clesActives = new Set(alertesActives.map((a) => `${a.type}:${a.entiteId}`));

  const nouvelles = alertes.filter((a) => {
    const cle = `${a.type}:${a.entiteId}`;
    return !clesActives.has(cle);
  });

  if (nouvelles.length > 0) {
    await prisma.alerteIntelligente.createMany({ data: nouvelles });
  }

  return { generees: nouvelles.length, total: alertes.length };
};

// ─── Lister les alertes actives ──────────────────────────────────────────────

const listerAlertes = async (params = {}) => {
  const where = {};
  if (params.resolu !== undefined) where.resolu = params.resolu === 'true';
  if (params.niveau) where.niveau = params.niveau;
  if (params.type) where.type = params.type;

  const alertes = await prisma.alerteIntelligente.findMany({
    where,
    orderBy: [
      { niveau: 'asc' }, // CRITIQUE en premier (alphabétiquement C < A < I)
      { createdAt: 'desc' },
    ],
    take: params.limit ? parseInt(params.limit) : 50,
  });

  // Trier manuellement par niveau de priorité
  const priorite = { CRITIQUE: 0, AVERTISSEMENT: 1, INFO: 2 };
  alertes.sort((a, b) => (priorite[a.niveau] || 2) - (priorite[b.niveau] || 2));

  const stats = await prisma.alerteIntelligente.groupBy({
    by: ['niveau', 'resolu'],
    _count: { id: true },
  });

  return {
    alertes,
    stats: {
      critiques: stats.find((s) => s.niveau === 'CRITIQUE' && !s.resolu)?._count.id || 0,
      avertissements: stats.find((s) => s.niveau === 'AVERTISSEMENT' && !s.resolu)?._count.id || 0,
      infos: stats.find((s) => s.niveau === 'INFO' && !s.resolu)?._count.id || 0,
      resolues: stats.filter((s) => s.resolu).reduce((a, s) => a + s._count.id, 0),
    },
  };
};

// ─── Résoudre une alerte ─────────────────────────────────────────────────────

const resoudreAlerte = async (id, userId) => {
  return prisma.alerteIntelligente.update({
    where: { id },
    data: { resolu: true, resolvedAt: new Date(), resolvedBy: userId },
  });
};

const resoudreTout = async (niveau, userId) => {
  const where = { resolu: false };
  if (niveau) where.niveau = niveau;
  return prisma.alerteIntelligente.updateMany({
    where,
    data: { resolu: true, resolvedAt: new Date(), resolvedBy: userId },
  });
};

module.exports = { genererAlertes, listerAlertes, resoudreAlerte, resoudreTout };
