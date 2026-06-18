const { calculerBesoinsCommande, genererReferenceCommande } = require('../../utils/calculations');
const { emitToUser, emitToRole } = require('../../config/socket');
const { envoyerNotifValidation, envoyerEmail } = require('../../utils/email');
const logger = require('../../config/logger');
const prisma = require('../../config/prisma');
const parametresService = require('../parametres/parametres.service');
const { notifierCommande } = require('../../../whatsapp');

// Ordre du workflow de validation (5 étapes)
// Secrétaire → Chef de site → Assistant Comptable → Chef Comptable → VALIDÉE (→ PDG notifié)
const WORKFLOW = {
  EN_ATTENTE_SECRETAIRE:           { next: 'EN_ATTENTE_CHEF_SITE',              role: 'SECRETAIRE',          etape: 1 },
  EN_ATTENTE_CHEF_SITE:            { next: 'EN_ATTENTE_ASSISTANT_COMPTABLE',    role: 'CHEF_DE_SITE',        etape: 2 },
  EN_ATTENTE_ASSISTANT_COMPTABLE:  { next: 'EN_ATTENTE_CHEF_COMPTABLE',         role: 'ASSISTANT_COMPTABLE', etape: 3 },
  EN_ATTENTE_CHEF_COMPTABLE:       { next: 'VALIDEE',                           role: 'CHEF_COMPTABLE',      etape: 4 },
};

const listerCommandes = async (user, filters = {}) => {
  const where = {};
  if (filters.statut) where.statut = filters.statut;
  if (filters.search) {
    where.OR = [
      { nomClient: { contains: filters.search, mode: 'insensitive' } },
      { reference: { contains: filters.search, mode: 'insensitive' } },
      { adresseChantier: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  // Secrétaire : voit ses propres commandes + toutes les commandes actives du workflow
  if (user.role === 'SECRETAIRE') {
    where.OR = [
      { createdById: user.id },
      { statut: { in: ['EN_ATTENTE_SECRETAIRE', 'VALIDEE', 'EN_PRODUCTION', 'LIVREE', 'REJETEE'] } },
    ];
  }

  const [commandes, total] = await prisma.$transaction([
    prisma.commande.findMany({
      where,
      include: {
        createdBy: { select: { nom: true, prenom: true, role: true } },
        formulation: { select: { nom: true, typeBeton: true } },
        validations: { include: { valideur: { select: { nom: true, prenom: true, role: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ? parseInt(filters.limit) : 50,
      skip: filters.page ? (parseInt(filters.page) - 1) * (parseInt(filters.limit) || 50) : 0,
    }),
    prisma.commande.count({ where }),
  ]);

  return { commandes, total, page: filters.page || 1 };
};

const getCommande = async (id) => {
  const commande = await prisma.commande.findUnique({
    where: { id },
    include: {
      createdBy: { select: { nom: true, prenom: true, role: true, email: true } },
      formulation: true,
      validations: {
        include: { valideur: { select: { nom: true, prenom: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
      livraisons: {
        select: {
          id: true, reference: true, statut: true,
          volumePlanifie: true, volumeReel: true,
          heureDepart: true, heureArrivee: true,
          chauffeur: true,
          toupie: { select: { nom: true, code: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      paiements: {
        select: {
          id: true, reference: true, statut: true,
          montant: true, modePaiement: true,
          dateEcheance: true, datePaiement: true,
          notes: true, createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!commande) throw Object.assign(new Error('Commande introuvable'), { statusCode: 404 });
  return commande;
};

const creerCommande = async (data, userId) => {
  const formulation = data.formulationId
    ? await prisma.formulation.findUnique({ where: { id: data.formulationId } })
    : await prisma.formulation.findFirst({ where: { typeBeton: data.typeBeton, isActive: true } });

  if (!formulation) throw Object.assign(new Error('Formulation introuvable pour ce type de béton'), { statusCode: 400 });

  const params = await parametresService.get();
  const cmdOptions = { includePersonnel: data.includePersonnel, includeRestauration: data.includeRestauration, fraisPeage: data.fraisPeage, autresFrais: data.autresFrais };
  const calculs = calculerBesoinsCommande(data.volumeBeton, formulation, data.montantCommande || 0, data.distanceLivraison || 0, params, data.remisePct || 0, cmdOptions);
  const reference = genererReferenceCommande();

  // Exclure les champs non-Prisma du spread (PDF-only ou charges d'exploitation)
  const {
    fraisRestauration, fraisLoyer, fraisImpots, fraisAutresCharges,
    coutCiment, coutTransportCiment, coutSable, coutGravier515, coutGravier1525, coutPowerflow,
    coutHydrofuge, coutRetardateur, coutAccelerateur,
    totalHydrofuge, totalRetardateur, totalAccelerateur,
    gasoilGroupeL, gasoilToupieL, gasoilChargeurL, gasoilPompeL, prixGasoil, prixTransportCiment,
    amortToupieRate, amortToupieH, amortToupieF,
    amortPompeRate, amortPompeH, amortPompeF,
    amortCentraleRate, amortCentraleH, amortCentraleF,
    amortGroupeRate, amortGroupeH, amortGroupeF,
    amortChargeuseRate, amortChargeuseH, amortChargeuseF,
    nbRepas, prixRepas,
    fraisSupp,
    montantRemise, montantApresRemise,
    ...calculsDB
  } = calculs;

  const commande = await prisma.commande.create({
    data: {
      reference,
      nomClient: data.nomClient,
      telephone: data.telephone,
      adresseChantier: data.adresseChantier,
      ifu: data.ifu || null,
      rccm: data.rccm || null,
      regimeImposition: data.regimeImposition || null,
      volumeBeton: parseFloat(data.volumeBeton),
      typeBeton: data.typeBeton,
      ...(data.dateLivraison ? { dateLivraison: new Date(data.dateLivraison) } : {}),
      observations: data.observations,
      statut: 'EN_ATTENTE_SECRETAIRE',
      formulationId: formulation.id,
      createdById: userId,
      montantCommande: montantApresRemise > 0 ? montantApresRemise : (data.montantCommande ? parseFloat(data.montantCommande) : null),
      remisePct: data.remisePct ? parseFloat(data.remisePct) : 0,
      distanceLivraison: data.distanceLivraison ? parseFloat(data.distanceLivraison) : 0,
      includePersonnel:    data.includePersonnel    !== undefined ? data.includePersonnel    : true,
      includeRestauration: data.includeRestauration !== undefined ? data.includeRestauration : true,
      fraisPeage:   data.fraisPeage   !== undefined ? parseFloat(data.fraisPeage)   : 0,
      autresFrais:  data.autresFrais  !== undefined ? parseFloat(data.autresFrais)  : 0,
      autresFraisLabel: data.autresFraisLabel || null,
      useRetardateur:  data.useRetardateur  !== undefined ? Boolean(data.useRetardateur)  : false,
      useAccelerateur: data.useAccelerateur !== undefined ? Boolean(data.useAccelerateur) : false,
      useHydrofuge:    data.useHydrofuge    !== undefined ? Boolean(data.useHydrofuge)    : false,
      ...calculsDB,
    },
    include: { createdBy: { select: { nom: true, prenom: true } }, formulation: true },
  });

  // Journal
  await prisma.activite.create({
    data: { userId, type: 'CREATION_COMMANDE', action: `Commande créée : ${reference}`, details: { commandeId: commande.id } },
  });

  // Notifier les secrétaires
  await notifierRole('SECRETAIRE', commande, 'NOUVELLE_COMMANDE', `Nouvelle commande à valider : ${reference}`);

  // Notifier les utilisateurs internes via WhatsApp
  notifierCommande(commande).catch((e) => logger.warn(`[WhatsApp] notif commande echec: ${e.message}`));

  logger.info(`Commande créée : ${reference} par ${userId}`);
  return commande;
};

const modifierCommande = async (id, data, userId) => {
  const commande = await prisma.commande.findUnique({ where: { id } });
  if (!commande) throw Object.assign(new Error('Commande introuvable'), { statusCode: 404 });

  if (!['BROUILLON', 'EN_ATTENTE_SECRETAIRE', 'REJETEE'].includes(commande.statut)) {
    throw Object.assign(new Error('Cette commande ne peut plus être modifiée'), { statusCode: 400 });
  }

  let calculsDB = {};
  let montantApresRemiseCalc = 0;
  if (data.volumeBeton || data.formulationId) {
    const formulation = await prisma.formulation.findUnique({
      where: { id: data.formulationId || commande.formulationId },
    });
    if (formulation) {
      const params = await parametresService.get();
      const {
        fraisRestauration, fraisLoyer, fraisImpots, fraisAutresCharges,
        coutCiment, coutTransportCiment, coutSable, coutGravier515, coutGravier1525, coutPowerflow,
        coutHydrofuge, coutRetardateur, coutAccelerateur,
        totalHydrofuge, totalRetardateur, totalAccelerateur,
        gasoilGroupeL, gasoilToupieL, gasoilChargeurL, gasoilPompeL, prixGasoil, prixTransportCiment,
        amortToupieRate, amortToupieH, amortToupieF,
        amortPompeRate, amortPompeH, amortPompeF,
        amortCentraleRate, amortCentraleH, amortCentraleF,
        amortGroupeRate, amortGroupeH, amortGroupeF,
        amortChargeuseRate, amortChargeuseH, amortChargeuseF,
        nbRepas, prixRepas,
        fraisSupp, montantRemise, montantApresRemise,
        ...rest
      } = calculerBesoinsCommande(
        data.volumeBeton || commande.volumeBeton,
        formulation,
        data.montantCommande || 0,
        data.distanceLivraison !== undefined ? data.distanceLivraison : (commande.distanceLivraison || 0),
        params,
        data.remisePct !== undefined ? data.remisePct : (commande.remisePct || 0),
        { includePersonnel: data.includePersonnel, includeRestauration: data.includeRestauration, fraisPeage: data.fraisPeage, autresFrais: data.autresFrais }
      );
      calculsDB = rest;
      montantApresRemiseCalc = montantApresRemise || 0;
    }
  }

  const updated = await prisma.commande.update({
    where: { id },
    data: {
      ...(data.nomClient && { nomClient: data.nomClient }),
      ...(data.telephone && { telephone: data.telephone }),
      ...(data.adresseChantier && { adresseChantier: data.adresseChantier }),
      ...(data.ifu !== undefined && { ifu: data.ifu || null }),
      ...(data.rccm !== undefined && { rccm: data.rccm || null }),
      ...(data.regimeImposition !== undefined && { regimeImposition: data.regimeImposition || null }),
      ...(data.volumeBeton && { volumeBeton: parseFloat(data.volumeBeton) }),
      ...(data.typeBeton && { typeBeton: data.typeBeton }),
      ...(data.dateLivraison && { dateLivraison: new Date(data.dateLivraison) }),
      ...(data.observations !== undefined && { observations: data.observations }),
      ...(montantApresRemiseCalc > 0 ? { montantCommande: montantApresRemiseCalc } : data.montantCommande ? { montantCommande: parseFloat(data.montantCommande) } : {}),
      ...(data.remisePct !== undefined && { remisePct: parseFloat(data.remisePct) || 0 }),
      ...(data.distanceLivraison !== undefined && { distanceLivraison: parseFloat(data.distanceLivraison) }),
      ...(data.useRetardateur  !== undefined && { useRetardateur:  Boolean(data.useRetardateur) }),
      ...(data.useAccelerateur !== undefined && { useAccelerateur: Boolean(data.useAccelerateur) }),
      ...(data.useHydrofuge    !== undefined && { useHydrofuge:    Boolean(data.useHydrofuge) }),
      ...calculsDB,
    },
  });

  await prisma.activite.create({
    data: { userId, type: 'MODIFICATION_COMMANDE', action: `Commande modifiée : ${commande.reference}`, details: { commandeId: id } },
  });

  return updated;
};

const validerCommande = async (commandeId, valideurId, commentaire) => {
  const commande = await prisma.commande.findUnique({ where: { id: commandeId } });
  if (!commande) throw Object.assign(new Error('Commande introuvable'), { statusCode: 404 });

  const etapeActuelle = WORKFLOW[commande.statut];
  if (!etapeActuelle) throw Object.assign(new Error('Cette commande ne peut pas être validée'), { statusCode: 400 });

  const valideur = await prisma.user.findUnique({ where: { id: valideurId } });
  if (valideur.role !== etapeActuelle.role && valideur.role !== 'PDG') {
    throw Object.assign(new Error(`Seul un ${etapeActuelle.role} peut valider à cette étape`), { statusCode: 403 });
  }

  const [, updatedCommande] = await prisma.$transaction([
    prisma.validation.create({
      data: {
        commandeId,
        valideurId,
        role: valideur.role,
        statut: 'APPROUVE',
        commentaire,
        etape: etapeActuelle.etape,
      },
    }),
    prisma.commande.update({
      where: { id: commandeId },
      data: { statut: etapeActuelle.next },
    }),
  ]);

  await prisma.activite.create({
    data: { userId: valideurId, type: 'VALIDATION_COMMANDE', action: `Commande validée (étape ${etapeActuelle.etape}) : ${commande.reference}`, details: { commandeId } },
  });

  // Quand le Chef Comptable valide → commande VALIDÉE → la production peut démarrer
  if (etapeActuelle.next === 'VALIDEE') {
    await notifierUser(commande.createdById, commande, 'COMMANDE_VALIDEE', `Commande ${commande.reference} validée par le Chef Comptable — prête pour production !`);
    await notifierRole('OPERATEUR', commande, 'COMMANDE_VALIDEE', `Nouvelle commande validée : ${commande.reference} — ${commande.volumeBeton} m³ de ${commande.typeBeton}`);
    await notifierRole('CHEF_DE_SITE', commande, 'COMMANDE_VALIDEE', `Commande ${commande.reference} validée — prête pour production`);
    // PDG est notifié mais sa validation n'est pas requise
    await notifierRole('PDG', commande, 'COMMANDE_VALIDEE', `Commande ${commande.reference} validée par le Chef Comptable et prête pour production (${commande.volumeBeton} m³)`);
  } else {
    const nextRole = WORKFLOW[etapeActuelle.next]?.role;
    if (nextRole) {
      await notifierRole(nextRole, commande, 'VALIDATION_REQUISE', `Validation requise (étape ${WORKFLOW[etapeActuelle.next].etape}) : ${commande.reference}`, etapeActuelle.next);
    }
  }

  return updatedCommande;
};

const rejeterCommande = async (commandeId, valideurId, motif) => {
  const commande = await prisma.commande.findUnique({ where: { id: commandeId } });
  if (!commande) throw Object.assign(new Error('Commande introuvable'), { statusCode: 404 });

  if (!motif) throw Object.assign(new Error('Motif de rejet obligatoire'), { statusCode: 400 });

  const etape = WORKFLOW[commande.statut];
  if (!etape) throw Object.assign(new Error('Cette commande ne peut pas être rejetée'), { statusCode: 400 });

  const valideur = await prisma.user.findUnique({ where: { id: valideurId } });
  const rolesAutorisesRejet = [etape.role, 'PDG', 'CHEF_COMPTABLE'];
  if (!rolesAutorisesRejet.includes(valideur.role)) {
    throw Object.assign(new Error(`Seul un ${etape.role} peut rejeter à cette étape`), { statusCode: 403 });
  }

  await prisma.$transaction([
    prisma.validation.create({
      data: {
        commandeId,
        valideurId,
        role: valideur.role,
        statut: 'REJETE',
        commentaire: motif,
        etape: etape?.etape || 0,
      },
    }),
    prisma.commande.update({
      where: { id: commandeId },
      data: { statut: 'REJETEE' },
    }),
  ]);

  await notifierUser(commande.createdById, commande, 'COMMANDE_REJETEE', `Commande ${commande.reference} rejetée : ${motif}`);

  await prisma.activite.create({
    data: { userId: valideurId, type: 'REJET_COMMANDE', action: `Commande rejetée : ${commande.reference} - ${motif}`, details: { commandeId } },
  });

  return { success: true };
};

const getStatistiques = async () => {
  const [total, enAttente, validees, rejetees, enProduction, livrees] = await prisma.$transaction([
    prisma.commande.count(),
    prisma.commande.count({ where: { statut: { in: ['EN_ATTENTE_SECRETAIRE', 'EN_ATTENTE_CHEF_SITE', 'EN_ATTENTE_ASSISTANT_COMPTABLE', 'EN_ATTENTE_CHEF_COMPTABLE', 'EN_ATTENTE_PDG'] } } }),
    prisma.commande.count({ where: { statut: 'VALIDEE' } }),
    prisma.commande.count({ where: { statut: 'REJETEE' } }),
    prisma.commande.count({ where: { statut: 'EN_PRODUCTION' } }),
    prisma.commande.count({ where: { statut: 'LIVREE' } }),
  ]);

  const chiffreAffaires = await prisma.commande.aggregate({
    where: { statut: { in: ['VALIDEE', 'EN_PRODUCTION', 'LIVREE'] } },
    _sum: { montantCommande: true, coutTotal: true, margePrevisionnelle: true },
  });

  const commandesMois = await prisma.commande.findMany({
    where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
    select: { volumeBeton: true, montantCommande: true, statut: true },
  });

  return {
    total, enAttente, validees, rejetees, enProduction, livrees,
    chiffreAffaires: chiffreAffaires._sum.montantCommande || 0,
    coutTotal: chiffreAffaires._sum.coutTotal || 0,
    margeTotale: chiffreAffaires._sum.margePrevisionnelle || 0,
    commandesMois: commandesMois.length,
    volumeMois: commandesMois.reduce((s, c) => s + c.volumeBeton, 0),
  };
};

const ETAPE_LABELS = {
  EN_ATTENTE_CHEF_SITE:           'Étape 2 — Chef de site',
  EN_ATTENTE_ASSISTANT_COMPTABLE: 'Étape 3 — Assistant Comptable',
  EN_ATTENTE_CHEF_COMPTABLE:      'Étape 4 — Chef Comptable',
  EN_ATTENTE_PDG:                 'Étape 5 — PDG',
};

const notifierRole = async (role, commande, type, message, etapeStatut = null) => {
  const users = await prisma.user.findMany({ where: { role, isActive: true } });
  for (const u of users) {
    const notif = await prisma.notification.create({
      data: { userId: u.id, commandeId: commande.id, titre: type, message, type },
    });
    emitToUser(u.id, 'notification:nouvelle', notif);
    // Email si type validation requise
    if (type === 'VALIDATION_REQUISE' && u.email && etapeStatut) {
      const etapeLabel = ETAPE_LABELS[etapeStatut] || 'Validation';
      envoyerNotifValidation(u.email, `${u.prenom} ${u.nom}`, commande, etapeLabel).catch(() => {});
    }
  }
};

const notifierUser = async (userId, commande, type, message) => {
  const notif = await prisma.notification.create({
    data: { userId, commandeId: commande.id, titre: type, message, type },
  });
  emitToUser(userId, 'notification:nouvelle', notif);
  // Email d'information
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (u?.email) {
    envoyerEmail(u.email, `${u.prenom} ${u.nom}`, type === 'COMMANDE_VALIDEE' ? 'Commande validée' : 'Commande rejetée', message).catch(() => {});
  }
};

module.exports = { listerCommandes, getCommande, creerCommande, modifierCommande, validerCommande, rejeterCommande, getStatistiques };
