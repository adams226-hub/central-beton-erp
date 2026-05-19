const { emitToAll, emitToUser } = require('../../config/socket');
const prisma = require('../../config/prisma');

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
  // Normalisation des noms de champs (compat frontend)
  const toupieId = data.toupieId || data.equipementId || null;
  const heurePlanifiee = data.heureDepart || data.datePlanifiee;
  const adresse = data.adresseChantier || data.adresseLivraison;
  const observations = data.observations || data.notes;

  // Charger la commande pour récupérer volume + adresse + productionId
  const commande = await prisma.commande.findUnique({
    where: { id: data.commandeId },
    include: {
      productions: {
        where: { statut: { in: ['EN_COURS', 'TERMINE'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!commande) throw Object.assign(new Error('Commande introuvable'), { statusCode: 404 });

  const productionId = data.productionId || commande.productions[0]?.id;
  if (!productionId) throw Object.assign(new Error('Aucune production en cours pour cette commande — démarrez la production d\'abord'), { statusCode: 400 });

  return prisma.livraison.create({
    data: {
      reference: genRef(),
      productionId,
      commandeId: data.commandeId,
      toupieId: toupieId || undefined,
      chauffeur: data.chauffeur || null,
      telephone: data.telephone || null,
      volumePlanifie: parseFloat(data.volumePlanifie) || commande.volumeBeton,
      heureDepart: heurePlanifiee ? new Date(heurePlanifiee) : null,
      adresseChantier: adresse || commande.adresseChantier,
      observations: observations || null,
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

  // Calculer le volume total livré pour cette commande
  const toutesLivraisons = await prisma.livraison.findMany({
    where: { commandeId: liv.commandeId, statut: 'LIVREE' },
    select: { volumeReel: true },
  });
  const volumeTotalLivre = toutesLivraisons.reduce((s, l) => s + (l.volumeReel || 0), 0);

  // Marquer la commande LIVREE seulement quand tout le volume commandé est livré
  if (volumeTotalLivre >= liv.commande.volumeBeton) {
    await prisma.commande.update({
      where: { id: liv.commandeId },
      data: { statut: 'LIVREE' },
    });
  }

  emitToUser(liv.commande.createdById, 'notification:nouvelle', {
    type: 'COMMANDE_LIVREE',
    message: `Livraison confirmée : ${data.volumeReel} m³ livrés — Commande ${liv.commande.reference}`,
  });

  return updated;
};

module.exports = { lister, getPlanning, getOne, planifier, changerStatut, confirmerLivraison };
