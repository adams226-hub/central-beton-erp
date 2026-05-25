const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./parametres.service');

const getParametres = asyncHandler(async (req, res) => {
  const params = await service.get();
  res.json({ success: true, data: params });
});

const updateParametres = asyncHandler(async (req, res) => {
  const allowed = [
    'loyerMensuel', 'fraisGenerauxMensuels', 'volumeRefMensuel', 'prixGasoil',
    'chargePersonnelM3', 'fraisRestaurationPlat', 'nbRepasRef', 'impotsTaux', 'fraisChauffeurKm',
  ];
  const data = {};
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) data[k] = parseFloat(req.body[k]);
  });
  if (data.nbRepasRef !== undefined) data.nbRepasRef = Math.round(data.nbRepasRef);
  const params = await service.update(data, req.user.id);
  res.json({ success: true, data: params });
});

module.exports = { getParametres, updateParametres };
