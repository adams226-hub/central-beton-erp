const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./rapports.service');
const { generateRapportBenefices } = require('../../utils/pdf');
const { generateExcelBenefices } = require('../../utils/excel');

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

const exportBenefices = asyncHandler(async (req, res) => {
  const { dateDebut, dateFin, format } = req.query;
  const data = await service.rapportBenefices({ debut: dateDebut, fin: dateFin });

  if (format === 'excel') {
    const buffer = generateExcelBenefices(data, dateDebut, dateFin);
    const filename = `benefices_${dateDebut || 'debut'}_${dateFin || 'fin'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } else {
    const filename = `benefices_${dateDebut || 'debut'}_${dateFin || 'fin'}.pdf`;
    const doc = generateRapportBenefices(data, dateDebut, dateFin);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);
    doc.end();
  }
});

module.exports = { tableauDeBordPDG, rapportProduction, rapportFinancier, rapportStocks, rapportEquipements, rapportBenefices, beneficeParCommande, exportBenefices };
