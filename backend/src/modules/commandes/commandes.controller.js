const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./commandes.service');
const { generateDevis, generateFactureProforma } = require('../../utils/pdf');
const prisma = require('../../config/prisma');

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

  // Recalcul des coûts matières individuels depuis la formulation stockée
  const coutCiment    = f ? Math.round(((commande.totalCiment || 0) / 1000) * f.prixCiment) : 0;
  const coutGravier515 = f ? Math.round((commande.totalGravier515 || 0) * f.prixGravier515) : 0;
  const coutGravier1525= f ? Math.round((commande.totalGravier1525 || 0) * f.prixGravier1525) : 0;
  const coutSable      = f ? Math.round((commande.totalSable || 0) * f.prixSable) : 0;
  const coutPowerflow  = f ? Math.round((commande.totalPowerflow || 0) * (f.prixPowerflow || 1750)) : 0;

  const fraisRestauration = Math.ceil(v / 200) * 12 * 1500;
  const fraisTransport    = commande.fraisTransport || 0;
  const distance          = commande.distanceLivraison || 0;

  // Charges d'exploitation reconstituées
  const fraisLoyer        = commande.chargesExploitation
    ? Math.round(commande.chargesExploitation * 0.50)
    : Math.round((500_000 / 200) * v);
  const fraisAutresCharges= commande.chargesExploitation
    ? Math.round(commande.chargesExploitation * 0.15)
    : Math.round((150_000 / 200) * v);
  const fraisImpots       = commande.chargesExploitation
    ? commande.chargesExploitation - fraisLoyer - fraisAutresCharges
    : Math.round((commande.montantCommande || 0) * 0.05);
  const chargesExploitation = commande.chargesExploitation ||
    fraisLoyer + fraisAutresCharges + fraisImpots;

  const calculs = {
    totalCiment:     commande.totalCiment,
    totalGravier515: commande.totalGravier515,
    totalGravier1525:commande.totalGravier1525,
    totalSable:      commande.totalSable,
    totalPowerflow:  commande.totalPowerflow,
    totalGasoil:     commande.totalGasoil,
    coutCiment, coutGravier515, coutGravier1525, coutSable, coutPowerflow,
    coutMateriaux:     commande.coutMateriaux,
    coutGasoil:        commande.coutGasoil,
    coutAmortissement: commande.coutAmortissement,
    coutPersonnel:     commande.coutPersonnel,
    fraisRestauration,
    fraisTransport,
    coutTotal:         commande.coutTotal,
    coutUnitaire:      commande.coutUnitaire,
    margePrevisionnelle: commande.margePrevisionnelle,
    tauxMarge:         commande.tauxMarge,
    fraisLoyer, fraisAutresCharges, fraisImpots,
    chargesExploitation,
    beneficeReel:      commande.beneficeReel || (commande.margePrevisionnelle || 0) - chargesExploitation,
    tauxBeneficeReel:  commande.tauxBeneficeReel || 0,
  };

  const doc = generateDevis(commande, calculs);
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

const supprimerCommande = asyncHandler(async (req, res) => {
  const commande = await prisma.commande.findUnique({ where: { id: req.params.id } });
  if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable' });
  if (commande.statut !== 'BROUILLON' && req.user.role !== 'PDG') {
    return res.status(403).json({ success: false, message: 'Seul le PDG peut supprimer une commande validée' });
  }
  await prisma.commande.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Commande supprimée' });
});

module.exports = { listerCommandes, getCommande, creerCommande, modifierCommande, validerCommande, rejeterCommande, getStatistiques, genererPDF, genererFactureProforma, supprimerCommande };
