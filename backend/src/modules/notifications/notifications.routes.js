const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const notifs = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { commande: { select: { reference: true, statut: true } } },
  });
  res.json({ success: true, data: notifs });
}));

router.get('/non-lues', asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user.id, isRead: false },
  });
  res.json({ success: true, data: { count } });
}));

router.patch('/:id/lire', asyncHandler(async (req, res) => {
  await prisma.notification.update({
    where: { id: req.params.id, userId: req.user.id },
    data: { isRead: true },
  });
  res.json({ success: true });
}));

router.patch('/lire-tout', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true, message: 'Toutes les notifications marquées comme lues' });
}));

module.exports = router;
