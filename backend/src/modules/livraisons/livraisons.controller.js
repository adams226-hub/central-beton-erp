const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./livraisons.service');

const lister = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.lister(req.query) });
});
const getPlanning = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getPlanning() });
});
const getOne = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getOne(req.params.id) });
});
const planifier = asyncHandler(async (req, res) => {
  const data = await service.planifier(req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Livraison planifiée', data });
});
const changerStatut = asyncHandler(async (req, res) => {
  const data = await service.changerStatut(req.params.id, req.body.statut, req.user.id);
  res.json({ success: true, data });
});
const confirmerLivraison = asyncHandler(async (req, res) => {
  const data = await service.confirmerLivraison(req.params.id, req.body, req.user.id);
  res.json({ success: true, message: 'Livraison confirmée', data });
});

module.exports = { lister, getPlanning, getOne, planifier, changerStatut, confirmerLivraison };
