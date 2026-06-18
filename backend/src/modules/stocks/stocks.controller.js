const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./stocks.service');

const listerStocks = asyncHandler(async (req, res) => {
  const stocks = await service.listerStocks();
  res.json({ success: true, data: stocks });
});

const getAlertes = asyncHandler(async (req, res) => {
  const alertes = await service.getAlertes();
  res.json({ success: true, data: alertes });
});

const getTableauDeBord = asyncHandler(async (req, res) => {
  const tb = await service.getTableauDeBord();
  res.json({ success: true, data: tb });
});

const getMouvements = asyncHandler(async (req, res) => {
  const mouvements = await service.getMouvements(req.params.id, req.query);
  res.json({ success: true, data: mouvements });
});

const enregistrerEntree = asyncHandler(async (req, res) => {
  const result = await service.enregistrerEntree(req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Entrée stock enregistrée', data: result });
});

const enregistrerSortie = asyncHandler(async (req, res) => {
  const result = await service.enregistrerSortie(req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Sortie stock enregistrée', data: result });
});

const ajusterStock = asyncHandler(async (req, res) => {
  const result = await service.ajusterStock(req.body, req.user.id);
  res.json({ success: true, message: 'Stock ajusté', data: result });
});

const mettreAJourPrix = asyncHandler(async (req, res) => {
  const stock = await service.mettreAJourPrix(req.params.id, req.body.prixUnitaire, req.user.id);
  res.json({ success: true, message: 'Prix mis à jour', data: stock });
});

module.exports = { listerStocks, getAlertes, getTableauDeBord, getMouvements, enregistrerEntree, enregistrerSortie, ajusterStock, mettreAJourPrix };
