/**
 * Moteur de calcul automatique pour commandes béton
 * Calcule tous les besoins matières, coûts, marges et bénéfice réel
 * Les constantes financières sont injectées via le paramètre `params`
 * (récupérées depuis la table parametres_erp en base)
 */

// Taux de consommation gasoil toupie pour la livraison (fixe technique)
const GASOIL_TOUPIE_L_PER_100KM = 35;   // L/100km

const calculerBesoinsCommande = (volume, formulation, montantCommande = 0, distance = 0, params = {}) => {
  const v = parseFloat(volume);
  const d = parseFloat(distance) || 0;
  const f = formulation;

  // ─── Constantes financières (depuis DB ou valeurs par défaut) ──────────
  const LOYER          = params.loyerMensuel          ?? 500_000;
  const FRAIS_GEN      = params.fraisGenerauxMensuels ?? 150_000;
  const VOL_REF        = params.volumeRefMensuel       ?? 200;
  const PRIX_GASOIL_V  = params.prixGasoil             ?? 675;
  const CHARGE_PERS    = params.chargePersonnelM3      ?? 245;
  const FRAIS_REPAS    = params.fraisRestaurationPlat  ?? 1_500;
  const NB_REPAS       = params.nbRepasRef             ?? 12;
  const IMPOTS_TAUX    = params.impotsTaux             ?? 0.05;
  const FRAIS_CHAUFFEUR = params.fraisChauffeurKm      ?? 500;

  // ─── Besoins matières totaux ───────────────────────────────────────────
  const totalCiment = v * f.ciment;           // tonnes totales
  const totalSable = v * f.sable;             // m³ totaux
  const totalGravier515 = v * f.gravier515;   // tonnes totales
  const totalGravier1525 = v * f.gravier1525; // tonnes totales
  const totalEau = v * f.eau;                 // litres totaux
  const totalHydrofuge = v * f.hydrofuge;     // litres totaux
  const totalPowerflow = v * f.powerflow;     // litres totaux

  // ─── Coûts matières ────────────────────────────────────────────────────
  const coutCiment = totalCiment * f.prixCiment;
  const coutSable = totalSable * f.prixSable;
  const coutGravier515 = totalGravier515 * f.prixGravier515;
  const coutGravier1525 = totalGravier1525 * f.prixGravier1525;
  const coutHydrofuge = totalHydrofuge * f.prixHydrofuge;
  const coutPowerflow = totalPowerflow * f.prixPowerflow;

  const coutMateriaux = coutCiment + coutSable + coutGravier515 +
    coutGravier1525 + coutHydrofuge + coutPowerflow;

  // ─── Gasoil production (proportionnel au volume / VOL_REF de référence) ─
  const ratio = v / VOL_REF;
  const gasoilGroupe = f.gasoilGroupe * ratio;
  const gasoilToupie = f.gasoilToupie * ratio;
  const gasoilChargeur = f.gasoilChargeur * ratio;
  const gasoilPompe = f.gasoilPompe * ratio;
  const totalGasoil = gasoilGroupe + gasoilToupie + gasoilChargeur + gasoilPompe;
  const coutGasoil = totalGasoil * PRIX_GASOIL_V;

  // ─── Transport (aller-retour selon distance de livraison) ───────────────
  // Carburant aller-retour + frais chauffeur/route
  const fraisTransport = d > 0
    ? Math.round(d * 2 * (GASOIL_TOUPIE_L_PER_100KM / 100) * PRIX_GASOIL_V + d * FRAIS_CHAUFFEUR)
    : 0;

  // ─── Amortissements matériels ──────────────────────────────────────────
  const amortToupie = f.amortToupie * f.hToupie * ratio;
  const amortPompe = f.amortPompe * f.hPompe * ratio;
  const amortCentrale = f.amortCentrale * f.hCentrale * ratio;
  const amortGroupe = f.amortGroupe * f.hGroupe * ratio;
  const amortChargeuse = f.amortChargeuse * f.hChargeuse * ratio;
  const coutAmortissement = amortToupie + amortPompe + amortCentrale + amortGroupe + amortChargeuse;

  // ─── Personnel ─────────────────────────────────────────────────────────
  const coutPersonnel = v * CHARGE_PERS;

  // ─── Restauration & Divers ─────────────────────────────────────────────
  const fraisRestauration = Math.ceil(v / VOL_REF) * NB_REPAS * FRAIS_REPAS;

  // ─── Coût total de production (inclut transport) ───────────────────────
  const coutTotal = coutMateriaux + coutGasoil + coutAmortissement +
    coutPersonnel + fraisRestauration + fraisTransport;
  const coutUnitaire = coutTotal / v;

  // ─── Marge commerciale ─────────────────────────────────────────────────
  const margePrevisionnelle = montantCommande > 0 ? montantCommande - coutTotal : 0;
  const tauxMarge = montantCommande > 0 ? (margePrevisionnelle / montantCommande) * 100 : 0;

  // ─── Charges d'exploitation (loyer, impôts, frais généraux) ────────────
  // Proratisées sur le volume produit
  const fraisLoyer = (LOYER / VOL_REF) * v;
  const fraisAutresCharges = (FRAIS_GEN / VOL_REF) * v;
  const fraisImpots = montantCommande > 0 ? montantCommande * IMPOTS_TAUX : 0;
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
