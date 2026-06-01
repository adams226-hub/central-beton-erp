require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { initSocket } = require('./config/socket');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const logger = require('./config/logger');

// Phase 1 Routes
const authRoutes = require('./modules/auth/auth.routes');
const commandesRoutes = require('./modules/commandes/commandes.routes');
const formulationsRoutes = require('./modules/formulations/formulations.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const usersRoutes = require('./modules/users/users.routes');

// Phase 2 Routes
const stocksRoutes = require('./modules/stocks/stocks.routes');
const productionRoutes = require('./modules/production/production.routes');
const equipementsRoutes = require('./modules/equipements/equipements.routes');
const livraisonsRoutes = require('./modules/livraisons/livraisons.routes');
const paiementsRoutes = require('./modules/paiements/paiements.routes');
const rapportsRoutes = require('./modules/rapports/rapports.routes');

// Phase 3 Routes
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const alertesRoutes = require('./modules/alertes/alertes.routes');

const app = express();
const server = http.createServer(app);

// Initialiser Socket.io
const io = initSocket(server);
app.set('io', io);

// ─── Middlewares globaux ──────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL, 'https://centralabeton.netlify.app'].filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (origin.endsWith('.netlify.app') || origin.endsWith('.onrender.com')) return cb(null, true);
    cb(new Error(`CORS bloqué : ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { success: false, message: 'Trop de requêtes.' } });
app.use('/api', limiter);
app.use('/uploads', express.static(process.env.UPLOAD_DIR || 'uploads'));

// ─── Routes Phase 1 ──────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/commandes', commandesRoutes);
app.use('/api/formulations', formulationsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/users', usersRoutes);

// ─── Routes Phase 2 ──────────────────────────────────
app.use('/api/stocks', stocksRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/equipements', equipementsRoutes);
app.use('/api/livraisons', livraisonsRoutes);
app.use('/api/paiements', paiementsRoutes);
app.use('/api/rapports', rapportsRoutes);

// ─── Routes Phase 3 ──────────────────────────────────
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alertes', alertesRoutes);

// ─── Paramètres ERP ──────────────────────────────────
app.use('/api/parametres', require('./modules/parametres/parametres.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'AMP BETON ERP v2.0 — Opérationnel', timestamp: new Date().toISOString() });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`🚀 AMP BETON ERP v2.0 démarré — Port ${PORT}`);
  logger.info(`🌍 Mode : ${process.env.NODE_ENV || 'development'}`);
  logger.info(`📡 WebSocket temps réel activé`);
  logger.info(`📦 Phase 2 : Production, Stocks, Équipements, Livraisons, Paiements`);
});

module.exports = { app, server };
