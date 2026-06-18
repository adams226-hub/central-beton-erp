const { emitToRole } = require('../../config/socket');
const prisma = require('../../config/prisma');

const lister = async (filters = {}) => {
  const where = {};
  if (filters.type) where.type = filters.type;
  if (filters.statut) where.statut = filters.statut;
  if (filters.isActive !== undefined) where.isActive = filters.isActive !== 'false';

  return prisma.equipement.findMany({
    where,
    include: {
      maintenances: { orderBy: { createdAt: 'desc' }, take: 3 },
      _count: { select: { maintenances: true } },
    },
    orderBy: { type: 'asc' },
  });
};

const getDisponibles = async (type) => {
  return prisma.equipement.findMany({
    where: { statut: 'DISPONIBLE', isActive: true, ...(type && { type }) },
    select: { id: true, nom: true, code: true, type: true, coutHoraire: true },
  });
};

const getAmortissements = async () => {
  const equipements = await prisma.equipement.findMany({ where: { isActive: true } });
  const total = equipements.reduce((acc, e) => acc + (e.coutAcquisition - e.valeurActuelle), 0);
  return {
    equipements: equipements.map((e) => ({
      ...e,
      amortissementCumule: e.coutAcquisition - e.valeurActuelle,
      pourcentageUse: (e.heuresUtilisees / e.dureeVieHeures) * 100,
      restantHeures: e.dureeVieHeures - e.heuresUtilisees,
    })),
    totalAmorti: total,
    valeurTotaleActuelle: equipements.reduce((a, e) => a + e.valeurActuelle, 0),
    valeurAcquisitionTotale: equipements.reduce((a, e) => a + e.coutAcquisition, 0),
  };
};

const getOne = async (id) => {
  const e = await prisma.equipement.findUnique({
    where: { id },
    include: {
      maintenances: { include: { user: { select: { nom: true, prenom: true } } }, orderBy: { dateDebut: 'desc' } },
    },
  });
  if (!e) throw Object.assign(new Error('Équipement introuvable'), { statusCode: 404 });
  return {
    ...e,
    amortissementCumule: e.coutAcquisition - e.valeurActuelle,
    pourcentageUse: Math.round((e.heuresUtilisees / e.dureeVieHeures) * 100),
    alerte: e.prochainRevisionH && e.heuresUtilisees >= e.prochainRevisionH,
  };
};

const getMaintenances = async (equipementId) => {
  return prisma.maintenanceEquipement.findMany({
    where: { equipementId },
    include: { user: { select: { nom: true, prenom: true } } },
    orderBy: { dateDebut: 'desc' },
  });
};

const creer = async (data, userId) => {
  const coutHoraire = parseFloat(data.coutAcquisition) / parseFloat(data.dureeVieHeures);
  const prochainRevisionH = data.heuresRevision ? parseFloat(data.heuresRevision) : null;

  const equipement = await prisma.equipement.create({
    data: {
      nom: data.nom,
      code: data.code,
      type: data.type,
      marque: data.marque,
      modele: data.modele,
      numeroSerie: data.numeroSerie,
      anneeAchat: data.anneeAchat ? parseInt(data.anneeAchat) : null,
      coutAcquisition: parseFloat(data.coutAcquisition),
      dureeVieHeures: parseFloat(data.dureeVieHeures),
      coutHoraire: Math.round(coutHoraire * 100) / 100,
      valeurActuelle: parseFloat(data.coutAcquisition),
      heuresRevision: data.heuresRevision ? parseFloat(data.heuresRevision) : null,
      prochainRevisionH,
      consoCarburantHeure: data.consoCarburantHeure ? parseFloat(data.consoCarburantHeure) : null,
    },
  });

  return equipement;
};

const modifier = async (id, data, userId) => {
  const existant = await prisma.equipement.findUnique({ where: { id } });
  if (!existant) throw Object.assign(new Error('Équipement introuvable'), { statusCode: 404 });

  const coutHoraire = data.coutAcquisition && data.dureeVieHeures
    ? parseFloat(data.coutAcquisition) / parseFloat(data.dureeVieHeures)
    : existant.coutHoraire;

  return prisma.equipement.update({
    where: { id },
    data: {
      ...(data.nom && { nom: data.nom }),
      ...(data.marque && { marque: data.marque }),
      ...(data.modele && { modele: data.modele }),
      ...(data.coutAcquisition && { coutAcquisition: parseFloat(data.coutAcquisition), coutHoraire }),
      ...(data.dureeVieHeures && { dureeVieHeures: parseFloat(data.dureeVieHeures), coutHoraire }),
      ...(data.consoCarburantHeure !== undefined && { consoCarburantHeure: parseFloat(data.consoCarburantHeure) }),
    },
  });
};

const changerStatut = async (id, statut, userId) => {
  const updated = await prisma.equipement.update({ where: { id }, data: { statut } });
  if (statut === 'PANNE') {
    emitToRole('CHEF_DE_SITE', 'equipement:panne', { equipementId: id, nom: updated.nom });
  }
  return updated;
};

const enregistrerMaintenance = async (equipementId, data, userId) => {
  const equip = await prisma.equipement.findUnique({ where: { id: equipementId } });
  if (!equip) throw Object.assign(new Error('Équipement introuvable'), { statusCode: 404 });

  const maintenance = await prisma.maintenanceEquipement.create({
    data: {
      equipementId,
      type: data.type,
      description: data.description,
      cout: parseFloat(data.cout || 0),
      heuresArret: data.heuresArret ? parseFloat(data.heuresArret) : null,
      dateDebut: new Date(data.dateDebut),
      dateFin: data.dateFin ? new Date(data.dateFin) : null,
      technicien: data.technicien,
      fournisseur: data.fournisseur,
      observations: data.observations,
      userId,
    },
  });

  // Mettre à jour la date de dernière révision si c'est une révision
  if (data.type === 'REVISION' || data.type === 'PREVENTIVE') {
    await prisma.equipement.update({
      where: { id: equipementId },
      data: {
        derniereRevision: new Date(data.dateDebut),
        prochainRevisionH: equip.heuresRevision ? equip.heuresUtilisees + equip.heuresRevision : null,
        statut: data.dateFin ? 'DISPONIBLE' : 'MAINTENANCE',
      },
    });
  } else {
    await prisma.equipement.update({
      where: { id: equipementId },
      data: { statut: data.dateFin ? 'DISPONIBLE' : 'MAINTENANCE' },
    });
  }

  await prisma.activite.create({
    data: {
      userId,
      type: 'MAINTENANCE_EQUIPEMENT',
      action: `Maintenance ${data.type} : ${equip.nom} — Coût : ${data.cout || 0} FCFA`,
      details: { equipementId, maintenanceId: maintenance.id, cout: data.cout },
    },
  });

  return maintenance;
};

const desactiver = async (id, userId) => {
  const equip = await prisma.equipement.findUnique({ where: { id } });
  if (!equip) throw Object.assign(new Error('Équipement introuvable'), { statusCode: 404 });
  return prisma.equipement.update({ where: { id }, data: { isActive: false, statut: 'HORS_SERVICE' } });
};

const reactiver = async (id) => {
  return prisma.equipement.update({ where: { id }, data: { isActive: true, statut: 'DISPONIBLE' } });
};

module.exports = { lister, getDisponibles, getAmortissements, getOne, getMaintenances, creer, modifier, changerStatut, enregistrerMaintenance, desactiver, reactiver };
