const express = require('express');
const router = express.Router();
const ctrl = require('./livraisons.controller');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.lister);
router.get('/planning', ctrl.getPlanning);
router.get('/export', ctrl.exportEtatLivraison);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.planifier);
router.patch('/:id/statut', ctrl.changerStatut);
router.patch('/:id/livrer', ctrl.confirmerLivraison);

module.exports = router;
