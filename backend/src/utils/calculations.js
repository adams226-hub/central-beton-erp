/**
 * Moteur de calcul automatique pour commandes béton
 * Calcule tous les besoins matières, coûts, marges et bénéfice réel
 */

// Charges d'exploitation mensuelles (loyer, taxes, frais généraux)
// Proratisées au m³ sur base de 200 m³/mois de production de référence
const CHARGES_FIXES = {
  loyerMensuel: 500_000,      // FCFA/mois — location de la centrale
  autresMensuel: 150_000,     // FCFA/mois — eau, électricité, bureau
  impotsTaux: 0.05,           // 5% du CA — impôts et taxes
  volumeRefMensuel: 200,      // m³/mois de référence pour proratisation
};

// Taux de consommation gasoil toupie pour la livraison
const GASOIL_TOUPIE_L_PER_100KM = 35;   // L/100km
const PRIX_GASOIL = 675;                  // FCFA/L
const FRAIS_CHAUFFEUR_PER_KM = 500;       // FCFA/km (chauffeur + frais de route)

const calculerBesoinsCommande = (volume, formulation, montantCommande = 0, distance = 0) => {
  const v = parseFloat(volume);
  const d = parseFloat(distance) || 0;
  const f = formulation;

  // ─── Besoins matières totaux ───────────────────────────────────────────
  const totalCiment = v * f.ciment;           // kg totaux
  const totalSable = v * f.sable;             // m³ totaux
  const totalGravier515 = v * f.gravier515;   // tonnes totales
  const totalGravier1525 = v * f.gravier1525; // tonnes totales
  const totalEau = v * f.eau;                 // litres totaux
  const totalHydrofuge = v * f.hydrofuge;     // litres totaux
  const totalPowerflow = v * f.powerflow;     // litres totaux

  // ─── Coûts matières ────────────────────────────────────────────────────
  const coutCiment = (totalCiment / 1000) * f.prixCiment;
  const coutSable = totalSable * f.prixSable;
  const coutGravier515 = totalGravier515 * f.prixGravier515;
  const coutGravier1525 = totalGravier1525 * f.prixGravier1525;
  const coutHydrofuge = totalHydrofuge * f.prixHydrofuge;
  const coutPowerflow = totalPowerflow * f.prixPowerflow;

  const coutMateriaux = coutCiment + coutSable + coutGravier515 +
    coutGravier1525 + coutHydrofuge + coutPowerflow;

  // ─── Gasoil production (proportionnel au volume / 200 m³ de référence) ──
  const ratio = v / 200;
  const gasoilGroupe = f.gasoilGroupe * ratio;
  const gasoilToupie = f.gasoilToupie * ratio;
  const gasoilChargeur = f.gasoilChargeur * ratio;
  const gasoilPompe = f.gasoilPompe * ratio;
  const totalGasoil = gasoilGroupe + gasoilToupie + gasoilChargeur + gasoilPompe;
  const coutGasoil = totalGasoil * PRIX_GASOIL;

  // ─── Transport (aller-retour selon distance de livraison) ───────────────
  // Carburant aller-retour + frais chauffeur/route
  const fraisTransport = d > 0
    ? Math.round(d * 2 * (GASOIL_TOUPIE_L_PER_100KM / 100) * PRIX_GASOIL + d * FRAIS_CHAUFFEUR_PER_KM)
    : 0;

  // ─── Amortissements matériels ──────────────────────────────────────────
  const amortToupie = f.amortToupie * f.hToupie * ratio;
  const amortPompe = f.amortPompe * f.hPompe * ratio;
  const amortCentrale = f.amortCentrale * f.hCentrale * ratio;
  const amortGroupe = f.amortGroupe * f.hGroupe * ratio;
  const amortChargeuse = f.amortChargeuse * f.hChargeuse * ratio;
  const coutAmortissement = amortToupie + amortPompe + amortCentrale + amortGroupe + amortChargeuse;

  // ─── Personnel ─────────────────────────────────────────────────────────
  const coutPersonnel = v * 245;

  // ─── Restauration & Divers ─────────────────────────────────────────────
  const fraisRestauration = Math.ceil(v / 200) * 12 * 1500;

  // ─── Coût total de production (inclut transport) ───────────────────────
  const coutTotal = coutMateriaux + coutGasoil + coutAmortissement +
    coutPersonnel + fraisRestauration + fraisTransport;
  const coutUnitaire = coutTotal / v;

  // ─── Marge commerciale ─────────────────────────────────────────────────
  const margePrevisionnelle = montantCommande > 0 ? montantCommande - coutTotal : 0;
  const tauxMarge = montantCommande > 0 ? (margePrevisionnelle / montantCommande) * 100 : 0;

  // ─── Charges d'exploitation (loyer, impôts, frais généraux) ────────────
  // Proratisées sur le volume produit
  const fraisLoyer = (CHARGES_FIXES.loyerMensuel / CHARGES_FIXES.volumeRefMensuel) * v;
  const fraisAutresCharges = (CHARGES_FIXES.autresMensuel / CHARGES_FIXES.volumeRefMensuel) * v;
  const fraisImpots = montantCommande > 0 ? montantCommande * CHARGES_FIXES.impotsTaux : 0;
  const chargesExploitation = fraisLoyer + fraisAutresCharges + fraisImpots;

  // ─── Bénéfice réel net ─────────────────────────────────────────────────
  const beneficeReel = margePrevisionnelle - chargesExploitation;
  const tauxBeneficeReel = montantCommande > 0 ? (beneficeReel / montantCommande) * 100 : 0;

  return {
    // Matières
    totalCiment: Math.round(totalCiment),
    totalSable: Math.round(totalSable * 100) / 100,
    totalGravier515: Math.round(totalGravier515 * 100) / 100,
    totalGravier1525: Math.round(totalGravier1525 * 100) / 100,
    totalEau: Math.round(totalEau),
    totalHydrofuge: Math.round(totalHydrofuge * 100) / 100,
    totalPowerflow: Math.round(totalPowerflow * 100) / 100,
    totalGasoil: Math.round(totalGasoil),

    // Coûts matières détaillés (pour PDF)
    coutCiment: Math.round(coutCiment),
    coutSable: Math.round(coutSable),
    coutGravier515: Math.round(coutGravier515),
    coutGravier1525: Math.round(coutGravier1525),
    coutPowerflow: Math.round(coutPowerflow),

    // Coûts détaillés
    coutMateriaux: Math.round(coutMateriaux),
    coutGasoil: Math.round(coutGasoil),
    coutAmortissement: Math.round(coutAmortissement),
    coutPersonnel: Math.round(coutPersonnel),
    fraisRestauration: Math.round(fraisRestauration),
    fraisTransport: Math.round(fraisTransport),

    // Totaux production
    coutTotal: Math.round(coutTotal),
    coutUnitaire: Math.round(coutUnitaire),

    // Marge commerciale
    margePrevisionnelle: Math.round(margePrevisionnelle),
    tauxMarge: Math.round(tauxMarge * 100) / 100,

    // Charges d'exploitation (usage interne)
    fraisLoyer: Math.round(fraisLoyer),
    fraisImpots: Math.round(fraisImpots),
    fraisAutresCharges: Math.round(fraisAutresCharges),
    chargesExploitation: Math.round(chargesExploitation),

    // Bénéfice réel
    beneficeReel: Math.round(beneficeReel),
    tauxBeneficeReel: Math.round(tauxBeneficeReel * 100) / 100,
  };
};

const genererReferenceCommande = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `CMD-${year}${month}-${rand}`;
};

module.exports = { calculerBesoinsCommande, genererReferenceCommande };
