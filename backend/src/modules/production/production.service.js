const { deduireStockProduction } = require('../stocks/stocks.service');
const { emitToAll, emitToRole, emitToUser } = require('../../config/socket');
const { calculerBesoinsCommande } = require('../../utils/calculations');
const logger = require('../../config/logger');
const prisma = require('../../config/prisma');

const genRefProduction = () => {
  const d = new Date();
  return `PROD-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`;
};

const lister = async (filters = {}) => {
  const where = {};
  if (filters.statut) where.statut = filters.statut;
  if (filters.commandeId) where.commandeId = filters.commandeId;

  return prisma.production.findMany({
    where,
    include: {
      commande: { select: { reference: true, nomClient: true, volumeBeton: true, typeBeton: true } },
      operateur: { select: { nom: true, prenom: true } },
      equipements: { include: { equipement: { select: { nom: true, type: true } } } },
      livraisons: { select: { id: true, statut: true, volumeReel: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: parseInt(filters.limit) || 50,
  });
};

const getOne = async (id) => {
  const p = await prisma.production.findUnique({
    where: { id },
    include: {
      commande: { include: { formulation: true } },
      operateur: { select: { nom: true, prenom: true, role: true } },
      equipements: { include: { equipement: true } },
      livraisons: { include: { toupie: { select: { nom: true, code: true } } } },
      mouvementsStock: { include: { stock: { select: { designation: true, unite: true } } } },
    },
  });
  if (!p) throw Object.assign(new Error('Production introuvable'), { statusCode: 404 });
  return p;
};

const demarrer = async (data, operateurId) => {
  const commande = await prisma.commande.findUnique({
    where: { id: data.commandeId },
    include: { formulation: true },
  });
  if (!commande) throw Object.assign(new Error('Commande introuvable'), { statusCode: 404 });
  if (!['VALIDEE', 'EN_PRODUCTION'].includes(commande.statut)) {
    throw Object.assign(new Error('Commande non validée ou déjà en production'), { statusCode: 400 });
  }
  if (!commande.formulation) throw Object.assign(new Error('Formulation manquante sur la commande'), { statusCode: 400 });

  const reference = genRefProduction();

  // Transaction batch atomique : créer production + mettre à jour statut commande
  const [production] = await prisma.$transaction([
    prisma.production.create({
      data: {
        reference,
        commandeId: data.commandeId,
        statut: 'EN_COURS',
        volumePlanifie: commande.volumeBeton,
        dateDebutPrevue: data.dateDebutPrevue ? new Date(data.dateDebutPrevue) : null,
        dateDebut: new Date(),
        operateurId,
        observations: data.observations,
      },
    }),
    prisma.commande.update({
      where: { id: data.commandeId },
      data: { statut: 'EN_PRODUCTION' },
    }),
  ]);

  // Déduire les stocks hors transaction pour éviter le timeout Supabase
  await deduireStockProduction(production.id, data.commandeId, commande.formulation, commande.volumeBeton, operateurId);

  // Consommation carburant
  const gasoilTotal = (commande.formulation.gasoilToupie + commande.formulation.gasoilChargeur + commande.formulation.gasoilPompe + commande.formulation.gasoilGroupe) * (commande.volumeBeton / 200);
  if (gasoilTotal > 0) {
    await prisma.consoCarburant.create({
      data: {
        date: new Date(),
        litres: gasoilTotal,
        prixLitre: 675,
        montantTotal: gasoilTotal * 675,
        productionId: production.id,
        commandeId: data.commandeId,
        motif: `Production ${reference}`,
      },
    });
  }

  // Journal
  await prisma.activite.create({
    data: {
      userId: operateurId,
      type: 'DEMARRAGE_PRODUCTION',
      action: `Production démarrée : ${reference} — ${commande.volumeBeton} m³ ${commande.typeBeton}`,
      details: { productionId: production.id, commandeId: data.commandeId },
    },
  });

  // Notifications temps réel
  emitToAll('production:demarree', { productionId: production.id, reference, commandeRef: commande.reference });
  emitToUser(commande.createdById, 'notification:nouvelle', {
    type: 'PRODUCTION_DEMARREE',
    message: `Production démarrée : ${commande.volumeBeton} m³ ${commande.typeBeton} — Réf: ${reference}`,
  });

  logger.info(`Production démarrée : ${reference}`);
  return production;
};

const changerStatut = async (id, statut, userId) => {
  const prod = await prisma.production.findUnique({ where: { id } });
  if (!prod) throw Object.assign(new Error('Production introuvable'), { statusCode: 404 });

  const updated = await prisma.production.update({
    where: { id },
    data: { statut },
  });

  emitToAll('production:statut_change', { productionId: id, statut });
  return updated;
};

const terminer = async (id, data, userId) => {
  const prod = await prisma.production.findUnique({
    where: { id },
    include: { commande: { include: { formulation: true, paiements: true } } },
  });
  if (!prod) throw Object.assign(new Error('Production introuvable'), { statusCode: 404 });

  const volumeProduit = parseFloat(data.volumeProduit || prod.volumePlanifie);
  const gasoilConsomme = parseFloat(data.gasoilConsomme || 0);
  const maintenanceCout = parseFloat(data.maintenanceCout || 0);

  // Calculer les coûts réels
  const f = prod.commande.formulation;
  const v = volumeProduit;
  const ratio = v / 200;

  const coutMatieres = prod.commande.coutMateriaux || 0;
  const coutCarburant = gasoilConsomme * 675;
  const coutAmort = f ? (f.amortToupie * f.hToupie + f.amortPompe * f.hPompe + f.amortCentrale * f.hCentrale + f.amortGroupe * f.hGroupe + f.amortChargeuse * f.hChargeuse) * ratio : 0;
  const coutPersonnel = v * 245;
  const coutTotal = coutMatieres + coutCarburant + coutAmort + maintenanceCout + coutPersonnel;

  const montantCommande = prod.commande.montantCommande || 0;
  const beneficeNet = montantCommande - coutTotal;
  const tauxMarge = montantCommande > 0 ? (beneficeNet / montantCommande) * 100 : 0;

  const now = new Date();
  const dureeH = prod.dateDebut ? (now - prod.dateDebut) / 3600000 : 0;

  const [updatedProd] = await prisma.$transaction([
    prisma.production.update({
      where: { id },
      data: {
        statut: 'TERMINE',
        volumeProduit,
        dateFin: now,
        dureeHeures: dureeH,
        gasoilConsomme,
        coutMatieres,
        coutCarburant,
        coutAmortissement: coutAmort,
        coutMaintenance: maintenanceCout,
        coutPersonnel,
        coutTotal,
        rendement: (volumeProduit / prod.volumePlanifie) * 100,
        observations: data.observations || prod.observations,
      },
    }),
    // On met à jour les coûts réels mais on ne passe PAS à LIVREE :
    // c'est confirmerLivraison() qui décidera quand tout le volume est livré
    prisma.commande.update({
      where: { id: prod.commandeId },
      data: {
        depensesReelles: coutTotal,
        beneficeNetReel: beneficeNet,
        tauxMargeReel: tauxMarge,
      },
    }),
    prisma.activite.create({
      data: {
        userId,
        type: 'FIN_PRODUCTION',
        action: `Production terminée : ${prod.reference} — ${volumeProduit} m³ produits`,
        details: { productionId: id, coutTotal, beneficeNet },
      },
    }),
  ]);

  emitToAll('production:terminee', { productionId: id, reference: prod.reference, beneficeNet });
  emitToUser(prod.commande.createdById, 'notification:nouvelle', {
    type: 'PRODUCTION_TERMINEE',
    message: `Production terminée : ${volumeProduit} m³. Bénéfice net : ${beneficeNet.toLocaleString('fr-FR')} FCFA`,
  });

  return updatedProd;
};

const ajouterEquipement = async (productionId, equipementId, heures, userId) => {
  const equipement = await prisma.equipement.findUnique({ where: { id: equipementId } });
  if (!equipement) throw Object.assign(new Error('Équipement introuvable'), { statusCode: 404 });

  const coutAmort = parseFloat(heures) * equipement.coutHoraire;

  const pe = await prisma.productionEquipement.upsert({
    where: { productionId_equipementId: { productionId, equipementId } },
    update: { heuresUtilisees: parseFloat(heures), coutAmortissement: coutAmort },
    create: { productionId, equipementId, heuresUtilisees: parseFloat(heures), coutAmortissement: coutAmort },
  });

  // Mettre à jour les heures d'utilisation de l'équipement
  await prisma.equipement.update({
    where: { id: equipementId },
    data: {
      heuresUtilisees: { increment: parseFloat(heures) },
      valeurActuelle: Math.max(0, equipement.valeurActuelle - coutAmort),
    },
  });

  return pe;
};

const getStatistiques = async (periode = '30') => {
  const dateDebut = new Date();
  dateDebut.setDate(dateDebut.getDate() - parseInt(periode));

  const [total, enCours, terminees, volumeTotal] = await prisma.$transaction([
    prisma.production.count({ where: { createdAt: { gte: dateDebut } } }),
    prisma.production.count({ where: { statut: { in: ['EN_COURS', 'CHARGEMENT', 'LIVRAISON'] } } }),
    prisma.production.count({ where: { statut: 'TERMINE', dateFin: { gte: dateDebut } } }),
    prisma.production.aggregate({ where: { statut: 'TERMINE', dateFin: { gte: dateDebut } }, _sum: { volumeProduit: true, coutTotal: true } }),
  ]);

  return {
    total, enCours, terminees,
    volumeTotal: volumeTotal._sum.volumeProduit || 0,
    coutTotal: volumeTotal._sum.coutTotal || 0,
  };
};

module.exports = { lister, getOne, demarrer, changerStatut, terminer, ajouterEquipement, getStatistiques };
