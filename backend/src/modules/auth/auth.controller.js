const { asyncHandler } = require('../../middleware/errorHandler');
const authService = require('./auth.service');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
  }

  const result = await authService.login(email, password, req.ip, req.headers['user-agent']);
  res.json({ success: true, message: 'Connexion réussie', data: result });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);
  res.json({ success: true, message: 'Déconnexion réussie' });
});

const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token requis' });
  }
  const tokens = await authService.refreshToken(refreshToken);
  res.json({ success: true, data: tokens });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.json({ success: true, data: user });
});

module.exports = { login, logout, refreshToken, getMe };
