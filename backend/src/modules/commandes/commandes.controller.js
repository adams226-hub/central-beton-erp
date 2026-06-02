const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./commandes.service');
const { generateDevis, generateFactureProforma } = require('../../utils/pdf');
const prisma = require('../../config/prisma');
const parametresService = require('../parametres/parametres.service');

const listerCommandes = asyncHandler(async (req, res) => {
  const result = await service.listerCommandes(req.user, req.query);
  res.json({ success: true, data: result });
});

const getCommande = asyncHandler(async (req, res) => {
  const commande = await service.getCommande(req.params.id);
  res.json({ success: true, data: commande });
});

const creerCommande = asyncHandler(async (req, res) => {
  const commande = await service.creerCommande(req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Commande créée avec succès', data: commande });
});

const modifierCommande = asyncHandler(async (req, res) => {
  const commande = await service.modifierCommande(req.params.id, req.body, req.user.id);
  res.json({ success: true, message: 'Commande modifiée', data: commande });
});

const validerCommande = asyncHandler(async (req, res) => {
  const commande = await service.validerCommande(req.params.id, req.user.id, req.body.commentaire);
  res.json({ success: true, message: 'Commande validée', data: commande });
});

const rejeterCommande = asyncHandler(async (req, res) => {
  await service.rejeterCommande(req.params.id, req.user.id, req.body.motif);
  res.json({ success: true, message: 'Commande rejetée' });
});

const getStatistiques = asyncHandler(async (req, res) => {
  const stats = await service.getStatistiques();
  res.json({ success: true, data: stats });
});

const genererPDF = asyncHandler(async (req, res) => {
  const commande = await service.getCommande(req.params.id);
  const f = commande.formulation;
  const v = commande.volumeBeton || 0;

  // Recalcul des coûts matières individuels depuis la formulation stockée
  const coutCiment    = f ? Math.round((commande.totalCiment || 0) * f.prixCiment) : 0;
  const coutGravier515 = f ? Math.round((commande.totalGravier515 || 0) * f.prixGravier515) : 0;
  const coutGravier1525= f ? Math.round((commande.totalGravier1525 || 0) * f.prixGravier1525) : 0;
  const coutSable      = f ? Math.round((commande.totalSable || 0) * f.prixSable) : 0;
  const coutPowerflow  = f ? Math.round((commande.totalPowerflow || 0) * (f.prixPowerflow || 1750)) : 0;

  const params = await parametresService.get();
  const VOL_REF = params.volumeRefMensuel ?? 200;
  const ratio   = v > 0 ? v / VOL_REF : 0;
  const fraisRestauration = Math.ceil(v / VOL_REF) * (params.nbRepasRef ?? 12) * (params.fraisRestaurationPlat ?? 1500);
  const nbRepas   = Math.ceil(v / VOL_REF) * (params.nbRepasRef ?? 12);
  const prixRepas = params.fraisRestaurationPlat ?? 1500;
  const fraisTransport = commande.fraisTransport || 0;
  const distance       = commande.distanceLivraison || 0;

  // Charges d'exploitation
  const fraisLoyer         = Math.round(params.loyerMensuel ?? 500_000);
  const fraisAutresCharges = Math.round(params.fraisGenerauxMensuels ?? 150_000);
  const fraisImpots        = Math.round((commande.montantCommande || 0) * (params.impotsTaux ?? 0.05));
  const chargesExploitation = fraisLoyer + fraisAutresCharges + fraisImpots;

  // Détails individuels pour le PDF budget
  const gasoilGroupeL   = f ? Math.round(f.gasoilGroupe   * ratio) : 0;
  const gasoilToupieL   = f ? Math.round(f.gasoilToupie   * ratio) : 0;
  const gasoilChargeurL = f ? Math.round(f.gasoilChargeur * ratio) : 0;
  const gasoilPompeL    = f ? Math.round(f.gasoilPompe    * ratio) : 0;
  const totalHydrofuge  = f ? Math.round(f.hydrofuge * v) : 0;
  const coutHydrofuge   = f ? Math.round(totalHydrofuge * (f.prixHydrofuge || 2750)) : 0;

  const amortToupieH    = f ? Math.round(f.hToupie    * ratio * 100) / 100 : 0;
  const amortPompeH     = f ? Math.round(f.hPompe     * ratio * 100) / 100 : 0;
  const amortCentraleH  = f ? Math.round(f.hCentrale  * ratio * 100) / 100 : 0;
  const amortGroupeH    = f ? Math.round(f.hGroupe    * ratio * 100) / 100 : 0;
  const amortChargeuseH = f ? Math.round(f.hChargeuse * ratio * 100) / 100 : 0;

  const calculs = {
    totalCiment:     commande.totalCiment,
    totalGravier515: commande.totalGravier515,
    totalGravier1525:commande.totalGravier1525,
    totalSable:      commande.totalSable,
    totalPowerflow:  commande.totalPowerflow,
    totalGasoil:     commande.totalGasoil,
    totalHydrofuge,
    coutCiment, coutGravier515, coutGravier1525, coutSable, coutPowerflow, coutHydrofuge,
    coutMateriaux:     commande.coutMateriaux,
    coutGasoil:        commande.coutGasoil,
    coutAmortissement: commande.coutAmortissement,
    coutPersonnel:     commande.coutPersonnel,
    fraisRestauration, nbRepas, prixRepas,
    fraisTransport,
    coutTotal:         commande.coutTotal,
    coutUnitaire:      commande.coutUnitaire,
    margePrevisionnelle: commande.margePrevisionnelle,
    tauxMarge:         commande.tauxMarge,
    fraisLoyer, fraisAutresCharges, fraisImpots,
    chargesExploitation,
    beneficeReel:      commande.beneficeReel || (commande.margePrevisionnelle || 0) - chargesExploitation,
    tauxBeneficeReel:  commande.tauxBeneficeReel || 0,
    // Gasoil détail
    gasoilGroupeL, gasoilToupieL, gasoilChargeurL, gasoilPompeL,
    // Amort détail
    amortToupieH, amortPompeH, amortCentraleH, amortGroupeH, amortChargeuseH,
    amortToupieRate:    f?.amortToupie    || 6648,
    amortPompeRate:     f?.amortPompe     || 33300,
    amortCentraleRate:  f?.amortCentrale  || 17200,
    amortGroupeRate:    f?.amortGroupe    || 7500,
    amortChargeuseRate: f?.amortChargeuse || 45550,
    amortToupieF:    Math.round((f?.amortToupie    || 6648)  * amortToupieH),
    amortPompeF:     Math.round((f?.amortPompe     || 33300) * amortPompeH),
    amortCentraleF:  Math.round((f?.amortCentrale  || 17200) * amortCentraleH),
    amortGroupeF:    Math.round((f?.amortGroupe    || 7500)  * amortGroupeH),
    amortChargeuseF: Math.round((f?.amortChargeuse || 45550) * amortChargeuseH),
    // Prix unitaires
    prixCiment:    f?.prixCiment    || 105500,
    prixSable:     f?.prixSable     || 16000,
    prixGravier515:f?.prixGravier515|| 11500,
    prixGravier1525:f?.prixGravier1525||11500,
    prixPowerflow: f?.prixPowerflow || 1750,
    prixHydrofuge: f?.prixHydrofuge || 2750,
    prixGasoil:    params.prixGasoil ?? 675,
  };

  const doc = generateDevis(commande, calculs);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="devis-${commande.reference}.pdf"`);
  doc.pipe(res);
  doc.end();
});

const genererFactureProforma = asyncHandler(async (req, res) => {
  const commande = await service.getCommande(req.params.id);
  const doc = generateFactureProforma(commande);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="proforma-${commande.reference}.pdf"`);
  doc.pipe(res);
  doc.end();
});

const supprimerCommande = asyncHandler(async (req, res) => {
  const commande = await prisma.commande.findUnique({ where: { id: req.params.id } });
  if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable' });
  if (commande.statut !== 'BROUILLON' && req.user.role !== 'PDG') {
    return res.status(403).json({ success: false, message: 'Seul le PDG peut supprimer une commande validée' });
  }
  await prisma.commande.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Commande supprimée' });
});

module.exports = { listerCommandes, getCommande, creerCommande, modifierCommande, validerCommande, rejeterCommande, getStatistiques, genererPDF, genererFactureProforma, supprimerCommande };
