// Détermine la zone et les heures de trajet selon la distance
const getZoneInfo = (distance) => {
  const d = parseFloat(distance) || 0;
  if (d <= 0)   return { zone: 0, heures: 0 };
  if (d <= 50)  return { zone: 1, heures: 1.5 };
  if (d <= 100) return { zone: 2, heures: 4.0 };
  return            { zone: 3, heures: 6.0 };
};

const calculerBesoinsCommande = (volume, formulation, montantCommande = 0, distance = 0, params = {}) => {
  const v = parseFloat(volume);
  if (!v || v <= 0) throw Object.assign(new Error('Volume doit être supérieur à 0'), { statusCode: 400 });
  const d  = parseFloat(distance) || 0;
  const f  = formulation;

  // ── Constantes depuis paramètres DB ──────────────────────────────────────
  const PRIX_GASOIL    = params.prixGasoil            ?? 1205;
  const PRIX_TRANSPORT = params.prixTransportCiment    ?? 2350;
  const MARGE_CIMENT   = params.margeCiment            ?? 1.05;
  const MARGE_GRAVIER  = params.margeGravier           ?? 1.10;
  const MARGE_SABLE    = params.margeSable             ?? 1.10;
  const CHARGE_PERS    = params.chargePersonnelM3      ?? 245;
  const FRAIS_REPAS    = params.fraisRestaurationPlat  ?? 1500;
  const NB_REPAS       = params.nbRepasRef             ?? 12;
  const VOL_REF        = params.volumeRefMensuel       ?? 200;
  const IMPOTS_TAUX    = params.impotsTaux             ?? 0.05;
  const LOYER          = params.loyerMensuel           ?? 500000;
  const FRAIS_GEN      = params.fraisGenerauxMensuels  ?? 150000;

  // Constantes physiques fixes
  const POWERFLOW_TENEUR        = 0.01;  // 1% du poids de ciment
  const CONSO_TOUPIE_VIDE       = 0.35; // L/km
  const CONSO_TOUPIE_PLEIN      = 0.45; // L/km
  const CONSO_IDLE              = 15;   // L/voyage (idling)
  const CONSO_CHARGEUR_REF      = 180;  // L pour VOL_REF m³
  const AMORT_POMPE_FACTOR      = 1.3;
  const AMORT_GROUPE_FACTOR     = 1.3;
  const AMORT_CHARGEUSE_FACTOR  = 1.1;
  const VOYAGES_CAPACITE        = 11;   // m³ par voyage

  const { heures: heuresZone } = getZoneInfo(d);
  const Nvoyage = d > 0 ? Math.ceil(v / VOYAGES_CAPACITE) + 2 : 0;
  const ratio   = v / VOL_REF;

  // ── 1. MATIÈRES PREMIÈRES ────────────────────────────────────────────────
  // Ciment (t/m³ stocké)
  const totalCiment    = f.ciment * v * MARGE_CIMENT;
  const coutCiment     = totalCiment * f.prixCiment;
  const coutTransportCiment = totalCiment * PRIX_TRANSPORT;

  // Gravier (t/m³ stocké)
  const totalGravier515  = f.gravier515  * v * MARGE_GRAVIER;
  const totalGravier1525 = f.gravier1525 * v * MARGE_GRAVIER;
  const coutGravier515   = totalGravier515  * f.prixGravier515;
  const coutGravier1525  = totalGravier1525 * f.prixGravier1525;

  // Sable (m³/m³ stocké) — marge appliquée en m³
  const totalSable  = f.sable * v * MARGE_SABLE;
  const coutSable   = totalSable * f.prixSable;

  // Eau (informatif, pas de coût)
  const totalEau = f.eau * v;

  // Hydrofuge
  const totalHydrofuge = (f.hydrofuge || 0) * v;
  const coutHydrofuge  = totalHydrofuge * (f.prixHydrofuge || 2750);

  // Powerflow : 1% du poids de ciment
  const cimentKgParM3  = f.ciment * 1000;
  const totalPowerflow = POWERFLOW_TENEUR * cimentKgParM3 * v;
  const coutPowerflow  = totalPowerflow * f.prixPowerflow;

  const coutMateriaux = coutCiment + coutTransportCiment
    + coutGravier515 + coutGravier1525
    + coutSable + coutHydrofuge + coutPowerflow;

  // ── 2. GASOIL ────────────────────────────────────────────────────────────
  let gasoilGroupeL, gasoilToupieL, gasoilChargeurL, gasoilPompeL, coutGasoil;

  if (d > 0) {
    gasoilGroupeL   = (v * f.gasoilGroupe) / VOL_REF;
    gasoilToupieL   = (d * CONSO_TOUPIE_VIDE + d * CONSO_TOUPIE_PLEIN) * Nvoyage
                      + Nvoyage * CONSO_IDLE;
    gasoilChargeurL = (v * CONSO_CHARGEUR_REF) / VOL_REF;
    gasoilPompeL    = v + (d * CONSO_TOUPIE_PLEIN * 2);
    coutGasoil      = (gasoilGroupeL + gasoilToupieL + gasoilChargeurL + gasoilPompeL) * PRIX_GASOIL;
  } else {
    gasoilGroupeL   = f.gasoilGroupe   * ratio;
    gasoilToupieL   = f.gasoilToupie   * ratio;
    gasoilChargeurL = f.gasoilChargeur * ratio;
    gasoilPompeL    = f.gasoilPompe    * ratio;
    coutGasoil      = (gasoilGroupeL + gasoilToupieL + gasoilChargeurL + gasoilPompeL) * PRIX_GASOIL;
  }
  const totalGasoil = gasoilGroupeL + gasoilToupieL + gasoilChargeurL + gasoilPompeL;

  // ── 3. AMORTISSEMENTS ────────────────────────────────────────────────────
  let amortToupieH, amortToupieF;
  let amortPompeH,  amortPompeF;
  let amortGroupeH, amortGroupeF;
  let amortChargeuseH, amortChargeuseF;
  let amortCentraleH, amortCentraleF;

  if (d > 0) {
    amortToupieH    = Nvoyage * heuresZone;
    amortToupieF    = amortToupieH * f.amortToupie;

    amortPompeH     = heuresZone * AMORT_POMPE_FACTOR;
    amortPompeF     = amortPompeH * f.amortPompe;

    amortGroupeH    = (v / d) * AMORT_GROUPE_FACTOR;
    amortGroupeF    = amortGroupeH * f.amortGroupe;

    amortChargeuseH = (v / d) * AMORT_CHARGEUSE_FACTOR;
    amortChargeuseF = amortChargeuseH * f.amortChargeuse;

    amortCentraleH  = f.hCentrale * ratio;
    amortCentraleF  = f.amortCentrale * amortCentraleH;
  } else {
    amortToupieH    = f.hToupie    * ratio;
    amortPompeH     = f.hPompe     * ratio;
    amortGroupeH    = f.hGroupe    * ratio;
    amortChargeuseH = f.hChargeuse * ratio;
    amortCentraleH  = f.hCentrale  * ratio;

    amortToupieF    = f.amortToupie    * amortToupieH;
    amortPompeF     = f.amortPompe     * amortPompeH;
    amortGroupeF    = f.amortGroupe    * amortGroupeH;
    amortChargeuseF = f.amortChargeuse * amortChargeuseH;
    amortCentraleF  = f.amortCentrale  * amortCentraleH;
  }
  const coutAmortissement = amortToupieF + amortPompeF + amortGroupeF + amortChargeuseF + amortCentraleF;

  // ── 4. PERSONNEL & RESTAURATION ─────────────────────────────────────────
  const coutPersonnel     = v * CHARGE_PERS;
  const fraisRestauration = Math.ceil(v / VOL_REF) * NB_REPAS * FRAIS_REPAS;

  // ── 5. TOTAUX ────────────────────────────────────────────────────────────
  const coutTotal    = coutMateriaux + coutGasoil + coutAmortissement + coutPersonnel + fraisRestauration;
  const coutUnitaire = coutTotal / v;

  const margePrevisionnelle = montantCommande > 0 ? montantCommande - coutTotal : 0;
  const tauxMarge = montantCommande > 0 ? (margePrevisionnelle / montantCommande) * 100 : 0;

  const fraisLoyer          = LOYER;
  const fraisAutresCharges  = FRAIS_GEN;
  const fraisImpots         = montantCommande > 0 ? montantCommande * IMPOTS_TAUX : 0;
  const chargesExploitation = fraisLoyer + fraisAutresCharges + fraisImpots;
  const beneficeReel        = margePrevisionnelle - chargesExploitation;
  const tauxBeneficeReel    = montantCommande > 0 ? (beneficeReel / montantCommande) * 100 : 0;

  return {
    // Quantités matières
    totalCiment:      Math.round(totalCiment * 1000) / 1000,
    totalSable:       Math.round(totalSable * 100) / 100,
    totalGravier515:  Math.round(totalGravier515 * 100) / 100,
    totalGravier1525: Math.round(totalGravier1525 * 100) / 100,
    totalEau:         Math.round(totalEau),
    totalHydrofuge:   Math.round(totalHydrofuge * 100) / 100,
    totalPowerflow:   Math.round(totalPowerflow * 100) / 100,
    totalGasoil:      Math.round(totalGasoil),

    // Coûts matières (pour PDF)
    coutCiment:           Math.round(coutCiment),
    coutTransportCiment:  Math.round(coutTransportCiment),
    coutSable:            Math.round(coutSable),
    coutGravier515:       Math.round(coutGravier515),
    coutGravier1525:      Math.round(coutGravier1525),
    coutPowerflow:        Math.round(coutPowerflow),

    // Gasoil détaillé (pour PDF)
    gasoilGroupeL:    Math.round(gasoilGroupeL * 100) / 100,
    gasoilToupieL:    Math.round(gasoilToupieL * 100) / 100,
    gasoilChargeurL:  Math.round(gasoilChargeurL * 100) / 100,
    gasoilPompeL:     Math.round(gasoilPompeL * 100) / 100,
    prixGasoil:       PRIX_GASOIL,
    prixTransportCiment: PRIX_TRANSPORT,

    // Amortissements détaillés (pour PDF)
    amortToupieRate:    f.amortToupie,
    amortToupieH:       Math.round(amortToupieH * 100) / 100,
    amortToupieF:       Math.round(amortToupieF),
    amortPompeRate:     f.amortPompe,
    amortPompeH:        Math.round(amortPompeH * 100) / 100,
    amortPompeF:        Math.round(amortPompeF),
    amortCentraleRate:  f.amortCentrale,
    amortCentraleH:     Math.round(amortCentraleH * 100) / 100,
    amortCentraleF:     Math.round(amortCentraleF),
    amortGroupeRate:    f.amortGroupe,
    amortGroupeH:       Math.round(amortGroupeH * 100) / 100,
    amortGroupeF:       Math.round(amortGroupeF),
    amortChargeuseRate: f.amortChargeuse,
    amortChargeuseH:    Math.round(amortChargeuseH * 100) / 100,
    amortChargeuseF:    Math.round(amortChargeuseF),

    // Restauration
    nbRepas:  Math.ceil(v / VOL_REF) * NB_REPAS,
    prixRepas: FRAIS_REPAS,

    // Totaux DB
    coutMateriaux:      Math.round(coutMateriaux),
    coutGasoil:         Math.round(coutGasoil),
    coutAmortissement:  Math.round(coutAmortissement),
    coutPersonnel:      Math.round(coutPersonnel),
    fraisRestauration:  Math.round(fraisRestauration),
    fraisTransport:     0,

    coutTotal:    Math.round(coutTotal),
    coutUnitaire: Math.round(coutUnitaire),

    margePrevisionnelle: Math.round(margePrevisionnelle),
    tauxMarge:           Math.round(tauxMarge * 100) / 100,

    fraisLoyer:          Math.round(fraisLoyer),
    fraisImpots:         Math.round(fraisImpots),
    fraisAutresCharges:  Math.round(fraisAutresCharges),
    chargesExploitation: Math.round(chargesExploitation),

    beneficeReel:      Math.round(beneficeReel),
    tauxBeneficeReel:  Math.round(tauxBeneficeReel * 100) / 100,
  };
};

const genererReferenceCommande = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `CMD-${year}${month}-${rand}`;
};

module.exports = { calculerBesoinsCommande, genererReferenceCommande, getZoneInfo };
