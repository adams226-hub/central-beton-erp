const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./livraisons.service');
const prisma = require('../../config/prisma');
const { generateEtatLivraison } = require('../../utils/pdf');

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

const exportEtatLivraison = asyncHandler(async (req, res) => {
  const { commandeId } = req.query;
  if (!commandeId) return res.status(400).json({ success: false, message: 'commandeId requis' });

  const commande = await prisma.commande.findUnique({ where: { id: commandeId } });
  if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable' });

  const { livraisons } = await service.lister({ commandeId, limit: 1000 });

  const doc = generateEtatLivraison(commande, livraisons);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="etat-livraison-${commande.reference}.pdf"`);
  doc.pipe(res);
  doc.end();
});

module.exports = { lister, getPlanning, getOne, planifier, changerStatut, confirmerLivraison, exportEtatLivraison };
