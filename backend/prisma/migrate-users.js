// Script de migration : mise à jour des rôles comptables
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migration des utilisateurs comptables...\n');

  // Mettre à jour SANOU Nachia : COMPTABLE → CHEF_COMPTABLE + nouveau email
  const sanou = await prisma.user.findFirst({ where: { nom: 'SANOU', prenom: 'Nachia' } });
  if (sanou) {
    await prisma.user.update({
      where: { id: sanou.id },
      data: { role: 'CHEF_COMPTABLE', email: 'chefcomptable@ampbeton.bf', password: await bcrypt.hash('Chef@Compta2026', 10) },
    });
    console.log('✅ SANOU Nachia → CHEF_COMPTABLE (chefcomptable@ampbeton.bf / Chef@Compta2026)');
  } else {
    // Si introuvable, créer directement
    await prisma.user.upsert({
      where: { email: 'chefcomptable@ampbeton.bf' },
      update: {},
      create: { nom: 'SANOU', prenom: 'Nachia', email: 'chefcomptable@ampbeton.bf', password: await bcrypt.hash('Chef@Compta2026', 10), role: 'CHEF_COMPTABLE', telephone: '+226 70 00 00 04' },
    });
    console.log('✅ Chef Comptable SANOU Nachia créé (chefcomptable@ampbeton.bf)');
  }

  // Créer KABORE Aïssata : ASSISTANT_COMPTABLE
  await prisma.user.upsert({
    where: { email: 'asstcomptable@ampbeton.bf' },
    update: {},
    create: { nom: 'KABORE', prenom: 'Aïssata', email: 'asstcomptable@ampbeton.bf', password: await bcrypt.hash('Asst@Compta2026', 10), role: 'ASSISTANT_COMPTABLE', telephone: '+226 70 00 00 06' },
  });
  console.log('✅ KABORE Aïssata créée (asstcomptable@ampbeton.bf / Asst@Compta2026)');

  console.log('\n📋 Comptes comptables :');
  console.log('   Chef Comptable    : chefcomptable@ampbeton.bf  / Chef@Compta2026');
  console.log('   Asst. Comptable   : asstcomptable@ampbeton.bf  / Asst@Compta2026');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
