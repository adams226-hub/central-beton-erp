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
router.post('/', requireRoles('PDG', 'CHEF_DE_SITE', 'SECRETAIRE'), ctrl.creer);
router.put('/:id', requireRoles('PDG', 'CHEF_DE_SITE', 'SECRETAIRE'), ctrl.modifier);
router.patch('/:id/statut', requireRoles('PDG', 'CHEF_DE_SITE', 'SECRETAIRE'), ctrl.changerStatut);
router.post('/:id/maintenance', requireRoles('PDG', 'CHEF_DE_SITE', 'SECRETAIRE'), ctrl.enregistrerMaintenance);
router.post('/:id/maintenances', requireRoles('PDG', 'CHEF_DE_SITE', 'SECRETAIRE'), ctrl.enregistrerMaintenance);
router.delete('/:id', requireRoles('PDG', 'CHEF_DE_SITE', 'SECRETAIRE'), ctrl.desactiver);
router.patch('/:id/reactiver', requireRoles('PDG', 'CHEF_DE_SITE', 'SECRETAIRE'), ctrl.reactiver);

module.exports = router;
