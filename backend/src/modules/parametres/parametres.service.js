const prisma = require('../../config/prisma');

const SINGLETON_ID = 'singleton';

const get = async () => {
  let p = await prisma.parametresERP.findFirst();
  if (!p) {
    p = await prisma.parametresERP.create({ data: { id: SINGLETON_ID } });
  }
  return p;
};

const update = async (data, userId) => {
  const existing = await prisma.parametresERP.findFirst();
  if (!existing) {
    return prisma.parametresERP.create({ data: { id: SINGLETON_ID, ...data, updatedById: userId } });
  }
  return prisma.parametresERP.update({
    where: { id: existing.id },
    data: { ...data, updatedById: userId },
  });
};

module.exports = { get, update };
