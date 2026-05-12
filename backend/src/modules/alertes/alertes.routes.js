const express = require('express');
const router = express.Router();
const ctrl = require('./alertes.controller');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.lister);
router.post('/generer', ctrl.generer);
router.patch('/:id/resoudre', ctrl.resoudre);
router.patch('/resoudre-tout', ctrl.resoudreTout);

module.exports = router;
