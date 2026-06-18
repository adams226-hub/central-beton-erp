const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { login, logout, refreshToken, getMe } = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});

router.post('/login', loginLimiter, login);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

module.exports = router;
