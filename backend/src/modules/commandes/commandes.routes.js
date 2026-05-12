const express = require('express');
const router = express.Router();
const ctrl = require('./commandes.controller');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

router.use(authenticate);

router.get('/', requirePermission('commande:read'), ctrl.listerCommandes);
router.get('/statistiques', requirePermission('commande:read'), ctrl.getStatistiques);
router.get('/:id', requirePermission('commande:read'), ctrl.getCommande);
router.post('/', requirePermission('commande:create'), ctrl.creerCommande);
router.put('/:id', requirePermission('commande:update'), ctrl.modifierCommande);
router.post('/:id/valider', requirePermission('commande:validate'), ctrl.validerCommande);
router.post('/:id/rejeter', requirePermission('commande:reject'), ctrl.rejeterCommande);
router.get('/:id/pdf', requirePermission('commande:read'), ctrl.genererPDF);
router.delete('/:id', requirePermission('commande:delete'), ctrl.supprimerCommande);

module.exports = router;
