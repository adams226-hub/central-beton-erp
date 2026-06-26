const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./commandes.service');
const { generateDevis, generateFactureProforma } = require('../../utils/pdf');
const { calculerBesoinsCommande } = require('../../utils/calculations');
const prisma = require('../../config/prisma');
const parametresService = require('../parametres/parametres.service');

const listerCommandes = asyncHandler(async (req, res) => {
  const result = await service.listerCommandes(req.user, req.query);
  res.json({ success: true, data: result });
});

const getCommande = asyncHandler(async (req, res) => {
  const commande = await service.getCommande(req.params.id);
  res.json({ success: true, data: commande });
});

const creerCommande = asyncHandler(async (req, res) => {
  const commande = await service.creerCommande(req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Commande créée avec succès', data: commande });
});

const modifierCommande = asyncHandler(async (req, res) => {
  const commande = await service.modifierCommande(req.params.id, req.body, req.user.id);
  res.json({ success: true, message: 'Commande modifiée', data: commande });
});

const validerCommande = asyncHandler(async (req, res) => {
  const commande = await service.validerCommande(req.params.id, req.user.id, req.body.commentaire);
  res.json({ success: true, message: 'Commande validée', data: commande });
});

const rejeterCommande = asyncHandler(async (req, res) => {
  await service.rejeterCommande(req.params.id, req.user.id, req.body.motif);
  res.json({ success: true, message: 'Commande rejetée' });
});

const getStatistiques = asyncHandler(async (req, res) => {
  const stats = await service.getStatistiques();
  res.json({ success: true, data: stats });
});

const genererPDF = asyncHandler(async (req, res) => {
  const commande = await service.getCommande(req.params.id);
  const f = commande.formulation;
  const v = commande.volumeBeton || 0;
  const params = await parametresService.get();

  // Recalcul complet avec options de la commande
  const cmdOpts = {
    includePersonnel:    commande.includePersonnel    ?? true,
    includeRestauration: commande.includeRestauration ?? true,
    fraisPeage:  commande.fraisPeage  ?? 0,
    autresFrais: commande.autresFrais ?? 0,
  };
  const calculs = f && v > 0
    ? calculerBesoinsCommande(v, f, commande.montantCommande || 0, commande.distanceLivraison || 0, params, commande.remisePct || 0, cmdOpts)
    : {};

  const fraisLoyer         = Math.round(params.loyerMensuel ?? 500000);
  const fraisAutresCharges = Math.round(params.fraisGenerauxMensuels ?? 150000);
  const fraisImpots        = Math.round((commande.montantCommande || 0) * (params.impotsTaux ?? 0.05));
  const chargesExploitation = fraisLoyer + fraisAutresCharges + fraisImpots;

  // Fusionner avec les valeurs stockées (fallback si recalcul impossible)
  const k = {
    ...calculs,
    coutTotal:    calculs.coutTotal    ?? commande.coutTotal    ?? 0,
    coutUnitaire: calculs.coutUnitaire ?? commande.coutUnitaire ?? 0,
    margePrevisionnelle: calculs.margePrevisionnelle ?? commande.margePrevisionnelle ?? 0,
    tauxMarge:    calculs.tauxMarge    ?? commande.tauxMarge    ?? 0,
    fraisLoyer, fraisAutresCharges, fraisImpots, chargesExploitation,
    beneficeReel:     calculs.beneficeReel     ?? commande.beneficeReel     ?? 0,
    tauxBeneficeReel: calculs.tauxBeneficeReel ?? commande.tauxBeneficeReel ?? 0,
    prixCiment:    f?.prixCiment     ?? 105500,
    prixSable:     f?.prixSable      ?? 16000,
    prixGravier515: f?.prixGravier515 ?? 11500,
    prixGravier1525: f?.prixGravier1525 ?? 11500,
    prixPowerflow: f?.prixPowerflow  ?? 1750,
    prixHydrofuge: f?.prixHydrofuge  ?? 2750,
    totalHydrofuge: calculs.totalHydrofuge ?? 0,
    coutHydrofuge: calculs.coutHydrofuge ?? 0,
    coutPersonnel:     commande.coutPersonnel     ?? calculs.coutPersonnel     ?? 0,
    fraisRestauration: commande.fraisRestauration ?? calculs.fraisRestauration ?? 0,
    coutPeage:         commande.coutPeage         ?? calculs.coutPeage         ?? 0,
    coutAutres:        commande.coutAutres        ?? calculs.coutAutres        ?? 0,
    autresFraisLabel:  commande.autresFraisLabel  ?? '',
    nbRepas:           calculs.nbRepas ?? 0,
    prixRepas:         calculs.prixRepas ?? 1500,
  };
  const doc = generateDevis(commande, k);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="devis-${commande.reference}.pdf"`);
  doc.pipe(res);
  doc.end();
});

const genererFactureProforma = asyncHandler(async (req, res) => {
  const commande = await service.getCommande(req.params.id);
  const doc = generateFactureProforma(commande);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="proforma-${commande.reference}.pdf"`);
  doc.pipe(res);
  doc.end();
});

const genererFactureProformaCustom = asyncHandler(async (req, res) => {
  const commande = await service.getCommande(req.params.id);
  const lignes = Array.isArray(req.body.lignes) && req.body.lignes.length > 0 ? req.body.lignes : null;
  const doc = generateFactureProforma(commande, lignes);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="proforma-${commande.reference}.pdf"`);
  doc.pipe(res);
  doc.end();
});

const supprimerCommande = asyncHandler(async (req, res) => {
  const commande = await prisma.commande.findUnique({
    where: { id: req.params.id },
    include: { paiements: true, livraisons: true },
  });
  if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable' });

  const SUPPRIMABLES = ['BROUILLON', 'ANNULEE', 'REJETEE'];
  if (!SUPPRIMABLES.includes(commande.statut)) {
    return res.status(400).json({
      success: false,
      message: `Impossible de supprimer une commande en statut "${commande.statut}". Seules les commandes en brouillon, annulées ou rejetées peuvent être supprimées.`,
    });
  }

  const paiementsPayes = commande.paiements.filter((p) => ['PAYE', 'PARTIEL'].includes(p.statut));
  if (paiementsPayes.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Impossible de supprimer : ${paiementsPayes.length} paiement(s) déjà enregistré(s) sur cette commande.`,
    });
  }

  await prisma.$transaction([
    prisma.paiement.deleteMany({ where: { commandeId: req.params.id } }),
    prisma.livraison.deleteMany({ where: { commandeId: req.params.id } }),
    prisma.commande.delete({ where: { id: req.params.id } }),
  ]);

  await prisma.activite.create({
    data: {
      userId: req.user.id,
      type: 'SUPPRESSION_COMMANDE',
      action: `Commande supprimée : ${commande.reference}`,
      details: { reference: commande.reference, nomClient: commande.nomClient },
    },
  });

  res.json({ success: true, message: `Commande ${commande.reference} supprimée définitivement` });
});

module.exports = { listerCommandes, getCommande, creerCommande, modifierCommande, validerCommande, rejeterCommande, getStatistiques, genererPDF, genererFactureProforma, genererFactureProformaCustom, supprimerCommande };
