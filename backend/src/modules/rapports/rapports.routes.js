const express = require('express');
const router = express.Router();
const ctrl = require('./rapports.controller');
const { authenticate } = require('../../middleware/auth');
const { requireRoles } = require('../../middleware/rbac');

router.use(authenticate);
router.use(requireRoles('PDG', 'COMPTABLE'));

router.get('/tableau-de-bord-pdg', ctrl.tableauDeBordPDG);
router.get('/production', ctrl.rapportProduction);
router.get('/financier', ctrl.rapportFinancier);
router.get('/stocks', ctrl.rapportStocks);
router.get('/equipements', ctrl.rapportEquipements);
router.get('/benefices', ctrl.rapportBenefices);
router.get('/benefices/export', ctrl.exportBenefices);
router.get('/benefices/commande/:id', ctrl.beneficeParCommande);

module.exports = router;
