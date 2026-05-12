const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const logger = require('../../config/logger');

const prisma = new PrismaClient();

const login = async (email, password, ip, userAgent) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('Identifiants incorrects'), { statusCode: 401 });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    logger.warn(`Tentative connexion échouée : ${email} depuis ${ip}`);
    throw Object.assign(new Error('Identifiants incorrects'), { statusCode: 401 });
  }

  const payload = { id: user.id, role: user.role, email: user.email };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken, lastLogin: new Date() },
  });

  await prisma.activite.create({
    data: {
      userId: user.id,
      type: 'CONNEXION',
      action: 'Connexion au système',
      ipAddress: ip,
      userAgent,
    },
  });

  logger.info(`Connexion réussie : ${email} (${user.role})`);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      telephone: user.telephone,
    },
  };
};

const logout = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
  await prisma.activite.create({
    data: { userId, type: 'DECONNEXION', action: 'Déconnexion du système' },
  });
};

const refreshToken = async (token) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw Object.assign(new Error('Refresh token invalide'), { statusCode: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || user.refreshToken !== token || !user.isActive) {
    throw Object.assign(new Error('Session invalide'), { statusCode: 401 });
  }

  const payload = { id: user.id, role: user.role, email: user.email };
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: newRefreshToken },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nom: true, prenom: true, email: true, role: true, telephone: true, lastLogin: true },
  });
  if (!user) throw Object.assign(new Error('Utilisateur introuvable'), { statusCode: 404 });
  return user;
};

module.exports = { login, logout, refreshToken, getMe };
