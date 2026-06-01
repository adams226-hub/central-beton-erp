const GASOIL_TOUPIE_L_PER_100KM = 35;

const calculerBesoinsCommande = (volume, formulation, montantCommande = 0, distance = 0, params = {}) => {
  const v = parseFloat(volume);
  if (!v || v <= 0) throw Object.assign(new Error('Volume doit être supérieur à 0'), { statusCode: 400 });
  const d = parseFloat(distance) || 0;
  const f = formulation;

  // Constantes depuis DB avec fallbacks
  const LOYER          = params.loyerMensuel          ?? 500_000;
  const FRAIS_GEN      = params.fraisGenerauxMensuels ?? 150_000;
  const VOL_REF        = params.volumeRefMensuel       ?? 200;
  const PRIX_GASOIL_V  = params.prixGasoil             ?? 675;
  const CHARGE_PERS    = params.chargePersonnelM3      ?? 245;
  const FRAIS_REPAS    = params.fraisRestaurationPlat  ?? 1_500;
  const NB_REPAS       = params.nbRepasRef             ?? 12;
  const IMPOTS_TAUX    = params.impotsTaux             ?? 0.05;
  const FRAIS_CHAUFFEUR = params.fraisChauffeurKm      ?? 500;

  // Besoins matières
  const totalCiment    = v * f.ciment;
  const totalSable     = v * f.sable;
  const totalGravier515  = v * f.gravier515;
  const totalGravier1525 = v * f.gravier1525;
  const totalEau       = v * f.eau;
  const totalHydrofuge = v * f.hydrofuge;
  const totalPowerflow = v * f.powerflow;

  // Coûts matières
  const coutCiment     = totalCiment    * f.prixCiment;
  const coutSable      = totalSable     * f.prixSable;
  const coutGravier515 = totalGravier515  * f.prixGravier515;
  const coutGravier1525= totalGravier1525 * f.prixGravier1525;
  const coutHydrofuge  = totalHydrofuge * f.prixHydrofuge;
  const coutPowerflow  = totalPowerflow * f.prixPowerflow;
  const coutMateriaux  = coutCiment + coutSable + coutGravier515 + coutGravier1525 + coutHydrofuge + coutPowerflow;

  // Gasoil production (proportionnel au volume)
  const ratio = v / VOL_REF;
  const totalGasoil = (f.gasoilGroupe + f.gasoilToupie + f.gasoilChargeur + f.gasoilPompe) * ratio;
  const coutGasoil  = totalGasoil * PRIX_GASOIL_V;

  // Transport aller-retour
  const fraisTransport = d > 0
    ? Math.round(d * 2 * (GASOIL_TOUPIE_L_PER_100KM / 100) * PRIX_GASOIL_V + d * FRAIS_CHAUFFEUR)
    : 0;

  // Amortissements
  const coutAmortissement =
    (f.amortToupie   * f.hToupie   +
     f.amortPompe    * f.hPompe    +
     f.amortCentrale * f.hCentrale +
     f.amortGroupe   * f.hGroupe   +
     f.amortChargeuse* f.hChargeuse) * ratio;

  // Personnel & restauration
  const coutPersonnel    = v * CHARGE_PERS;
  const fraisRestauration = Math.ceil(v / VOL_REF) * NB_REPAS * FRAIS_REPAS;

  // Coût total de production
  const coutTotal    = coutMateriaux + coutGasoil + coutAmortissement + coutPersonnel + fraisRestauration + fraisTransport;
  const coutUnitaire = coutTotal / v;

  // Marge commerciale
  const margePrevisionnelle = montantCommande > 0 ? montantCommande - coutTotal : 0;
  const tauxMarge = montantCommande > 0 ? (margePrevisionnelle / montantCommande) * 100 : 0;

  // Charges d'exploitation — montants FIXES depuis paramètres (pas proratisés par volume)
  const fraisLoyer         = LOYER;
  const fraisAutresCharges = FRAIS_GEN;
  const fraisImpots        = montantCommande > 0 ? montantCommande * IMPOTS_TAUX : 0;
  const chargesExploitation = fraisLoyer + fraisAutresCharges + fraisImpots;

  // Bénéfice réel net
  const beneficeReel       = margePrevisionnelle - chargesExploitation;
  const tauxBeneficeReel   = montantCommande > 0 ? (beneficeReel / montantCommande) * 100 : 0;

  return {
    totalCiment:      Math.round(totalCiment),
    totalSable:       Math.round(totalSable * 100) / 100,
    totalGravier515:  Math.round(totalGravier515 * 100) / 100,
    totalGravier1525: Math.round(totalGravier1525 * 100) / 100,
    totalEau:         Math.round(totalEau),
    totalHydrofuge:   Math.round(totalHydrofuge * 100) / 100,
    totalPowerflow:   Math.round(totalPowerflow * 100) / 100,
    totalGasoil:      Math.round(totalGasoil),

    coutCiment:       Math.round(coutCiment),
    coutSable:        Math.round(coutSable),
    coutGravier515:   Math.round(coutGravier515),
    coutGravier1525:  Math.round(coutGravier1525),
    coutPowerflow:    Math.round(coutPowerflow),

    coutMateriaux:      Math.round(coutMateriaux),
    coutGasoil:         Math.round(coutGasoil),
    coutAmortissement:  Math.round(coutAmortissement),
    coutPersonnel:      Math.round(coutPersonnel),
    fraisRestauration:  Math.round(fraisRestauration),
    fraisTransport:     Math.round(fraisTransport),

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

module.exports = { calculerBesoinsCommande, genererReferenceCommande };
