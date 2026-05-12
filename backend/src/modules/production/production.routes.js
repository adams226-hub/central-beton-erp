const express = require('express');
const router = express.Router();
const ctrl = require('./production.controller');
const { authenticate } = require('../../middleware/auth');
const { requirePermission, requireRoles } = require('../../middleware/rbac');

router.use(authenticate);

router.get('/', ctrl.lister);
router.get('/statistiques', ctrl.getStatistiques);
router.get('/:id', ctrl.getOne);
router.post('/', requireRoles('PDG', 'CHEF_DE_SITE', 'OPERATEUR'), ctrl.demarrer);
router.patch('/:id/statut', requireRoles('PDG', 'CHEF_DE_SITE', 'OPERATEUR'), ctrl.changerStatut);
router.patch('/:id/terminer', requireRoles('PDG', 'CHEF_DE_SITE', 'OPERATEUR'), ctrl.terminer);
router.post('/:id/equipements', requireRoles('PDG', 'CHEF_DE_SITE', 'OPERATEUR'), ctrl.ajouterEquipement);

module.exports = router;
