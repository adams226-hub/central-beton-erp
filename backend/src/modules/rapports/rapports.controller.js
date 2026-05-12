const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./rapports.service');

const tableauDeBordPDG = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.tableauDeBordPDG(req.query) });
});
const rapportProduction = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.rapportProduction(req.query) });
});
const rapportFinancier = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.rapportFinancier(req.query) });
});
const rapportStocks = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.rapportStocks() });
});
const rapportEquipements = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.rapportEquipements() });
});
const rapportBenefices = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.rapportBenefices(req.query) });
});
const beneficeParCommande = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.beneficeParCommande(req.params.id) });
});

module.exports = { tableauDeBordPDG, rapportProduction, rapportFinancier, rapportStocks, rapportEquipements, rapportBenefices, beneficeParCommande };
