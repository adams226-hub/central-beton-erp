const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./formulations.service');
const prisma = require('../../config/prisma');

const lister = asyncHandler(async (req, res) => {
  const formulations = await service.lister(req.query.all !== 'true');
  res.json({ success: true, data: formulations });
});

const getOne = asyncHandler(async (req, res) => {
  const f = await service.getOne(req.params.id);
  res.json({ success: true, data: f });
});

const getHistorique = asyncHandler(async (req, res) => {
  const historique = await service.getHistorique(req.params.id);
  res.json({ success: true, data: historique });
});

const creer = asyncHandler(async (req, res) => {
  const f = await service.creer(req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Formulation créée', data: f });
});

const modifier = asyncHandler(async (req, res) => {
  const f = await service.modifier(req.params.id, req.body, req.user.id, req.body.motif);
  res.json({ success: true, message: 'Formulation mise à jour', data: f });
});

const supprimer = asyncHandler(async (req, res) => {
  await service.supprimer(req.params.id, req.user.id);
  res.json({ success: true, message: 'Formulation désactivée' });
});

const calculer = asyncHandler(async (req, res) => {
  const { volume, formulationId, montantCommande, distanceLivraison, remisePct, options } = req.body;
  const formulation = await prisma.formulation.findUnique({ where: { id: formulationId } });
  if (!formulation) return res.status(404).json({ success: false, message: 'Formulation introuvable' });
  const calculs = await service.calculer({ volume, formulation, montantCommande, distanceLivraison, remisePct, options });
  res.json({ success: true, data: calculs });
});

module.exports = { lister, getOne, getHistorique, creer, modifier, supprimer, calculer };
