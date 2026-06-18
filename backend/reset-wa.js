const prisma = require('./src/config/prisma');
prisma.whatsAppAuthState.deleteMany({ where: { operatorId: 'amp-beton-main' } })
  .then(r => { console.log('Session supprimee:', r.count, 'entrees'); })
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
