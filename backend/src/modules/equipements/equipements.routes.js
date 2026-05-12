const express = require('express');
const router = express.Router();
const ctrl = require('./equipements.controller');
const { authenticate } = require('../../middleware/auth');
const { requireRoles } = require('../../middleware/rbac');

router.use(authenticate);

router.get('/', ctrl.lister);
router.get('/disponibles', ctrl.getDisponibles);
router.get('/amortissements', ctrl.getAmortissements);
router.get('/:id', ctrl.getOne);
router.get('/:id/maintenances', ctrl.getMaintenances);
router.post('/', requireRoles('PDG', 'CHEF_DE_SITE'), ctrl.creer);
router.put('/:id', requireRoles('PDG', 'CHEF_DE_SITE'), ctrl.modifier);
router.patch('/:id/statut', requireRoles('PDG', 'CHEF_DE_SITE'), ctrl.changerStatut);
router.post('/:id/maintenance', requireRoles('PDG', 'CHEF_DE_SITE'), ctrl.enregistrerMaintenance);

module.exports = router;
