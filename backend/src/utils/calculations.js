// Bordereau de prix AMP BETON (FCFA/m³)
const TARIF_BORDEREAU = {
  1: { C5: 66000, C15: 76000, C20: 91000,  C25: 98000,  C30: 108000, C35: 119000, C40: 126000 },
  2: { C5: 75000, C15: 86500, C20: 101000, C25: 106000, C30: 117000, C35: 128000, C40: 134000 },
  3: { C5: 78000, C15: 91000, C20: 107000, C25: 114000, C30: 124000, C35: 135000, C40: 141000 },
};

// Prix unitaire bordereau selon type béton + distance
const getBordereauPrixUnitaire = (typeBeton, distance) => {
  const d = parseFloat(distance) || 0;
  let zone = 0;
  if (d > 0 && d <= 50)   zone = 1;
  else if (d <= 100)       zone = 2;
  else if (d <= 150)       zone = 3;
  if (!zone || !typeBeton) return 0;
  return TARIF_BORDEREAU[zone]?.[typeBeton] ?? 0;
};

// Détermine la zone et les heures de trajet selon la distance
const getZoneInfo = (distance) => {
  const d = parseFloat(distance) || 0;
  if (d <= 0)   return { zone: 0, heures: 0 };
  if (d <= 50)  return { zone: 1, heures: 1.5 };
  if (d <= 100) return { zone: 2, heures: 4.0 };
  return            { zone: 3, heures: 6.0 };
};

const calculerBesoinsCommande = (volume, formulation, montantCommande = 0, distance = 0, params = {}, remisePct = 0, options = {}) => {
  const v = parseFloat(volume);
  if (!v || v <= 0) throw Object.assign(new Error('Volume doit être supérieur à 0'), { statusCode: 400 });
  const d  = parseFloat(distance) || 0;
  const f  = formulation;

  // Si montant non fourni → auto-calcul depuis le bordereau
  if (!montantCommande || montantCommande <= 0) {
    const prixUnit = getBordereauPrixUnitaire(f.typeBeton, d);
    if (prixUnit > 0) montantCommande = Math.round(prixUnit * v);
  }

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
  const VOYAGES_CAPACITE        = 10;   // m³ par voyage

  const { heures: heuresZone, zone: zoneNum } = getZoneInfo(d);
  const Nvoyage = d > 0 ? Math.ceil(v / VOYAGES_CAPACITE) : 0;
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

  // Retardateur de prise
  const totalRetardateur = (f.retardateur || 0) * v;
  const coutRetardateur  = totalRetardateur * (f.prixRetardateur || 0);

  // Accélérateur de prise
  const totalAccelerateur = (f.accelerateur || 0) * v;
  const coutAccelerateur  = totalAccelerateur * (f.prixAccelerateur || 0);

  // Powerflow : 1% du poids de ciment
  const cimentKgParM3  = f.ciment * 1000;
  const totalPowerflow = POWERFLOW_TENEUR * cimentKgParM3 * v;
  const coutPowerflow  = totalPowerflow * f.prixPowerflow;

  const coutMateriaux = coutCiment + coutTransportCiment
    + coutGravier515 + coutGravier1525
    + coutSable + coutHydrofuge + coutRetardateur + coutAccelerateur + coutPowerflow;

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
  const AMORT_TOUPIE_RATE    = 6648;
  const AMORT_POMPE_RATE     = 33200;
  const AMORT_GROUPE_RATE    = 7500;
  const AMORT_CHARGEUSE_RATE = 45550;

  const amortToupieH   = zoneNum > 0 ? Nvoyage * zoneNum : 0;
  const amortToupieF   = amortToupieH * AMORT_TOUPIE_RATE;

  const amortPompeH    = zoneNum > 0 ? (v / 100) * 1.3 + zoneNum : 0;
  const amortPompeF    = amortPompeH * AMORT_POMPE_RATE;

  // Groupe & Chargeuse : métrique volume (volume / 60) × facteur
  const amortGroupeH    = (v / 60) * AMORT_GROUPE_FACTOR;
  const amortGroupeF    = amortGroupeH * AMORT_GROUPE_RATE;

  const amortChargeuseH = (v / 60) * AMORT_CHARGEUSE_FACTOR;
  const amortChargeuseF = amortChargeuseH * AMORT_CHARGEUSE_RATE;

  // Centrale (inchangée)
  const amortCentraleH  = f.hCentrale * ratio;
  const amortCentraleF  = f.amortCentrale * amortCentraleH;
  const coutAmortissement = amortToupieF + amortPompeF + amortGroupeF + amortChargeuseF + amortCentraleF;

  // ── 4. PERSONNEL & RESTAURATION (options commande prioritaires) ─────────
  const inclPerso  = options.includePersonnel !== undefined ? options.includePersonnel : (f.includePersonnel !== false);
  const inclRepas  = options.includeRestauration !== undefined ? options.includeRestauration : (f.includeRestauration !== false);
  const coutPersonnel     = inclPerso  ? v * CHARGE_PERS : 0;
  const fraisRestauration = inclRepas  ? Math.ceil(v / VOL_REF) * NB_REPAS * FRAIS_REPAS : 0;

  // ── 5. FRAIS SUPPLÉMENTAIRES (péage, autres — options commande prioritaires)
  const peageUnit  = options.fraisPeage  !== undefined ? parseFloat(options.fraisPeage)  : (f.fraisPeage  || 0);
  const autresVal  = options.autresFrais !== undefined ? parseFloat(options.autresFrais) : (f.autresFrais || 0);
  const coutPeage  = d > 0 ? peageUnit * Nvoyage : 0;
  const coutAutres = autresVal;
  const fraisSupp     = coutPeage + coutAutres;

  // ── 6. TOTAUX ────────────────────────────────────────────────────────────
  const coutTotal    = coutMateriaux + coutGasoil + coutAmortissement + coutPersonnel + fraisRestauration + fraisSupp;
  const coutUnitaire = coutTotal / v;

  // Remise sur montant de vente
  const remise             = parseFloat(remisePct) || 0;
  const montantApresRemise = montantCommande > 0 ? montantCommande * (1 - remise / 100) : 0;
  const montantRemise      = montantCommande > 0 ? montantCommande * (remise / 100) : 0;

  const margePrevisionnelle = montantApresRemise > 0 ? montantApresRemise - coutTotal : 0;
  const tauxMarge = montantApresRemise > 0 ? (margePrevisionnelle / montantApresRemise) * 100 : 0;

  const fraisLoyer          = LOYER;
  const fraisAutresCharges  = FRAIS_GEN;
  const fraisImpots         = montantApresRemise > 0 ? montantApresRemise * IMPOTS_TAUX : 0;
  const chargesExploitation = fraisLoyer + fraisAutresCharges + fraisImpots;
  const beneficeReel        = margePrevisionnelle - chargesExploitation;
  const tauxBeneficeReel    = montantApresRemise > 0 ? (beneficeReel / montantApresRemise) * 100 : 0;

  return {
    // Quantités matières
    totalCiment:      Math.round(totalCiment * 1000) / 1000,
    totalSable:       Math.round(totalSable * 100) / 100,
    totalGravier515:  Math.round(totalGravier515 * 100) / 100,
    totalGravier1525: Math.round(totalGravier1525 * 100) / 100,
    totalEau:         Math.round(totalEau),
    totalHydrofuge:    Math.round(totalHydrofuge * 100) / 100,
    totalRetardateur:  Math.round(totalRetardateur * 100) / 100,
    totalAccelerateur: Math.round(totalAccelerateur * 100) / 100,
    totalPowerflow:    Math.round(totalPowerflow * 100) / 100,
    totalGasoil:      Math.round(totalGasoil),

    // Coûts matières (pour PDF)
    coutCiment:           Math.round(coutCiment),
    coutTransportCiment:  Math.round(coutTransportCiment),
    coutSable:            Math.round(coutSable),
    coutGravier515:       Math.round(coutGravier515),
    coutGravier1525:      Math.round(coutGravier1525),
    coutHydrofuge:        Math.round(coutHydrofuge),
    coutRetardateur:      Math.round(coutRetardateur),
    coutAccelerateur:     Math.round(coutAccelerateur),
    coutPowerflow:        Math.round(coutPowerflow),

    // Gasoil détaillé (pour PDF)
    gasoilGroupeL:    Math.round(gasoilGroupeL * 100) / 100,
    gasoilToupieL:    Math.round(gasoilToupieL * 100) / 100,
    gasoilChargeurL:  Math.round(gasoilChargeurL * 100) / 100,
    gasoilPompeL:     Math.round(gasoilPompeL * 100) / 100,
    prixGasoil:       PRIX_GASOIL,
    prixTransportCiment: PRIX_TRANSPORT,

    // Amortissements détaillés (pour PDF)
    amortToupieRate:    AMORT_TOUPIE_RATE,
    amortToupieH:       Math.round(amortToupieH * 100) / 100,
    amortToupieF:       Math.round(amortToupieF),
    amortPompeRate:     AMORT_POMPE_RATE,
    amortPompeH:        Math.round(amortPompeH * 100) / 100,
    amortPompeF:        Math.round(amortPompeF),
    amortCentraleRate:  f.amortCentrale,
    amortCentraleH:     Math.round(amortCentraleH * 100) / 100,
    amortCentraleF:     Math.round(amortCentraleF),
    amortGroupeRate:    AMORT_GROUPE_RATE,
    amortGroupeH:       Math.round(amortGroupeH * 100) / 100,
    amortGroupeF:       Math.round(amortGroupeF),
    amortChargeuseRate: AMORT_CHARGEUSE_RATE,
    amortChargeuseH:    Math.round(amortChargeuseH * 100) / 100,
    amortChargeuseF:    Math.round(amortChargeuseF),

    // Restauration
    nbRepas:  (f.includeRestauration !== false) ? Math.ceil(v / VOL_REF) * NB_REPAS : 0,
    prixRepas: FRAIS_REPAS,

    // Frais supplémentaires
    coutPeage:   Math.round(coutPeage),
    coutAutres:  Math.round(coutAutres),
    fraisSupp:   Math.round(fraisSupp),

    // Remise
    montantRemise:      Math.round(montantRemise),
    montantApresRemise: Math.round(montantApresRemise),

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

const genererReferenceCommande = async (prisma) => {
  const date = new Date();
  const day   = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year  = date.getFullYear();
  const prefixJour = `CMD-${day}-${month}-${year}-`;

  const derniere = await prisma.commande.findFirst({
    where: { reference: { startsWith: prefixJour } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });

  let numero = 1;
  if (derniere) {
    const parts = derniere.reference.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) numero = lastNum + 1;
  }

  return `${prefixJour}${String(numero).padStart(4, '0')}`;
};

module.exports = { calculerBesoinsCommande, genererReferenceCommande, getZoneInfo, getBordereauPrixUnitaire, TARIF_BORDEREAU };
