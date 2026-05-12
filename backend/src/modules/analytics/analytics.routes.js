const express = require('express');
const router = express.Router();
const ctrl = require('./analytics.controller');
const { authenticate } = require('../../middleware/auth');
const { requireRoles } = require('../../middleware/rbac');

router.use(authenticate);

// KPIs temps réel — accès large (dashboard)
router.get('/kpis', ctrl.kpisTempsReel);

// Analytiques avancées — PDG + Comptable
router.get('/tendances', requireRoles('PDG', 'COMPTABLE'), ctrl.tendancesMensuelles);
router.get('/rentabilite-clients', requireRoles('PDG', 'COMPTABLE'), ctrl.rentabiliteParClient);
router.get('/rentabilite-beton', requireRoles('PDG', 'COMPTABLE', 'CHEF_DE_SITE'), ctrl.rentabiliteParTypeBeton);
router.get('/consommations', requireRoles('PDG', 'COMPTABLE', 'CHEF_DE_SITE'), ctrl.consommationsMatieres);
router.get('/previsions', requireRoles('PDG', 'COMPTABLE'), ctrl.previsionsBudgetaires);
router.get('/performance', requireRoles('PDG', 'CHEF_DE_SITE'), ctrl.performanceProduction);
router.get('/paiements', requireRoles('PDG', 'COMPTABLE'), ctrl.analysePaiements);

module.exports = router;
