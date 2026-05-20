const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initialisation AMP BÉTON ERP Phase 2...\n');

  // ─── Utilisateurs ─────────────────────────────────
  const users = [
    { nom: 'BATIONO', prenom: 'Romacic', email: 'pdg@ampbeton.bf', password: 'Admin@2026', role: 'PDG', telephone: '+226 70 00 00 01' },
    { nom: 'OUEDRAOGO', prenom: 'Fatima', email: 'secretaire@ampbeton.bf', password: 'Secret@2026', role: 'SECRETAIRE', telephone: '+226 70 00 00 02' },
    { nom: 'SAVADOGO', prenom: 'Landry', email: 'chefsite@ampbeton.bf', password: 'Chef@2026', role: 'CHEF_DE_SITE', telephone: '+226 70 00 00 03' },
    { nom: 'SANOU', prenom: 'Nachia', email: 'chefcomptable@ampbeton.bf', password: 'Chef@Compta2026', role: 'CHEF_COMPTABLE', telephone: '+226 70 00 00 04' },
    { nom: 'KABORE', prenom: 'Aïssata', email: 'asstcomptable@ampbeton.bf', password: 'Asst@Compta2026', role: 'ASSISTANT_COMPTABLE', telephone: '+226 70 00 00 06' },
    { nom: 'KONE', prenom: 'Ibrahim', email: 'operateur@ampbeton.bf', password: 'Operat@2026', role: 'OPERATEUR', telephone: '+226 70 00 00 05' },
  ];

  const createdUsers = {};
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: await bcrypt.hash(u.password, 10) },
    });
    createdUsers[u.role] = user;
    console.log(`✅ User : ${u.prenom} ${u.nom} (${u.role})`);
  }

  const chefId = createdUsers['CHEF_DE_SITE'].id;

  // ─── Formulations ──────────────────────────────────
  const formulations = [
    { nom: 'Béton C25/30 Standard', typeBeton: 'C25/30', ciment: 350, sable: 0.5, gravier515: 0.44, gravier1525: 0.775, eau: 175, hydrofuge: 0, powerflow: 4, prixCiment: 105500, prixSable: 16000, prixGravier515: 11500, prixGravier1525: 11500, prixEau: 0, prixHydrofuge: 2750, prixPowerflow: 1750, coutUnitaire: 86179, createdById: chefId },
    { nom: 'Béton C30/37 Haute Résistance', typeBeton: 'C30/37', ciment: 400, sable: 0.48, gravier515: 0.42, gravier1525: 0.78, eau: 165, hydrofuge: 2, powerflow: 5, prixCiment: 105500, prixSable: 16000, prixGravier515: 11500, prixGravier1525: 11500, prixEau: 0, prixHydrofuge: 2750, prixPowerflow: 1750, coutUnitaire: 96000, createdById: chefId },
    { nom: 'Béton C20/25 Économique', typeBeton: 'C20/25', ciment: 300, sable: 0.52, gravier515: 0.45, gravier1525: 0.77, eau: 185, hydrofuge: 0, powerflow: 0, prixCiment: 105500, prixSable: 16000, prixGravier515: 11500, prixGravier1525: 11500, prixEau: 0, prixHydrofuge: 2750, prixPowerflow: 1750, coutUnitaire: 74000, createdById: chefId },
  ];

  for (const f of formulations) {
    await prisma.formulation.upsert({ where: { typeBeton: f.typeBeton }, update: {}, create: f });
    console.log(`✅ Formulation : ${f.nom}`);
  }

  // ─── Stocks initiaux ────────────────────────────────
  const stocks = [
    { materiau: 'CIMENT', designation: 'Ciment CPA 42.5', quantite: 500000, unite: 'kg', seuilAlerte: 100000, seuilCritique: 50000, prixUnitaire: 105.5, fournisseur: 'CIMFASO' },
    { materiau: 'SABLE', designation: 'Sable naturel lavé', quantite: 500, unite: 'm³', seuilAlerte: 100, seuilCritique: 50, prixUnitaire: 16000, fournisseur: 'Carrière BF' },
    { materiau: 'GRAVIER_515', designation: 'Gravier 5/15', quantite: 400000, unite: 'kg', seuilAlerte: 80000, seuilCritique: 40000, prixUnitaire: 11.5, fournisseur: 'Gravière du Faso' },
    { materiau: 'GRAVIER_1525', designation: 'Gravier 15/25', quantite: 700000, unite: 'kg', seuilAlerte: 140000, seuilCritique: 70000, prixUnitaire: 11.5, fournisseur: 'Gravière du Faso' },
    { materiau: 'EAU', designation: 'Eau de gâchage', quantite: 50000, unite: 'L', seuilAlerte: 10000, seuilCritique: 5000, prixUnitaire: 0, fournisseur: 'ONEA' },
    { materiau: 'HYDROFUGE', designation: 'Hydrofuge liquide', quantite: 2000, unite: 'L', seuilAlerte: 400, seuilCritique: 200, prixUnitaire: 2750, fournisseur: 'Sika BF' },
    { materiau: 'POWERFLOW', designation: 'Powerflow 6425 (Plastifiant)', quantite: 3000, unite: 'L', seuilAlerte: 600, seuilCritique: 300, prixUnitaire: 1750, fournisseur: 'Sika BF' },
    { materiau: 'GASOIL', designation: 'Gasoil (carburant)', quantite: 5000, unite: 'L', seuilAlerte: 1000, seuilCritique: 500, prixUnitaire: 675, fournisseur: 'Total Energie BF' },
  ];

  for (const s of stocks) {
    await prisma.stockMatiere.upsert({ where: { materiau: s.materiau }, update: {}, create: s });
    console.log(`✅ Stock : ${s.designation} — ${s.quantite} ${s.unite}`);
  }

  // ─── Équipements ────────────────────────────────────
  const equipements = [
    { nom: 'Toupie BFM-01', code: 'TOUPIE-01', type: 'TOUPIE', marque: 'LIEBHERR', modele: 'HTM 904', coutAcquisition: 45000000, dureeVieHeures: 15000, coutHoraire: 3000, valeurActuelle: 45000000, heuresRevision: 500, prochainRevisionH: 500, consoCarburantHeure: 8 },
    { nom: 'Toupie BFM-02', code: 'TOUPIE-02', type: 'TOUPIE', marque: 'LIEBHERR', modele: 'HTM 904', coutAcquisition: 45000000, dureeVieHeures: 15000, coutHoraire: 3000, valeurActuelle: 42000000, heuresUtilisees: 1000, heuresRevision: 500, consoCarburantHeure: 8 },
    { nom: 'Pompe à béton P-01', code: 'POMPE-01', type: 'POMPE_BETON', marque: 'SCHWING', modele: 'S36X', coutAcquisition: 80000000, dureeVieHeures: 18000, coutHoraire: 4444, valeurActuelle: 80000000, heuresRevision: 250, prochainRevisionH: 250, consoCarburantHeure: 12 },
    { nom: 'Chargeur Komatsu', code: 'CHARGE-01', type: 'CHARGEUR', marque: 'KOMATSU', modele: 'WA200', coutAcquisition: 55000000, dureeVieHeures: 12000, coutHoraire: 4583, valeurActuelle: 55000000, heuresRevision: 250, prochainRevisionH: 250, consoCarburantHeure: 10 },
    { nom: 'Groupe électrogène', code: 'GROUPE-01', type: 'GROUPE_ELECTROGENE', marque: 'PERKINS', modele: '250 kVA', coutAcquisition: 25000000, dureeVieHeures: 20000, coutHoraire: 1250, valeurActuelle: 25000000, heuresRevision: 500, prochainRevisionH: 500, consoCarburantHeure: 15 },
    { nom: 'Centrale à béton CAB-01', code: 'CENTRALE-01', type: 'CENTRALE_BETON', marque: 'SIMEM', modele: 'MASTER 60', coutAcquisition: 120000000, dureeVieHeures: 25000, coutHoraire: 4800, valeurActuelle: 120000000, heuresRevision: 1000, prochainRevisionH: 1000, consoCarburantHeure: 0 },
  ];

  for (const e of equipements) {
    const coutH = e.coutAcquisition / e.dureeVieHeures;
    await prisma.equipement.upsert({
      where: { code: e.code },
      update: {},
      create: { ...e, coutHoraire: Math.round(coutH * 100) / 100 },
    });
    console.log(`✅ Équipement : ${e.nom} (${e.type}) — Coût/h : ${Math.round(coutH).toLocaleString('fr-FR')} FCFA`);
  }

  console.log('\n🎉 AMP BÉTON ERP Phase 2 initialisé !\n');
  console.log('📋 Comptes disponibles :');
  console.log('   PDG          : pdg@ampbeton.bf          / Admin@2026');
  console.log('   Secrétaire   : secretaire@ampbeton.bf   / Secret@2026');
  console.log('   Chef de site : chefsite@ampbeton.bf     / Chef@2026');
  console.log('   Comptable    : comptable@ampbeton.bf    / Compta@2026');
  console.log('   Opérateur    : operateur@ampbeton.bf    / Operat@2026');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
