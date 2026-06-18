const { PrismaClient } = require('@prisma/client');

const base = process.env.DATABASE_URL || '';
// pgbouncer=true : indique à Prisma de ne pas utiliser les prepared statements
// (obligatoire avec Supabase PgBouncer en Transaction mode)
// connection_limit=5 : le pooler Supabase gère déjà les vraies connexions DB
let poolUrl = base;
if (!poolUrl.includes('pgbouncer=true'))    poolUrl += (poolUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
if (!poolUrl.includes('connection_limit'))  poolUrl += '&connection_limit=2';
if (!poolUrl.includes('pool_timeout'))      poolUrl += '&pool_timeout=20';

const prisma = new PrismaClient({
  datasources: {
    db: { url: poolUrl },
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Reconnexion automatique sur perte de connexion
const withRetry = (fn, retries = 3, delayMs = 1000) => async (...args) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn(...args);
    } catch (err) {
      const isConnectionError =
        err.message?.includes("Can't reach database") ||
        err.message?.includes('Connection refused') ||
        err.message?.includes('connection pool') ||
        err.code === 'P1001' ||
        err.code === 'P1002' ||
        err.code === 'P1008' ||
        err.code === 'P1017';

      if (isConnectionError && i < retries - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        try { await prisma.$connect(); } catch (_) {}
        continue;
      }
      throw err;
    }
  }
};

// Ping périodique pour maintenir la connexion active (toutes les 4 minutes)
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (_) {
    try { await prisma.$connect(); } catch (__) {}
  }
}, 4 * 60 * 1000);

module.exports = prisma;
