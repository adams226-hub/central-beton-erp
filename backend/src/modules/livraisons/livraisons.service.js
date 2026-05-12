const { PrismaClient } = require('@prisma/client');
const { emitToAll, emitToUser } = require('../../config/socket');

const prisma = new PrismaClient();

const genRef = () => `LIV-${Date.now().toString().slice(-8)}`;

const lister = async (filters = {}) => {
  const where = {};
  if (filters.statut) where.statut = filters.statut;
  if (filters.productionId) where.productionId = filters.productionId;
  if (filters.commandeId) where.commandeId = filters.commandeId;

  return prisma.livraison.findMany({
    where,
    include: {
      production: { select: { reference: true } },
      commande: { select: { reference: true, nomClient: true, adresseChantier: true } },
      toupie: { select: { nom: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: parseInt(filters.limit) || 50,
  });
};

const getPlanning = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.livraison.findMany({
    where: { statut: { in: ['PLANIFIEE', 'EN_ROUTE'] } },
    include: {
      commande: { select: { reference: true, nomClient: true, adresseChantier: true, dateLivraison: true } },
      toupie: { select: { nom: true, code: true } },
    },
    orderBy: { heureDepart: 'asc' },
  });
};

const getOne = async (id) => {
  const l = await prisma.livraison.findUnique({
    where: { id },
    include: {
      production: true,
      commande: { select: { reference: true, nomClient: true, adresseChantier: true } },
      toupie: true,
    },
  });
  if (!l) throw Object.assign(new Error('Livraison introuvable'), { statusCode: 404 });
  return l;
};

const planifier = async (data, userId) => {
  return prisma.livraison.create({
    data: {
      reference: genRef(),
      productionId: data.productionId,
      commandeId: data.commandeId,
      toupieId: data.toupieId,
      chauffeur: data.chauffeur,
      telephone: data.telephone,
      volumePlanifie: parseFloat(data.volumePlanifie),
      heureDepart: data.heureDepart ? new Date(data.heureDepart) : null,
      adresseChantier: data.adresseChantier,
      observations: data.observations,
    },
  });
};

const changerStatut = async (id, statut, userId) => {
  const livraison = await prisma.livraison.findUnique({ where: { id } });
  const updateData = { statut };

  if (statut === 'EN_ROUTE') updateData.heureDepart = new Date();
  if (statut === 'LIVREE') updateData.heureArrivee = new Date();
  if (statut === 'EN_ROUTE' && livraison.toupieId) {
    await prisma.equipement.update({ where: { id: livraison.toupieId }, data: { statut: 'EN_SERVICE' } });
  }
  if (statut === 'LIVREE' && livraison.toupieId) {
    await prisma.equipement.update({ where: { id: livraison.toupieId }, data: { statut: 'DISPONIBLE' } });
  }

  const updated = await prisma.livraison.update({ where: { id }, data: updateData });
  emitToAll('livraison:statut_change', { livraisonId: id, statut, reference: livraison.reference });
  return updated;
};

const confirmerLivraison = async (id, data, userId) => {
  const liv = await prisma.livraison.findUnique({
    where: { id },
    include: { commande: true },
  });
  if (!liv) throw Object.assign(new Error('Livraison introuvable'), { statusCode: 404 });

  const dureeMin = liv.heureDepart ? Math.round((new Date() - liv.heureDepart) / 60000) : null;

  const updated = await prisma.livraison.update({
    where: { id },
    data: {
      statut: 'LIVREE',
      volumeReel: parseFloat(data.volumeReel),
      heureArrivee: new Date(),
      dureeTrajet: dureeMin,
      bonLivraison: data.bonLivraison,
      observations: data.observations || liv.observations,
    },
  });

  // Libérer la toupie
  if (liv.toupieId) {
    await prisma.equipement.update({ where: { id: liv.toupieId }, data: { statut: 'DISPONIBLE' } });
  }

  emitToUser(liv.commande.createdById, 'notification:nouvelle', {
    type: 'COMMANDE_LIVREE',
    message: `Livraison confirmée : ${data.volumeReel} m³ livrés — Commande ${liv.commande.reference}`,
  });

  return updated;
};

module.exports = { lister, getPlanning, getOne, planifier, changerStatut, confirmerLivraison };
