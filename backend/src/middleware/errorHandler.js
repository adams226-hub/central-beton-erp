const logger = require('../config/logger');

const notFound = (req, res, next) => {
  const error = new Error(`Route introuvable : ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Erreur interne du serveur';

  if (statusCode >= 500) {
    logger.error('Erreur serveur', { message, stack: err.stack, url: req.originalUrl, method: req.method });
  } else {
    logger.warn('Erreur client', { message, url: req.originalUrl, method: req.method });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { notFound, errorHandler, asyncHandler };
