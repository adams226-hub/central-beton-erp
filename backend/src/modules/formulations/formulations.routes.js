const express = require('express');
const router = express.Router();
const ctrl = require('./formulations.controller');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

router.use(authenticate);

router.get('/', requirePermission('formulation:read'), ctrl.lister);
router.get('/:id', requirePermission('formulation:read'), ctrl.getOne);
router.get('/:id/historique', requirePermission('formulation:read'), ctrl.getHistorique);
router.post('/', requirePermission('formulation:create'), ctrl.creer);
router.put('/:id', requirePermission('formulation:update'), ctrl.modifier);
router.delete('/:id', requirePermission('formulation:delete'), ctrl.supprimer);
router.post('/calculer', requirePermission('formulation:read'), ctrl.calculer);

module.exports = router;
