const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./commandes.service');
const { generateDevis } = require('../../utils/pdf');

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
  const calculs = {
    totalCiment: commande.totalCiment,
    totalGravier515: commande.totalGravier515,
    totalGravier1525: commande.totalGravier1525,
    totalSable: commande.totalSable,
    totalPowerflow: commande.totalPowerflow,
    totalGasoil: commande.totalGasoil,
    coutMateriaux: commande.coutMateriaux,
    coutGasoil: commande.coutGasoil,
    coutAmortissement: commande.coutAmortissement,
    coutPersonnel: commande.coutPersonnel,
    fraisRestauration: Math.ceil((commande.volumeBeton || 0) / 200) * 12 * 1500,
    coutTotal: commande.coutTotal,
    coutUnitaire: commande.coutUnitaire,
    margePrevisionnelle: commande.margePrevisionnelle,
    tauxMarge: commande.tauxMarge,
  };

  const doc = generateDevis(commande, calculs);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="devis-${commande.reference}.pdf"`);
  doc.pipe(res);
  doc.end();
});

const supprimerCommande = asyncHandler(async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const commande = await prisma.commande.findUnique({ where: { id: req.params.id } });
  if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable' });
  if (commande.statut !== 'BROUILLON' && req.user.role !== 'PDG') {
    return res.status(403).json({ success: false, message: 'Seul le PDG peut supprimer une commande validée' });
  }
  await prisma.commande.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Commande supprimée' });
});

module.exports = { listerCommandes, getCommande, creerCommande, modifierCommande, validerCommande, rejeterCommande, getStatistiques, genererPDF, supprimerCommande };
