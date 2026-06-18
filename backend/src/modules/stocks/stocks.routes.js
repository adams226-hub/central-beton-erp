const express = require('express');
const router = express.Router();
const ctrl = require('./stocks.controller');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

router.use(authenticate);

router.get('/', ctrl.listerStocks);
router.get('/alertes', ctrl.getAlertes);
router.get('/tableau-de-bord', ctrl.getTableauDeBord);
router.get('/:id/mouvements', ctrl.getMouvements);
router.post('/entree', requirePermission('stock:write'), ctrl.enregistrerEntree);
router.post('/sortie', requirePermission('stock:write'), ctrl.enregistrerSortie);
router.post('/ajustement', requirePermission('stock:write'), ctrl.ajusterStock);
router.put('/:id/prix', requirePermission('stock:write'), ctrl.mettreAJourPrix);

module.exports = router;
