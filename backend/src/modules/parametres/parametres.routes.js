const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const { requireRoles } = require('../../middleware/rbac');
const ctrl = require('./parametres.controller');

router.get('/', authenticate, ctrl.getParametres);
router.put('/', authenticate, requireRoles('PDG', 'CHEF_COMPTABLE'), ctrl.updateParametres);

module.exports = router;
