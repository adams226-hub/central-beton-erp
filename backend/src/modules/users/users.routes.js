const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticate } = require('../../middleware/auth');
const { requirePermission, requireRoles } = require('../../middleware/rbac');
const { asyncHandler } = require('../../middleware/errorHandler');
const prisma = require('../../config/prisma');
router.use(authenticate);

router.get('/', requirePermission('user:read'), asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, nom: true, prenom: true, email: true, role: true, telephone: true, isActive: true, lastLogin: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: users });
}));

router.post('/', requirePermission('user:create'), asyncHandler(async (req, res) => {
  const { nom, prenom, email, password, role, telephone } = req.body;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ success: false, message: 'Email déjà utilisé' });
  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { nom, prenom, email, password: hashed, role, telephone },
    select: { id: true, nom: true, prenom: true, email: true, role: true },
  });
  res.status(201).json({ success: true, message: 'Utilisateur créé', data: user });
}));

router.put('/:id', requirePermission('user:update'), asyncHandler(async (req, res) => {
  const { nom, prenom, telephone, isActive, password } = req.body;
  const updateData = { nom, prenom, telephone, isActive };
  if (password) updateData.password = await bcrypt.hash(password, 12);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: updateData,
    select: { id: true, nom: true, prenom: true, email: true, role: true, isActive: true },
  });
  res.json({ success: true, message: 'Utilisateur mis à jour', data: user });
}));

router.get('/activites', requireRoles('PDG'), asyncHandler(async (req, res) => {
  const activites = await prisma.activite.findMany({
    include: { user: { select: { nom: true, prenom: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: activites });
}));

module.exports = router;
