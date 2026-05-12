const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./equipements.service');

const lister = asyncHandler(async (req, res) => {
  const data = await service.lister(req.query);
  res.json({ success: true, data });
});

const getDisponibles = asyncHandler(async (req, res) => {
  const data = await service.getDisponibles(req.query.type);
  res.json({ success: true, data });
});

const getAmortissements = asyncHandler(async (req, res) => {
  const data = await service.getAmortissements();
  res.json({ success: true, data });
});

const getOne = asyncHandler(async (req, res) => {
  const data = await service.getOne(req.params.id);
  res.json({ success: true, data });
});

const getMaintenances = asyncHandler(async (req, res) => {
  const data = await service.getMaintenances(req.params.id);
  res.json({ success: true, data });
});

const creer = asyncHandler(async (req, res) => {
  const data = await service.creer(req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Équipement créé', data });
});

const modifier = asyncHandler(async (req, res) => {
  const data = await service.modifier(req.params.id, req.body, req.user.id);
  res.json({ success: true, message: 'Équipement mis à jour', data });
});

const changerStatut = asyncHandler(async (req, res) => {
  const data = await service.changerStatut(req.params.id, req.body.statut, req.user.id);
  res.json({ success: true, data });
});

const enregistrerMaintenance = asyncHandler(async (req, res) => {
  const data = await service.enregistrerMaintenance(req.params.id, req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Maintenance enregistrée', data });
});

module.exports = { lister, getDisponibles, getAmortissements, getOne, getMaintenances, creer, modifier, changerStatut, enregistrerMaintenance };
