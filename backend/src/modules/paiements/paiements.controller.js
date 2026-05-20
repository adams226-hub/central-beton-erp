const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./paiements.service');
const prisma = require('../../config/prisma');
const { generateEtatPaiement } = require('../../utils/pdf');

const lister = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.lister(req.query) });
});
const getStatistiques = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getStatistiques() });
});
const getCreances = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getCreances() });
});
const getParCommande = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getParCommande(req.params.commandeId) });
});
const enregistrer = asyncHandler(async (req, res) => {
  const data = await service.enregistrer(req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Paiement enregistré', data });
});
const confirmer = asyncHandler(async (req, res) => {
  const data = await service.confirmer(req.params.id, req.user.id);
  res.json({ success: true, message: 'Paiement confirmé', data });
});
const annuler = asyncHandler(async (req, res) => {
  const data = await service.annuler(req.params.id, req.user.id);
  res.json({ success: true, message: 'Paiement annulé', data });
});

const exportEtatPaiement = asyncHandler(async (req, res) => {
  const { commandeId } = req.query;
  if (!commandeId) return res.status(400).json({ success: false, message: 'commandeId requis' });

  const commande = await prisma.commande.findUnique({ where: { id: commandeId } });
  if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable' });

  const result = await service.getParCommande(commandeId);

  const doc = generateEtatPaiement(commande, result);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="etat-paiement-${commande.reference}.pdf"`);
  doc.pipe(res);
  doc.end();
});

module.exports = { lister, getStatistiques, getCreances, getParCommande, enregistrer, confirmer, annuler, exportEtatPaiement };
