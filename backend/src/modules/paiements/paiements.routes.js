const express = require('express');
const router = express.Router();
const ctrl = require('./paiements.controller');
const { authenticate } = require('../../middleware/auth');
const { requireRoles } = require('../../middleware/rbac');

router.use(authenticate);

router.get('/', ctrl.lister);
router.get('/statistiques', ctrl.getStatistiques);
router.get('/creances', ctrl.getCreances);
router.get('/export', ctrl.exportEtatPaiement);
router.get('/commande/:commandeId', ctrl.getParCommande);
router.post('/', requireRoles('PDG', 'COMPTABLE', 'SECRETAIRE', 'ASSISTANT_COMPTABLE'), ctrl.enregistrer);
router.patch('/:id/confirmer', requireRoles('PDG', 'COMPTABLE', 'ASSISTANT_COMPTABLE'), ctrl.confirmer);
router.patch('/:id/annuler', requireRoles('PDG', 'COMPTABLE', 'ASSISTANT_COMPTABLE'), ctrl.annuler);

module.exports = router;
