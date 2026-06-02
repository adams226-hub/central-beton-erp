const express = require('express');
const router = express.Router();
const ctrl = require('./rapports.controller');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

router.use(authenticate);

// Lecture : PDG, CHEF_DE_SITE, CHEF_COMPTABLE, ASSISTANT_COMPTABLE, COMPTABLE
router.get('/tableau-de-bord-pdg', requirePermission('rapport:read'), ctrl.tableauDeBordPDG);
router.get('/production',          requirePermission('rapport:read'), ctrl.rapportProduction);
router.get('/financier',           requirePermission('rapport:read'), ctrl.rapportFinancier);
router.get('/stocks',              requirePermission('rapport:read'), ctrl.rapportStocks);
router.get('/equipements',         requirePermission('rapport:read'), ctrl.rapportEquipements);
router.get('/benefices',           requirePermission('rapport:read'), ctrl.rapportBenefices);
router.get('/benefices/commande/:id', requirePermission('rapport:read'), ctrl.beneficeParCommande);

// Export : PDG, CHEF_COMPTABLE, COMPTABLE uniquement
router.get('/benefices/export',    requirePermission('rapport:export'), ctrl.exportBenefices);

module.exports = router;
