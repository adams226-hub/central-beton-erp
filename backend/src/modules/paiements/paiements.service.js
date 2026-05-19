const { emitToRole } = require('../../config/socket');
const prisma = require('../../config/prisma');

const genRef = () => `PAY-${Date.now().toString().slice(-8)}`;

const lister = async (filters = {}) => {
  const where = {};
  if (filters.statut) where.statut = filters.statut;
  if (filters.mode) where.modePaiement = filters.mode;
  if (filters.commandeId) where.commandeId = filters.commandeId;

  return prisma.paiement.findMany({
    where,
    include: {
      commande: { select: { reference: true, nomClient: true, montantCommande: true } },
      user: { select: { nom: true, prenom: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: parseInt(filters.limit) || 100,
  });
};

const getParCommande = async (commandeId) => {
  const [paiements, commande] = await prisma.$transaction([
    prisma.paiement.findMany({
      where: { commandeId },
      include: { user: { select: { nom: true, prenom: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.commande.findUnique({
      where: { id: commandeId },
      select: { reference: true, nomClient: true, montantCommande: true, montantPaye: true, montantRestant: true },
    }),
  ]);

  const totalPaye = paiements.filter((p) => p.statut === 'PAYE').reduce((a, p) => a + p.montant, 0);
  const restant = (commande?.montantCommande || 0) - totalPaye;

  return { paiements, commande, totalPaye, restant };
};

const getCreances = async () => {
  const commandes = await prisma.commande.findMany({
    where: {
      statut: { in: ['VALIDEE', 'EN_PRODUCTION', 'LIVREE'] },
      montantCommande: { gt: 0 },
    },
    select: {
      id: true, reference: true, nomClient: true, telephone: true,
      montantCommande: true, montantPaye: true, montantRestant: true, dateLivraison: true,
      paiements: { where: { statut: 'PAYE' }, select: { montant: true, datePaiement: true } },
    },
    orderBy: { dateLivraison: 'asc' },
  });

  return commandes
    .map((c) => {
      const paye = c.paiements.reduce((a, p) => a + p.montant, 0);
      const restant = (c.montantCommande || 0) - paye;
      const jours = Math.floor((new Date() - new Date(c.dateLivraison)) / 86400000);
      return { ...c, totalPaye: paye, resteAPayer: restant, joursDepuisLivraison: jours, enRetard: restant > 0 && jours > 30 };
    })
    .filter((c) => c.resteAPayer > 0);
};

const getStatistiques = async () => {
  const [totalEncaisse, enAttente, enRetard, mois] = await prisma.$transaction([
    prisma.paiement.aggregate({ where: { statut: 'PAYE' }, _sum: { montant: true } }),
    prisma.paiement.aggregate({ where: { statut: 'EN_ATTENTE' }, _sum: { montant: true } }),
    prisma.paiement.count({ where: { statut: 'EN_ATTENTE', dateEcheance: { lt: new Date() } } }),
    prisma.paiement.aggregate({
      where: { statut: 'PAYE', datePaiement: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      _sum: { montant: true },
    }),
  ]);

  return {
    totalEncaisse: totalEncaisse._sum.montant || 0,
    enAttente: enAttente._sum.montant || 0,
    enRetard,
    encaisseMois: mois._sum.montant || 0,
  };
};

const enregistrer = async (data, userId) => {
  const commande = await prisma.commande.findUnique({ where: { id: data.commandeId } });
  if (!commande) throw Object.assign(new Error('Commande introuvable'), { statusCode: 404 });

  const paiement = await prisma.paiement.create({
    data: {
      reference: genRef(),
      commandeId: data.commandeId,
      montant: parseFloat(data.montant),
      modePaiement: data.modePaiement,
      statut: data.statut || 'EN_ATTENTE',
      reference_ext: data.reference_ext,
      banque: data.banque,
      dateEcheance: data.dateEcheance ? new Date(data.dateEcheance) : null,
      datePaiement: data.statut === 'PAYE' ? new Date() : null,
      notes: data.notes,
      userId,
    },
  });

  // Mettre à jour les montants sur la commande
  if (data.statut === 'PAYE') await _majMontantsCommande(data.commandeId);

  await prisma.activite.create({
    data: {
      userId,
      type: 'PAIEMENT_ENREGISTRE',
      action: `Paiement enregistré : ${parseFloat(data.montant).toLocaleString('fr-FR')} FCFA — Commande ${commande.reference}`,
      details: { paiementId: paiement.id, commandeId: data.commandeId },
    },
  });

  emitToRole('COMPTABLE', 'paiement:nouveau', { paiementId: paiement.id, montant: data.montant });
  return paiement;
};

const confirmer = async (id, userId) => {
  const p = await prisma.paiement.findUnique({ where: { id } });
  if (!p) throw Object.assign(new Error('Paiement introuvable'), { statusCode: 404 });

  const updated = await prisma.paiement.update({
    where: { id },
    data: { statut: 'PAYE', datePaiement: new Date() },
  });

  await _majMontantsCommande(p.commandeId);
  return updated;
};

const annuler = async (id, userId) => {
  const updated = await prisma.paiement.update({
    where: { id },
    data: { statut: 'ANNULE' },
  });
  await _majMontantsCommande(updated.commandeId);
  return updated;
};

const _majMontantsCommande = async (commandeId) => {
  const commande = await prisma.commande.findUnique({ where: { id: commandeId } });
  const paiements = await prisma.paiement.findMany({ where: { commandeId, statut: 'PAYE' } });
  const totalPaye = paiements.reduce((a, p) => a + p.montant, 0);
  const restant = Math.max(0, (commande.montantCommande || 0) - totalPaye);
  await prisma.commande.update({
    where: { id: commandeId },
    data: { montantPaye: totalPaye, montantRestant: restant },
  });
};

module.exports = { lister, getParCommande, getCreances, getStatistiques, enregistrer, confirmer, annuler };
