const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./production.service');

const lister = asyncHandler(async (req, res) => {
  const data = await service.lister(req.query);
  res.json({ success: true, data });
});

const getOne = asyncHandler(async (req, res) => {
  const data = await service.getOne(req.params.id);
  res.json({ success: true, data });
});

const demarrer = asyncHandler(async (req, res) => {
  const data = await service.demarrer(req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Production démarrée', data });
});

const changerStatut = asyncHandler(async (req, res) => {
  const { statut } = req.body;
  const data = await service.changerStatut(req.params.id, statut, req.user.id);
  res.json({ success: true, message: `Statut mis à jour : ${statut}`, data });
});

const terminer = asyncHandler(async (req, res) => {
  const data = await service.terminer(req.params.id, req.body, req.user.id);
  res.json({ success: true, message: 'Production terminée avec succès', data });
});

const ajouterEquipement = asyncHandler(async (req, res) => {
  const { equipementId, heures } = req.body;
  const data = await service.ajouterEquipement(req.params.id, equipementId, heures, req.user.id);
  res.json({ success: true, data });
});

const getStatistiques = asyncHandler(async (req, res) => {
  const data = await service.getStatistiques(req.query.periode);
  res.json({ success: true, data });
});

module.exports = { lister, getOne, demarrer, changerStatut, terminer, ajouterEquipement, getStatistiques };
