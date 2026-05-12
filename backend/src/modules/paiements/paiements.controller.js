const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./paiements.service');

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

module.exports = { lister, getStatistiques, getCreances, getParCommande, enregistrer, confirmer, annuler };
