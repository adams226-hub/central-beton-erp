const { calculerBesoinsCommande } = require('../../utils/calculations');
const { emitToAll } = require('../../config/socket');
const prisma = require('../../config/prisma');
const parametresService = require('../parametres/parametres.service');

const lister = async (activeOnly = true) => {
  return prisma.formulation.findMany({
    where: activeOnly ? { isActive: true } : {},
    include: { createdBy: { select: { nom: true, prenom: true } } },
    orderBy: { createdAt: 'desc' },
  });
};

const getOne = async (id) => {
  const f = await prisma.formulation.findUnique({
    where: { id },
    include: { createdBy: { select: { nom: true, prenom: true } } },
  });
  if (!f) throw Object.assign(new Error('Formulation introuvable'), { statusCode: 404 });
  return f;
};

const getHistorique = async (id) => {
  return prisma.formulationHistorique.findMany({
    where: { formulationId: id },
    include: { modificateur: { select: { nom: true, prenom: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });
};

const creer = async (data, userId) => {
  // Vérifier si un typeBeton identique existe déjà
  const existante = await prisma.formulation.findUnique({ where: { typeBeton: data.typeBeton } });
  if (existante) {
    throw Object.assign(
      new Error(`Une formulation "${data.typeBeton}" existe déjà. Modifiez la formulation existante.`),
      { statusCode: 400 }
    );
  }

  // Calculer le coût unitaire automatiquement
  const coutMateriaux = calculerCoutUnitaire(data);

  const formulation = await prisma.formulation.create({
    data: {
      nom: data.nom,
      typeBeton: data.typeBeton,
      description: data.description,
      ciment: parseFloat(data.ciment),
      sable: parseFloat(data.sable),
      gravier515: parseFloat(data.gravier515),
      gravier1525: parseFloat(data.gravier1525),
      eau: parseFloat(data.eau),
      hydrofuge:    parseFloat(data.hydrofuge    || 0),
      retardateur:  parseFloat(data.retardateur  || 0),
      accelerateur: parseFloat(data.accelerateur || 0),
      powerflow:    parseFloat(data.powerflow    || 0),
      prixCiment:      parseFloat(data.prixCiment),
      prixSable:       parseFloat(data.prixSable),
      prixGravier515:  parseFloat(data.prixGravier515),
      prixGravier1525: parseFloat(data.prixGravier1525),
      prixEau:         parseFloat(data.prixEau         || 0),
      prixHydrofuge:   parseFloat(data.prixHydrofuge   || 2750),
      prixRetardateur: parseFloat(data.prixRetardateur || 0),
      prixAccelerateur:parseFloat(data.prixAccelerateur|| 0),
      prixPowerflow:   parseFloat(data.prixPowerflow   || 1750),
      coutUnitaire: coutMateriaux,
      createdById: userId,
    },
  });

  await prisma.activite.create({
    data: { userId, type: 'CREATION_FORMULATION', action: `Formulation créée : ${data.nom}`, details: { formulationId: formulation.id } },
  });

  emitToAll('formulation:nouvelle', { id: formulation.id, nom: formulation.nom, typeBeton: formulation.typeBeton });
  return formulation;
};

const modifier = async (id, data, userId, motif) => {
  const existante = await prisma.formulation.findUnique({ where: { id } });
  if (!existante) throw Object.assign(new Error('Formulation introuvable'), { statusCode: 404 });

  // Sauvegarder dans l'historique
  await prisma.formulationHistorique.create({
    data: {
      formulationId: id,
      version: existante.version,
      donnees: JSON.parse(JSON.stringify(existante)),
      motifModif: motif || 'Mise à jour',
      modifiePar: userId,
    },
  });

  const coutUnitaire = calculerCoutUnitaire({ ...existante, ...data });

  const updated = await prisma.formulation.update({
    where: { id },
    data: {
      ...(data.nom && { nom: data.nom }),
      ...(data.typeBeton && { typeBeton: data.typeBeton }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.ciment && { ciment: parseFloat(data.ciment) }),
      ...(data.sable && { sable: parseFloat(data.sable) }),
      ...(data.gravier515 && { gravier515: parseFloat(data.gravier515) }),
      ...(data.gravier1525 && { gravier1525: parseFloat(data.gravier1525) }),
      ...(data.eau && { eau: parseFloat(data.eau) }),
      ...(data.hydrofuge    !== undefined && { hydrofuge:    parseFloat(data.hydrofuge) }),
      ...(data.retardateur  !== undefined && { retardateur:  parseFloat(data.retardateur) }),
      ...(data.accelerateur !== undefined && { accelerateur: parseFloat(data.accelerateur) }),
      ...(data.powerflow    !== undefined && { powerflow:    parseFloat(data.powerflow) }),
      ...(data.prixCiment      && { prixCiment:      parseFloat(data.prixCiment) }),
      ...(data.prixSable       && { prixSable:       parseFloat(data.prixSable) }),
      ...(data.prixGravier515  && { prixGravier515:  parseFloat(data.prixGravier515) }),
      ...(data.prixGravier1525 && { prixGravier1525: parseFloat(data.prixGravier1525) }),
      ...(data.prixHydrofuge   !== undefined && { prixHydrofuge:   parseFloat(data.prixHydrofuge) }),
      ...(data.prixRetardateur !== undefined && { prixRetardateur: parseFloat(data.prixRetardateur) }),
      ...(data.prixAccelerateur!== undefined && { prixAccelerateur:parseFloat(data.prixAccelerateur) }),
      ...(data.prixPowerflow   !== undefined && { prixPowerflow:   parseFloat(data.prixPowerflow) }),
      coutUnitaire,
      version: existante.version + 1,
    },
  });

  await prisma.activite.create({
    data: { userId, type: 'MODIFICATION_FORMULATION', action: `Formulation v${existante.version + 1} : ${existante.nom}`, details: { formulationId: id } },
  });

  return updated;
};

const supprimer = async (id, userId) => {
  const f = await prisma.formulation.findUnique({ where: { id } });
  if (!f) throw Object.assign(new Error('Formulation introuvable'), { statusCode: 404 });

  // Vérifier si des commandes actives utilisent cette formulation
  const commandesActives = await prisma.commande.count({
    where: { formulationId: id, statut: { notIn: ['REJETEE', 'ANNULEE', 'LIVREE'] } },
  });
  if (commandesActives > 0) {
    throw Object.assign(new Error(`Impossible de supprimer : ${commandesActives} commande(s) active(s) utilisent cette formulation`), { statusCode: 400 });
  }

  // Désactiver plutôt que supprimer pour préserver l'historique
  await prisma.formulation.update({ where: { id }, data: { isActive: false } });
};

const calculer = async (data) => {
  const params = await parametresService.get();
  return calculerBesoinsCommande(data.volume, data.formulation, data.montantCommande || 0, data.distanceLivraison || 0, params, data.remisePct || 0, data.options || {});
};

const calculerCoutUnitaire = (f) => {
  const coutCiment = f.ciment * f.prixCiment;
  const coutSable = f.sable * f.prixSable;
  const coutGravier515 = f.gravier515 * f.prixGravier515;
  const coutGravier1525 = f.gravier1525 * f.prixGravier1525;
  const coutHydrofuge = (f.hydrofuge || 0) * (f.prixHydrofuge || 2750);
  const coutPowerflow = (f.powerflow || 0) * (f.prixPowerflow || 1750);
  return Math.round(coutCiment + coutSable + coutGravier515 + coutGravier1525 + coutHydrofuge + coutPowerflow);
};

module.exports = { lister, getOne, getHistorique, creer, modifier, supprimer, calculer };
