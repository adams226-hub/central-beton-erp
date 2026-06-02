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

  // Toujours recalculer depuis la formulation actuelle (évite les valeurs stale en base)
  const totalCiment     = f ? Math.round(f.ciment     * v * 10) / 10 : 0;
  const totalGravier515 = f ? Math.round(f.gravier515 * v * 10) / 10 : 0;
  const totalGravier1525= f ? Math.round(f.gravier1525* v * 10) / 10 : 0;
  const totalSable      = f ? Math.round(f.sable      * v * 10) / 10 : 0;
  const totalPowerflow  = f ? Math.round(f.powerflow  * v)            : 0;
  const ratio = v / 200;
  const totalGasoilGroupe   = f ? Math.round(f.gasoilGroupe   * ratio) : 0;
  const totalGasoilToupie   = f ? Math.round(f.gasoilToupie   * ratio) : 0;
  const totalGasoilChargeur = f ? Math.round(f.gasoilChargeur * ratio) : 0;
  const totalGasoilPompe    = f ? Math.round(f.gasoilPompe    * ratio) : 0;
  const totalGasoil = totalGasoilGroupe + totalGasoilToupie + totalGasoilChargeur + totalGasoilPompe;

  const prixGasoil = 675;
  const coutCiment     = f ? Math.round(totalCiment     * f.prixCiment)    : 0;
  const coutGravier515 = f ? Math.round(totalGravier515 * f.prixGravier515): 0;
  const coutGravier1525= f ? Math.round(totalGravier1525* f.prixGravier1525): 0;
  const coutSable      = f ? Math.round(totalSable      * f.prixSable)     : 0;
  const coutPowerflow  = f ? Math.round(totalPowerflow  * (f.prixPowerflow || 1750)) : 0;
  const coutMateriaux  = coutCiment + coutGravier515 + coutGravier1525 + coutSable + coutPowerflow;

  const coutGasoilGroupe   = totalGasoilGroupe   * prixGasoil;
  const coutGasoilToupie   = totalGasoilToupie   * prixGasoil;
  const coutGasoilChargeur = totalGasoilChargeur * prixGasoil;
  const coutGasoilPompe    = totalGasoilPompe    * prixGasoil;
  const coutGasoil = coutGasoilGroupe + coutGasoilToupie + coutGasoilChargeur + coutGasoilPompe;

  const coutAmortissement = f ? Math.round(
    (f.amortToupie * f.hToupie + f.amortPompe * f.hPompe +
     f.amortCentrale * f.hCentrale + f.amortGroupe * f.hGroupe +
     f.amortChargeuse * f.hChargeuse) * ratio
  ) : 0;

  const params = await parametresService.get();
  const fraisRestauration = Math.ceil(v / 200) * 12 * (params.fraisRestaurationPlat ?? 1500);
  const fraisTransport    = commande.fraisTransport || 0;
  const distance          = commande.distanceLivraison || 0;
  const coutPersonnel     = Math.round(v * (params.chargePersonnelM3 ?? 245));

  const coutTotal   = coutMateriaux + coutGasoil + coutAmortissement + coutPersonnel + fraisRestauration + fraisTransport;
  const coutUnitaire = v > 0 ? Math.round(coutTotal / v) : 0;
  const margePrevisionnelle = commande.montantCommande ? Math.round(commande.montantCommande - coutTotal) : 0;
  const tauxMarge = commande.montantCommande > 0 ? Math.round((margePrevisionnelle / commande.montantCommande) * 10000) / 100 : 0;

  const fraisLoyer         = Math.round(params.loyerMensuel ?? 500_000);
  const fraisAutresCharges = Math.round(params.fraisGenerauxMensuels ?? 150_000);
  const fraisImpots        = Math.round((commande.montantCommande || 0) * (params.impotsTaux ?? 0.05));
  const chargesExploitation = fraisLoyer + fraisAutresCharges + fraisImpots;
  const beneficeReel       = margePrevisionnelle - chargesExploitation;
  const tauxBeneficeReel   = commande.montantCommande > 0 ? Math.round((beneficeReel / commande.montantCommande) * 10000) / 100 : 0;

  const calculs = {
    totalCiment, totalGravier515, totalGravier1525, totalSable, totalPowerflow, totalGasoil,
    totalGasoilGroupe, totalGasoilToupie, totalGasoilChargeur, totalGasoilPompe,
    coutCiment, coutGravier515, coutGravier1525, coutSable, coutPowerflow,
    coutGasoilGroupe, coutGasoilToupie, coutGasoilChargeur, coutGasoilPompe,
    coutMateriaux, coutGasoil, coutAmortissement, coutPersonnel,
    fraisRestauration, fraisTransport,
    amortToupie:    f ? Math.round(f.amortToupie    * f.hToupie    * ratio) : 0,
    amortPompe:     f ? Math.round(f.amortPompe     * f.hPompe     * ratio) : 0,
    amortCentrale:  f ? Math.round(f.amortCentrale  * f.hCentrale  * ratio) : 0,
    amortGroupe:    f ? Math.round(f.amortGroupe     * f.hGroupe    * ratio) : 0,
    amortChargeuse: f ? Math.round(f.amortChargeuse * f.hChargeuse * ratio) : 0,
    hToupie: f ? Math.round(f.hToupie * ratio * 10) / 10 : 0,
    hPompe:  f ? Math.round(f.hPompe  * ratio * 10) / 10 : 0,
    hCentrale: f ? Math.round(f.hCentrale * ratio * 10) / 10 : 0,
    hGroupe:   f ? Math.round(f.hGroupe   * ratio * 10) / 10 : 0,
    hChargeuse: f ? Math.round(f.hChargeuse * ratio * 10) / 10 : 0,
    coutTotal, coutUnitaire, margePrevisionnelle, tauxMarge,
    fraisLoyer, fraisAutresCharges, fraisImpots, chargesExploitation,
    beneficeReel, tauxBeneficeReel,
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
