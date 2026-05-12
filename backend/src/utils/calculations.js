/**
 * Moteur de calcul automatique pour commandes béton
 * Calcule tous les besoins matières, coûts et marges
 */

const calculerBesoinsCommande = (volume, formulation, montantCommande = 0) => {
  const v = parseFloat(volume);
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
  const coutCiment = (totalCiment / 1000) * f.prixCiment;   // tonnes × prix/tonne
  const coutSable = totalSable * f.prixSable;                // m³ × prix/m³
  const coutGravier515 = totalGravier515 * f.prixGravier515; // tonnes × prix
  const coutGravier1525 = totalGravier1525 * f.prixGravier1525;
  const coutHydrofuge = totalHydrofuge * f.prixHydrofuge;
  const coutPowerflow = totalPowerflow * f.prixPowerflow;

  const coutMateriaux = coutCiment + coutSable + coutGravier515 +
    coutGravier1525 + coutHydrofuge + coutPowerflow;

  // ─── Gasoil (proportionnel au volume / 200 m³ de référence) ─────────────
  const ratio = v / 200;
  const gasoilGroupe = f.gasoilGroupe * ratio;
  const gasoilToupie = f.gasoilToupie * ratio;
  const gasoilChargeur = f.gasoilChargeur * ratio;
  const gasoilPompe = f.gasoilPompe * ratio;
  const totalGasoil = gasoilGroupe + gasoilToupie + gasoilChargeur + gasoilPompe;
  const coutGasoil = totalGasoil * 675; // FCFA/litre

  // ─── Amortissements matériels ──────────────────────────────────────────
  const amortToupie = f.amortToupie * f.hToupie * ratio;
  const amortPompe = f.amortPompe * f.hPompe * ratio;
  const amortCentrale = f.amortCentrale * f.hCentrale * ratio;
  const amortGroupe = f.amortGroupe * f.hGroupe * ratio;
  const amortChargeuse = f.amortChargeuse * f.hChargeuse * ratio;
  const coutAmortissement = amortToupie + amortPompe + amortCentrale + amortGroupe + amortChargeuse;

  // ─── Personnel ─────────────────────────────────────────────────────────
  const coutPersonnel = v * 245; // 245 FCFA/m³

  // ─── Restauration & Divers ─────────────────────────────────────────────
  const fraisRestauration = Math.ceil(v / 200) * 12 * 1500;

  // ─── Total ─────────────────────────────────────────────────────────────
  const coutTotal = coutMateriaux + coutGasoil + coutAmortissement + coutPersonnel + fraisRestauration;
  const coutUnitaire = coutTotal / v;

  // ─── Marge ─────────────────────────────────────────────────────────────
  const margePrevisionnelle = montantCommande > 0 ? montantCommande - coutTotal : 0;
  const tauxMarge = montantCommande > 0 ? (margePrevisionnelle / montantCommande) * 100 : 0;

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

    // Coûts détaillés
    coutMateriaux: Math.round(coutMateriaux),
    coutGasoil: Math.round(coutGasoil),
    coutAmortissement: Math.round(coutAmortissement),
    coutPersonnel: Math.round(coutPersonnel),
    fraisRestauration: Math.round(fraisRestauration),

    // Totaux
    coutTotal: Math.round(coutTotal),
    coutUnitaire: Math.round(coutUnitaire),
    margePrevisionnelle: Math.round(margePrevisionnelle),
    tauxMarge: Math.round(tauxMarge * 100) / 100,
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
