const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const LOGO_PATH = path.join(__dirname, '../../assets/logo-amp.png');
const hasLogo = fs.existsSync(LOGO_PATH);

function drawLogo(doc, x, y, w, h) {
  if (!hasLogo) return;
  try { doc.image(LOGO_PATH, x, y, { fit: [w, h] }); } catch (_) {}
}

const BLEU       = '#c2410c';
const BLEU_CLAIR = '#ffedd5';
const BLEU_FONCE = '#92400e';
const GRIS       = '#6b7280';
const GRIS_LEGER = '#f9fafb';
const GRIS_MOY   = '#e5e7eb';
const VERT       = '#15803d';
const VERT_CLAIR = '#dcfce7';
const ROUGE      = '#dc2626';
const ROUGE_CLAIR= '#fee2e2';
const ORANGE     = '#d97706';
const ORANGE_CLAIR='#fef3c7';
const BLANC      = '#ffffff';
const NOIR       = '#111827';

// Formatage nombres — utilise espace ASCII simple comme séparateur milliers
const fmt  = (n) => {
  if (n == null || isNaN(Number(n))) return '0';
  return Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
const fmtF = (n) => fmt(n) + ' FCFA';
const fmtD = (n) => {
  if (n == null || isNaN(Number(n))) return '0';
  return (Math.round(Number(n) * 10) / 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// Dessine une ligne de tableau
function drawRow(doc, y, h, colWidths, values, bgColor, textColors, bolds, aligns) {
  let x = 45;
  colWidths.forEach((w, i) => {
    doc.rect(x, y, w, h).fillColor(bgColor).fill();
    const align = aligns ? aligns[i] : (i === 0 ? 'left' : 'right');
    doc.fontSize(8.5)
      .font(bolds[i] ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(textColors[i])
      .text(String(values[i] ?? ''), x + 5, y + (h - 9) / 2 + 1, {
        width: w - 10,
        align,
        lineBreak: false,
      });
    x += w;
  });
  // Bordure basse fine
  doc.moveTo(45, y + h).lineTo(45 + colWidths.reduce((a, b) => a + b, 0), y + h)
    .lineWidth(0.3).strokeColor(GRIS_MOY).stroke();
}

// Ligne de section avec fond coloré
function sectionTitle(doc, y, label, color = BLEU) {
  doc.rect(45, y, 505, 20).fillColor(color).fill();
  doc.fontSize(10).font('Helvetica-Bold').fillColor(BLANC)
    .text(label, 52, y + 5, { width: 495, lineBreak: false });
  return y + 22;
}

// Ligne financière (2 colonnes label + valeur)
function ligneFinanciere(doc, y, label, valeur, bg, textColor = NOIR, bold = false) {
  const COL = [335, 170];
  doc.rect(45, y, COL[0], 18).fillColor(bg).fill();
  doc.rect(45 + COL[0], y, COL[1], 18).fillColor(bg).fill();
  doc.fontSize(8.5)
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fillColor(textColor)
    .text(label, 50, y + 4, { width: COL[0] - 10, lineBreak: false })
    .text(valeur, 45 + COL[0], y + 4, { width: COL[1] - 8, align: 'right', lineBreak: false });
  doc.moveTo(45, y + 18).lineTo(550, y + 18).lineWidth(0.3).strokeColor(GRIS_MOY).stroke();
  return y + 18;
}

const generateDevis = (commande, calculs) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 45, bottom: 0, left: 45, right: 45 }, bufferPages: true });
  const c = commande;
  const k = calculs;
  const distance = c.distanceLivraison || 0;

  // ── EN-TÊTE ────────────────────────────────────────────────────────────
  // Bandeau bleu supérieur
  doc.rect(0, 0, 595, 38).fillColor(BLEU_FONCE).fill();
  doc.rect(42, 4, 86, 30).fillColor(BLANC).fill();
  drawLogo(doc, 43, 5, 84, 28);
  doc.fontSize(16).font('Helvetica-Bold').fillColor(BLANC).text('BUDGET FOURNITURE', 310, 10, { align: 'right', width: 240 });

  doc.fontSize(8.5).font('Helvetica').fillColor(GRIS)
    .text('Centrale à Béton — , Ouagadougou, Burkina Faso', 45, 46)
    .text('Tél : +226 04 42 92 92  |  Email : contact@ampbeton.bf', 45, 56);

  doc.fontSize(8.5).font('Helvetica').fillColor(GRIS)
    .text(`Réf : ${c.reference}`, 350, 46, { align: 'right', width: 200 })
    .text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 350, 56, { align: 'right', width: 200 });

  doc.moveTo(45, 72).lineTo(550, 72).lineWidth(1).strokeColor(BLEU_CLAIR).stroke();

  // ── INFORMATIONS CLIENT ────────────────────────────────────────────────
  let y = 82;
  y = sectionTitle(doc, y, 'INFORMATIONS CLIENT');
  y += 2;

  const ROW_H = 17;
  const infoClient = [
    ['Client', c.nomClient || '—'],
    ['Téléphone', c.telephone || '—'],
    ['Chantier / Adresse livraison', c.adresseChantier || '—'],
    ['Date livraison souhaitée', c.dateLivraison ? new Date(c.dateLivraison).toLocaleDateString('fr-FR') : '—'],
  ];
  if (distance > 0) {
    infoClient.push(['Distance de livraison', `${fmtD(distance)} km`]);
  }

  infoClient.forEach(([label, val], i) => {
    drawRow(doc, y, ROW_H, [200, 305], [label, val], i % 2 === 0 ? BLANC : GRIS_LEGER, [GRIS, NOIR], [true, false], ['left', 'left']);
    y += ROW_H;
  });

  // ── DÉTAILS DE LA COMMANDE ─────────────────────────────────────────────
  y += 6;
  y = sectionTitle(doc, y, 'DÉTAILS DE LA COMMANDE');
  y += 2;

  drawRow(doc, y, 16, [210, 55, 70, 100, 70], ['Désignation', 'Unité', 'Quantité', 'Prix unitaire', 'Montant HT'],
    BLEU, [BLANC, BLANC, BLANC, BLANC, BLANC], [true, true, true, true, true]);
  y += 16;

  // Si remise → recalculer le montant brut avant remise pour affichage
  const montantBrutDevis = (c.remisePct > 0 && c.montantCommande)
    ? Math.round(c.montantCommande * 100 / (100 - c.remisePct))
    : (c.montantCommande || 0);
  const deductionRemiseDevis = montantBrutDevis - (c.montantCommande || 0);
  const montantBaseDevis = montantBrutDevis;
  // Prix NET après remise (montantCommande est déjà post-remise)
  const remiseDevis = parseFloat(c.remisePct) || 0;
  const netFactorDevis = 1 - remiseDevis / 100;
  const montantNetBetonDevis = Math.round(montantBaseDevis * netFactorDevis);
  const prixNetBetonM3Devis = c.volumeBeton > 0 ? Math.round(montantNetBetonDevis / c.volumeBeton) : 0;
  const labelRemiseDevis = remiseDevis > 0 ? ` (remise ${fmtD(remiseDevis)}%)` : '';

  drawRow(doc, y, ROW_H, [210, 55, 70, 100, 70],
    [`Béton prêt à l'emploi ${c.typeBeton || ''}${labelRemiseDevis}`, 'm³', fmtD(c.volumeBeton),
      prixNetBetonM3Devis > 0 ? fmtF(prixNetBetonM3Devis) + '/m³' : '—', fmtF(montantNetBetonDevis)],
    '#fff7ed', [NOIR, NOIR, NOIR, NOIR, NOIR], [false, false, true, false, true]);
  y += ROW_H;

  if (distance > 0 && k.fraisTransport > 0) {
    drawRow(doc, y, ROW_H, [210, 55, 70, 100, 70],
      [`Frais de livraison (${fmtD(distance)} km A/R)`, 'forfait', '1', '—', fmtF(k.fraisTransport)],
      GRIS_LEGER, [NOIR, NOIR, NOIR, NOIR, NOIR], [false, false, false, false, false]);
    y += ROW_H;
  }

  // ── BUDGET DES DÉPENSES ────────────────────────────────────────────────
  y += 6;
  y = sectionTitle(doc, y, 'BUDGET DES DÉPENSES');
  y += 2;

  // Colonnes : Item | Désignation | Unité | Fcfa/u htva | Quantité | Montant HTVA
  const CB = [22, 178, 38, 78, 62, 127];
  const CB_ALIGNS = ['center','left','center','right','right','right'];
  const PG = k.prixGasoil || 675;

  // En-tête colonnes
  drawRow(doc, y, 15, CB,
    ['Item', 'Désignation', 'Unité', 'Fcfa/u htva', 'Quantité', 'Montant HTVA'],
    BLEU, [BLANC,BLANC,BLANC,BLANC,BLANC,BLANC], [true,true,true,true,true,true], CB_ALIGNS);
  y += 15;

  // Sous-titre Fourniture
  doc.rect(45, y, 505, 13).fillColor(GRIS_MOY).fill();
  doc.fontSize(8).font('Helvetica-Bold').fillColor(NOIR)
    .text('Fourniture — Matériaux et consommables', 50, y + 3, { width: 495, lineBreak: false });
  y += 13;

  const BG0 = BLANC;
  const BG1 = GRIS_LEGER;
  const RH = 15;
  const PAGE_MAX = doc.page.height - 80;
  let item = 1;

  const bRow = (no, des, uni, pu, qty, mt, bg) => {
    if (y + RH > PAGE_MAX) { doc.addPage(); y = 45; }
    drawRow(doc, y, RH, CB,
      [no ? String(no) : '', des, uni, pu, qty, mt],
      bg, [NOIR,NOIR,NOIR,NOIR,NOIR,NOIR], [false,false,false,false,false,false], CB_ALIGNS);
    y += RH;
  };

  bRow(item++, 'Ciment',                       't',    fmt(k.prixCiment),     fmtD(k.totalCiment),     fmtF(k.coutCiment),           BG0);
  bRow(item++, 'Transport ciment',              't',    fmt(k.prixTransportCiment || 2350), fmtD(k.totalCiment), fmtF(k.coutTransportCiment || 0), BG1);
  bRow(item++, 'Gravier 5/15',                 't',    fmt(k.prixGravier515), fmtD(k.totalGravier515),  fmtF(k.coutGravier515),       BG0);
  bRow(item++, 'Gravier 15/25',                't',    fmt(k.prixGravier1525),fmtD(k.totalGravier1525), fmtF(k.coutGravier1525),      BG1);
  bRow(item++, 'Sable Naturel (Centrale béton)','m³',  fmt(k.prixSable),      fmtD(k.totalSable),       fmtF(k.coutSable),            BG0);
  bRow(item++, 'Powerflow 6425',               'litre', fmt(k.prixPowerflow), fmt(k.totalPowerflow),    fmtF(k.coutPowerflow),        BG1);
  bRow(item++, 'Hydrofuge',                    'litre', fmt(k.prixHydrofuge), fmt(k.totalHydrofuge),    fmtF(k.coutHydrofuge),        BG0);
  if (c.useRetardateur) {
    bRow(item++, 'Retardateur de prise (additif)', 'm³', fmt(10000), fmtD(c.volumeBeton), fmtF(10000 * (c.volumeBeton || 0)), BG1);
  }
  if (c.useAccelerateur) {
    bRow(item++, 'Accélérateur de prise (additif)', 'm³', fmt(10000), fmtD(c.volumeBeton), fmtF(10000 * (c.volumeBeton || 0)), BG0);
  }
  bRow(item++, 'Gasoil groupe électrogène',    'litre', fmt(PG),              fmt(k.gasoilGroupeL),     fmtF(k.gasoilGroupeL   * PG), BG1);
  bRow(item++, 'Gasoil pour toupies',          'litre', fmt(PG),              fmt(k.gasoilToupieL),     fmtF(k.gasoilToupieL   * PG), BG0);
  bRow(item++, 'Gasoil pour chargeur',         'litre', fmt(PG),              fmt(k.gasoilChargeurL),   fmtF(k.gasoilChargeurL * PG), BG1);
  bRow(item++, 'Gasoil pour pompe à béton',    'litre', fmt(PG),              fmt(k.gasoilPompeL),      fmtF(k.gasoilPompeL    * PG), BG0);
  bRow(item++, 'Amortissement (TOUPIE)',        'H',    fmt(k.amortToupieRate),    fmtD(k.amortToupieH),    fmtF(k.amortToupieF),    BG1);
  bRow(item++, 'Amortissement (POMPE A BETON)', 'H',   fmt(k.amortPompeRate),     fmtD(k.amortPompeH),     fmtF(k.amortPompeF),     BG0);
  bRow(item++, 'Amortissement (CENTRALE BETON)','H',   fmt(k.amortCentraleRate),  fmtD(k.amortCentraleH),  fmtF(k.amortCentraleF),  BG1);
  bRow(item++, 'Amortissement (GROUPE ELECTROG.)','H', fmt(k.amortGroupeRate),    fmtD(k.amortGroupeH),    fmtF(k.amortGroupeF),    BG0);
  bRow(item++, 'Amortissement (CHARGEUSE)',     'H',   fmt(k.amortChargeuseRate), fmtD(k.amortChargeuseH), fmtF(k.amortChargeuseF), BG1);
  if ((k.fraisRestauration || 0) > 0) {
    bRow(item++, 'Frais restauration & Divers', 'plat', fmt(k.prixRepas || 1500), fmt(k.nbRepas || 0), fmtF(k.fraisRestauration), BG0);
  }

  // Coût des adjuvants affichés (retardateur / accélérateur — forfait 10 000 FCFA/m³)
  const coutAdjuvantsPDF = ((c.useRetardateur ? 1 : 0) + (c.useAccelerateur ? 1 : 0)) * 10000 * (c.volumeBeton || 0);

  // Sous-total approvisionnements + amortissement (adjuvants inclus)
  const totalAppro = (k.coutMateriaux || 0) + (k.coutGasoil || 0) + (k.coutAmortissement || 0) + (k.fraisRestauration || 0) + coutAdjuvantsPDF;
  doc.rect(45, y, 505, 17).fillColor(BLEU_CLAIR).fill();
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLEU_FONCE)
    .text('Total approvisionnements et Amortissement', 50, y + 4, { width: 380, lineBreak: false })
    .text(fmtF(totalAppro), 390, y + 4, { width: 152, align: 'right', lineBreak: false });
  y += 19;

  // Charge du personnel (si > 0)
  if ((k.coutPersonnel || 0) > 0) {
    const tauxPerso = c.volumeBeton > 0 ? Math.round(k.coutPersonnel / c.volumeBeton) : 245;
    bRow(item++, 'Charge du personnel', 'm³', fmt(tauxPerso), fmtD(c.volumeBeton), fmtF(k.coutPersonnel), BLANC);
  }

  // Frais péage (si > 0)
  if ((k.coutPeage || 0) > 0) {
    bRow(item++, 'Frais de péage', 'voyage', '—', '—', fmtF(k.coutPeage), BG1);
  }

  // Autres frais (si > 0)
  if ((k.coutAutres || 0) > 0) {
    const autresLabel = k.autresFraisLabel ? `Autres frais — ${k.autresFraisLabel}` : 'Autres frais divers';
    bRow(item++, autresLabel, 'forfait', '—', '—', fmtF(k.coutAutres), BG0);
  }

  // Totaux corrigés incluant les adjuvants
  const coutTotalPDF    = (k.coutTotal || 0) + coutAdjuvantsPDF;
  const coutUnitairePDF = c.volumeBeton > 0 ? Math.round(coutTotalPDF / c.volumeBeton) : 0;
  const remiseDevisNum  = parseFloat(c.remisePct) || 0;
  const montantVentePDF = (c.montantCommande || 0) * (1 - remiseDevisNum / 100);
  const margePDF        = montantVentePDF > 0 ? montantVentePDF - coutTotalPDF : 0;
  const tauxMargePDF    = montantVentePDF > 0 ? (margePDF / montantVentePDF) * 100 : 0;

  // Total charges de fonctionnement
  doc.rect(45, y, 505, 17).fillColor(BLEU_CLAIR).fill();
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLEU_FONCE)
    .text('Total charges de fonctionnement', 50, y + 4, { width: 380, lineBreak: false })
    .text(fmtF(coutTotalPDF), 390, y + 4, { width: 152, align: 'right', lineBreak: false });
  y += 19;

  // BUDGET TOTAL
  doc.rect(45, y, 505, 19).fillColor(BLEU_FONCE).fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(BLANC)
    .text('BUDGET TOTAL', 50, y + 5, { width: 380, lineBreak: false })
    .text(fmtF(coutTotalPDF), 390, y + 5, { width: 152, align: 'right', lineBreak: false });
  y += 21;

  // Coût de production
  doc.rect(45, y, 505, 17).fillColor(GRIS_LEGER).fill();
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NOIR)
    .text(`Coût de production (FCFA/m³)`, 50, y + 4, { width: 380, lineBreak: false })
    .text(fmtF(coutUnitairePDF), 390, y + 4, { width: 152, align: 'right', lineBreak: false });
  y += 19;

  // Montant commande + remise + marge
  if (c.montantCommande) {
    // Si remise → afficher prix brut puis déduction
    if (c.remisePct > 0 && deductionRemiseDevis > 0) {
      doc.rect(45, y, 505, 17).fillColor(BLANC).fill();
      doc.fontSize(8.5).font('Helvetica').fillColor(NOIR)
        .text(`Prix avant remise (${fmtD(c.remisePct)}%)`, 50, y + 4, { width: 380, lineBreak: false })
        .text(fmtF(montantBrutDevis), 390, y + 4, { width: 152, align: 'right', lineBreak: false });
      y += 17;

      doc.rect(45, y, 505, 17).fillColor('#FFF3CD').fill();
      doc.fontSize(8.5).font('Helvetica').fillColor('#B45309')
        .text(`Remise ${fmtD(c.remisePct)}%`, 50, y + 4, { width: 380, lineBreak: false })
        .text(`- ${fmtF(deductionRemiseDevis)}`, 390, y + 4, { width: 152, align: 'right', lineBreak: false });
      y += 17;
    }

    doc.rect(45, y, 505, 17).fillColor('#1E3A5F').fill();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANC)
      .text('Montant de vente', 50, y + 4, { width: 380, lineBreak: false })
      .text(fmtF(c.montantCommande), 390, y + 4, { width: 152, align: 'right', lineBreak: false });
    y += 17;

    const margePos   = margePDF >= 0;
    const margeBg    = margePos ? VERT_CLAIR : ROUGE_CLAIR;
    const margeColor = margePos ? VERT : ROUGE;
    doc.rect(45, y, 505, 19).fillColor(margeBg).fill();
    doc.fontSize(9).font('Helvetica-Bold').fillColor(margeColor)
      .text(`Marge Brute Bénéficiaire`, 50, y + 5, { width: 310, lineBreak: false })
      .text(`${fmtD(tauxMargePDF)}%`, 365, y + 5, { width: 70, align: 'right', lineBreak: false })
      .text(fmtF(margePDF), 390, y + 5, { width: 152, align: 'right', lineBreak: false });
    y += 21;
  }

  // ── Signatures (3 colonnes comme PDF référence) ──────────────────────────
  y += 10;
  const SIGS_D = [
    { titre: 'Responsable Usine',    nom: 'SAVADOGO WK Landry' },
    { titre: 'Comptabilité',         nom: 'SANOU Nachia' },
    { titre: 'Direction Générale',   nom: '' },
  ];
  const dSigW = 505 / 3;
  const dSigH = 55;
  // Bordure externe du bloc signatures
  doc.rect(45, y, 505, dSigH).lineWidth(0.8).strokeColor(NOIR).stroke();
  SIGS_D.forEach(({ titre, nom }, i) => {
    const sx = 45 + i * dSigW;
    // Séparateurs verticaux
    if (i > 0) doc.moveTo(sx, y).lineTo(sx, y + dSigH).lineWidth(0.5).strokeColor(NOIR).stroke();
    // Titre du rôle
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NOIR)
      .text(titre, sx + 5, y + 6, { width: dSigW - 10, align: 'left', lineBreak: false });
    // Nom de la personne en bas
    if (nom) {
      doc.fontSize(8).font('Helvetica').fillColor(NOIR)
        .text(nom, sx + 5, y + dSigH - 16, { width: dSigW - 10, align: 'left', lineBreak: false });
    }
  });
  y += dSigH + 6;

  // ── PIED DE PAGE ───────────────────────────────────────────────────────
  const pageH = doc.page.height;
  doc.rect(0, pageH - 28, 595, 28).fillColor(BLEU_FONCE).fill();
  doc.fontSize(7.5).font('Helvetica').fillColor('#fed7aa')
    .text(
      `AMP BÉTON — ERP v3.0  |  Généré le ${new Date().toLocaleString('fr-FR')}  |  contact@ampbeton.bf`,
      45, pageH - 18, { align: 'center', width: 505 }
    );

  return doc;
};

/**
 * Génère un PDF professionnel du rapport Bénéfices par commande
 */
const generateRapportBenefices = (data, dateDebut, dateFin) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 0, left: 40, right: 40 }, bufferPages: true });
  const totaux = data.totaux || {};
  const commandes = data.commandes || [];

  // ── EN-TÊTE ─────────────────────────────────────────────────────────────
  doc.rect(0, 0, 595, 40).fillColor(BLEU_FONCE).fill();
  doc.rect(37, 4, 86, 32).fillColor(BLANC).fill();
  drawLogo(doc, 38, 5, 84, 30);
  doc.fontSize(13).font('Helvetica-Bold').fillColor(BLANC)
    .text('RAPPORT BÉNÉFICES PAR COMMANDE', 200, 12, { align: 'right', width: 355 });

  doc.fontSize(8).font('Helvetica').fillColor(GRIS)
    .text(`Centrale à Béton — Ouaga 2000, Ouagadougou`, 40, 48)
    .text(`Période : ${dateDebut || 'début'} → ${dateFin || "aujourd'hui"}`, 40, 58)
    .text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, 350, 48, { align: 'right', width: 205 })
    .text(`${commandes.length} commande(s) analysée(s)`, 350, 58, { align: 'right', width: 205 });

  doc.moveTo(40, 73).lineTo(555, 73).lineWidth(1).strokeColor(BLEU_CLAIR).stroke();

  // ── KPIs RÉSUMÉ ─────────────────────────────────────────────────────────
  let y = 82;
  const kpiW = 120;
  const kpis = [
    { label: "Chiffre d'affaires", val: fmtF(totaux.ca), color: BLEU },
    { label: 'Dépenses totales', val: fmtF(totaux.depenses), color: ORANGE },
    { label: 'Bénéfice net', val: fmtF(totaux.benefice), color: (totaux.benefice || 0) >= 0 ? VERT : ROUGE },
    { label: 'Taux de marge', val: `${fmt(totaux.tauxMarge)} %`, color: (totaux.tauxMarge || 0) >= 0 ? VERT : ROUGE },
  ];

  kpis.forEach((k, i) => {
    const x = 40 + i * (kpiW + 8);
    doc.rect(x, y, kpiW, 38).fillColor('#f8fafc').fill();
    doc.rect(x, y, 3, 38).fillColor(k.color).fill();
    doc.fontSize(7).font('Helvetica').fillColor(GRIS)
      .text(k.label, x + 8, y + 5, { width: kpiW - 12, lineBreak: false });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(k.color)
      .text(k.val, x + 8, y + 18, { width: kpiW - 12, lineBreak: false });
  });
  y += 48;

  doc.moveTo(40, y).lineTo(555, y).lineWidth(0.5).strokeColor(GRIS_MOY).stroke();
  y += 8;

  // ── TABLEAU DES COMMANDES ────────────────────────────────────────────────
  // Colonnes : Ref | Client | Type | Vol | CA | Coût | Bénéfice | Marge%
  const COL = [85, 90, 45, 35, 75, 75, 75, 45];
  const HEADERS = ['Référence', 'Client', 'Type', 'Vol.', 'CA (FCFA)', 'Coût (FCFA)', 'Bénéfice (FCFA)', 'Marge'];

  // En-tête tableau
  doc.rect(40, y, 515, 16).fillColor(BLEU_FONCE).fill();
  let x = 40;
  HEADERS.forEach((h, i) => {
    const align = i >= 3 ? 'right' : 'left';
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(BLANC)
      .text(h, x + 4, y + 4, { width: COL[i] - 8, align, lineBreak: false });
    x += COL[i];
  });
  y += 16;

  // Lignes données
  const ROW_H = 15;
  commandes.forEach((c, idx) => {
    // Vérifier si on a besoin d'une nouvelle page
    if (y + ROW_H > 780) {
      doc.addPage();
      y = 40;
      // Répéter l'en-tête
      doc.rect(40, y, 515, 16).fillColor(BLEU_FONCE).fill();
      let xh = 40;
      HEADERS.forEach((h, i) => {
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(BLANC)
          .text(h, xh + 4, y + 4, { width: COL[i] - 8, align: i >= 3 ? 'right' : 'left', lineBreak: false });
        xh += COL[i];
      });
      y += 16;
    }

    const bg = idx % 2 === 0 ? BLANC : '#fffbeb';
    doc.rect(40, y, 515, ROW_H).fillColor(bg).fill();

    const benefice = c.beneficeNetReel || 0;
    const marge = c.tauxMargeReel || 0;
    const benefColor = benefice >= 0 ? VERT : ROUGE;

    const vals = [
      c.reference || '—',
      c.nomClient || '—',
      c.typeBeton || '—',
      `${fmt(c.volumeBeton)} m³`,
      fmt(c.montantCommande),
      fmt(c.depensesReelles),
      fmt(benefice),
      `${fmt(marge)} %`,
    ];

    let xc = 40;
    vals.forEach((v, i) => {
      const isNum = i >= 3;
      const color = i === 6 ? benefColor : (i === 7 ? (marge >= 0 ? VERT : ROUGE) : NOIR);
      doc.fontSize(7.5)
        .font(i === 6 || i === 7 ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(color)
        .text(v, xc + 4, y + 4, { width: COL[i] - 8, align: isNum ? 'right' : 'left', lineBreak: false });
      xc += COL[i];
    });

    // Bordure basse
    doc.moveTo(40, y + ROW_H).lineTo(555, y + ROW_H)
      .lineWidth(0.2).strokeColor(GRIS_MOY).stroke();
    y += ROW_H;
  });

  // Ligne totaux
  y += 2;
  doc.rect(40, y, 515, 18).fillColor(BLEU_CLAIR).fill();
  doc.rect(40, y, 515, 18).lineWidth(0.8).strokeColor(BLEU).stroke();
  doc.fontSize(8).font('Helvetica-Bold').fillColor(BLEU_FONCE)
    .text('TOTAUX', 44, y + 5, { width: 80, lineBreak: false });

  const totalCols = [
    { x: 40 + 85 + 90 + 45 + 35, val: fmt(totaux.ca), w: 75 },
    { x: 40 + 85 + 90 + 45 + 35 + 75, val: fmt(totaux.depenses), w: 75 },
    { x: 40 + 85 + 90 + 45 + 35 + 75 + 75, val: fmt(totaux.benefice), w: 75, color: (totaux.benefice || 0) >= 0 ? VERT : ROUGE },
    { x: 40 + 85 + 90 + 45 + 35 + 75 + 75 + 75, val: `${fmt(totaux.tauxMarge)} %`, w: 45, color: (totaux.tauxMarge || 0) >= 0 ? VERT : ROUGE },
  ];
  totalCols.forEach(({ x: tx, val, w, color }) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor(color || BLEU_FONCE)
      .text(val, tx + 4, y + 5, { width: w - 8, align: 'right', lineBreak: false });
  });
  y += 22;

  // ── PIED DE PAGE ─────────────────────────────────────────────────────────
  const pageH = doc.page.height;
  doc.rect(0, pageH - 25, 595, 25).fillColor(BLEU_FONCE).fill();
  doc.fontSize(7).font('Helvetica').fillColor('#fed7aa')
    .text(
      `AMP BÉTON — ERP v3.0  |  Rapport confidentiel  |  Généré le ${new Date().toLocaleString('fr-FR')}`,
      40, pageH - 15, { align: 'center', width: 515 }
    );

  return doc;
};

// ─────────────────────────────────────────────────────────────────────────────
// Montant en lettres (français)
// ─────────────────────────────────────────────────────────────────────────────
function nombreEnLettresFR(n) {
  if (!n || n === 0) return 'Zéro';
  n = Math.round(Math.abs(n));
  const U = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const D = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  function g3(n) {
    if (n === 0) return '';
    let s = '';
    const c = Math.floor(n / 100), r = n % 100;
    if (c > 0) { s += (c === 1 ? '' : U[c] + ' ') + 'cent' + (c > 1 && r === 0 ? 's' : ''); }
    if (r > 0) {
      if (s) s += ' ';
      if (r < 20) { s += U[r]; }
      else {
        const d = Math.floor(r / 10), u = r % 10;
        if (d === 7 || d === 9) { s += D[d] + (u === 1 && d === 7 ? '-et-' : '-') + U[10 + u]; }
        else if (d === 8) { s += 'quatre-vingt' + (u > 0 ? '-' + U[u] : 's'); }
        else { s += D[d] + (u === 1 ? '-et-un' : u > 0 ? '-' + U[u] : ''); }
      }
    }
    return s;
  }

  const B = Math.floor(n / 1e9), M = Math.floor((n % 1e9) / 1e6),
        K = Math.floor((n % 1e6) / 1e3), R = n % 1e3;
  let s = '';
  if (B > 0) s += g3(B) + ' milliard' + (B > 1 ? 's' : '');
  if (M > 0) { if (s) s += ' '; s += (M === 1 ? 'un' : g3(M)) + ' million' + (M > 1 ? 's' : ''); }
  if (K > 0) { if (s) s += ' '; s += (K === 1 ? 'mille' : g3(K) + ' mille'); }
  if (R > 0) { if (s) s += ' '; s += g3(R); }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Facture Proforma
// ─────────────────────────────────────────────────────────────────────────────
const generateFactureProforma = (commande) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 0, left: 50, right: 50 } });
  const c = commande;
  const W = 495; // zone utile (595 - 2*50)
  const L = 50;  // left margin

  // Numéro proforma extrait de la référence (derniers 4 chiffres)
  const numParts = (c.reference || 'CMD-000000-0000').split('-');
  const numProforma = numParts[numParts.length - 1] || '0000';
  const clientShort = (c.nomClient || 'CLIENT').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').substring(0, 25).trim();
  const annee = new Date().getFullYear();
  const dateStr = new Date().toLocaleDateString('fr-FR');

  // ── Logo AMP BÉTON ────────────────────────────────────────────────────────
  // Fond header blanc — pas de bandeau coloré pour imiter le style proforma
  doc.rect(L, 30, 120, 70).fillColor('#FFF7ED').fill();
  drawLogo(doc, L + 5, 35, 110, 60);

  // Date en haut à droite
  doc.fontSize(10).font('Helvetica').fillColor(NOIR)
    .text(`Date:  ${dateStr}`, L, 42, { align: 'right', width: W });

  doc.moveTo(L, 112).lineTo(L + W, 112).lineWidth(1.5).strokeColor(BLEU_FONCE).stroke();

  // ── Titre ─────────────────────────────────────────────────────────────────
  const titre = `FACTURE PROFORMA N°${numProforma}/AMP BETON-${clientShort} /${annee}`;
  doc.fontSize(11).font('Helvetica-Bold').fillColor(NOIR)
    .text(titre, L, 122, { align: 'center', width: W, underline: true });

  // ── Doit (infos client) ───────────────────────────────────────────────────
  let y = 150;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NOIR).text('Doit :', L, y);
  y += 14;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NOIR).text(c.nomClient || '—', L, y);
  y += 13;
  if (c.telephone) {
    doc.fontSize(9).font('Helvetica').fillColor(NOIR).text(`Tél. : ${c.telephone}`, L, y);
    y += 12;
  }
  if (c.adresseChantier) {
    doc.fontSize(9).font('Helvetica').fillColor(NOIR).text(`Adresse / Site : ${c.adresseChantier}`, L, y);
    y += 12;
  }
  if (c.ifu) {
    doc.fontSize(9).font('Helvetica').fillColor(NOIR).text(`IFU N° : ${c.ifu}`, L, y);
    y += 12;
  }
  if (c.rccm) {
    doc.fontSize(9).font('Helvetica').fillColor(NOIR).text(`RCCM : ${c.rccm}`, L, y);
    y += 12;
  }
  if (c.regimeImposition) {
    doc.fontSize(9).font('Helvetica').fillColor(NOIR).text(`Régime d'imposition : ${c.regimeImposition}`, L, y);
    y += 12;
  }
  y += 6;

  // Objet
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NOIR)
    .text('Objet : VENTE DE BETON', L, y, { underline: true });
  y += 20;

  // ── Tableau ───────────────────────────────────────────────────────────────
  const TH = 22; // hauteur en-tête tableau
  const TR = 22; // hauteur ligne
  const COLS = [40, 175, 55, 70, 80, 75]; // widths
  const HEADERS = ['Nos ref', 'DESIGNATION', 'UNITE', 'QUANTITE', 'PRIX UNITAIRE', 'MONTANT'];

  // Bordure externe — béton + total uniquement (additifs non affichés sur la proforma client)
  const tableW = COLS.reduce((a, b) => a + b, 0);
  doc.rect(L, y, tableW, TH + TR * 2).lineWidth(0.8).strokeColor(NOIR).stroke();

  // En-tête tableau
  doc.rect(L, y, tableW, TH).fillColor('#D1D5DB').fill();
  let tx = L;
  HEADERS.forEach((h, i) => {
    if (i > 0) doc.moveTo(tx, y).lineTo(tx, y + TH + TR * 2).lineWidth(0.5).strokeColor(NOIR).stroke();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NOIR)
      .text(h, tx + 4, y + (TH - 9) / 2 + 1, { width: COLS[i] - 8, align: 'center', lineBreak: false });
    tx += COLS[i];
  });

  // Ligne de séparation en-tête / données
  doc.moveTo(L, y + TH).lineTo(L + tableW, y + TH).lineWidth(0.5).strokeColor(NOIR).stroke();
  y += TH;

  // Ligne béton — montant total (additifs inclus dans le produit fini, pas détaillés)
  const remiseFP = parseFloat(c.remisePct) || 0;
  const labelRemiseFP = remiseFP > 0 ? ` (-${fmtD(remiseFP)}%)` : '';
  const montantTotalFP = c.montantCommande || 0;
  const prixUnit = c.volumeBeton > 0 ? Math.round(montantTotalFP / c.volumeBeton) : 0;
  const ligneVals = ['1', `Béton de ${c.typeBeton || 'C25/30'}${labelRemiseFP}`, 'm3',
    String(c.volumeBeton || 0), fmt(prixUnit), fmt(montantTotalFP)];

  tx = L;
  ligneVals.forEach((v, i) => {
    const align = i >= 3 ? 'right' : (i === 1 ? 'left' : 'center');
    doc.fontSize(9).font('Helvetica').fillColor(NOIR)
      .text(v, tx + 4, y + (TR - 10) / 2 + 1, { width: COLS[i] - 8, align, lineBreak: false });
    tx += COLS[i];
  });
  y += TR;
  doc.moveTo(L, y).lineTo(L + tableW, y).lineWidth(0.5).strokeColor(NOIR).stroke();

  // Ligne TOTAL (montant après remise)
  doc.rect(L, y, tableW, TR).fillColor('#1E3A5F').fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(BLANC)
    .text('TOTAL GENERAL HTVA', L + 4, y + (TR - 10) / 2 + 1, { width: COLS[0] + COLS[1] + COLS[2] + COLS[3] + COLS[4] - 8, align: 'center', lineBreak: false })
    .text(fmt(c.montantCommande || 0), L + COLS[0] + COLS[1] + COLS[2] + COLS[3] + COLS[4] + 4, y + (TR - 10) / 2 + 1, { width: COLS[5] - 8, align: 'right', lineBreak: false });
  y += TR + 14;

  // ── Montant en lettres ────────────────────────────────────────────────────
  const enLettres = nombreEnLettresFR(c.montantCommande || 0);
  doc.fontSize(9.5).font('Helvetica').fillColor(NOIR)
    .text('Arrêté la présente Facture proforma à la somme de ', L, y, { continued: true })
    .font('Helvetica-Bold').text(enLettres, { continued: true })
    .font('Helvetica').text(` ( ${fmt(c.montantCommande || 0)}) francs CFA HTVA.`);
  y += 30;

  // ── Conditions de paiement ────────────────────────────────────────────────
  const condH = 58;
  doc.rect(L, y, 300, condH).lineWidth(0.8).strokeColor(NOIR).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(NOIR)
    .text('Condition de paiement: 100% à la commande', L + 8, y + 8)
    .font('Helvetica')
    .text('Délai de livraison 7 jours après le paiement', L + 8, y + 22)
    .text('PS: Toute somme versée est non remboursable', L + 8, y + 36, { oblique: true });

  y += condH + 40;

  // ── Signature COMPTABLE (sans nom) ───────────────────────────────────────
  doc.fontSize(9).font('Helvetica-Bold').fillColor(NOIR)
    .text('COMPTABLE', L + 330, y + 5, { width: 165, align: 'center' });
  doc.moveTo(L + 345, y + 45).lineTo(L + W, y + 45).lineWidth(0.5).strokeColor(GRIS_MOY).stroke();

  // ── Pied de page ──────────────────────────────────────────────────────────
  const pH = doc.page.height;
  doc.rect(0, pH - 68, 595, 68).fillColor('#92400e').fill();
  doc.fontSize(8).font('Helvetica').fillColor('#fed7aa')
    .text('SARL au capital de 1.000.000 fCFA - 04 BP 536 Ouagadougou 04', 0, pH - 62, { align: 'center', width: 595 })
    .text('Secteur 33 - Parcelle HL - Section Q - Lot 24', 0, pH - 50, { align: 'center', width: 595 })
    .text('Tél. : +226 04 42 92 92 ; E-mail: r.bationo@amp-bf.com', 0, pH - 38, { align: 'center', width: 595 })
    .text('RCCM: BF OUA 2025-B13-08156 ; IFU N°00271525G', 0, pH - 26, { align: 'center', width: 595 })
    .text('Compte bancaire: BCB N° BF42 BF056 01008 050121287801 04', 0, pH - 14, { align: 'center', width: 595 });

  return doc;
};

// ─────────────────────────────────────────────────────────────────────────────
// État de Livraison par commande
// ─────────────────────────────────────────────────────────────────────────────
const generateEtatLivraison = (commande, livraisons) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 0, left: 40, right: 40 }, bufferPages: true });
  const c = commande;

  // ── En-tête ───────────────────────────────────────────────────────────────
  doc.rect(0, 0, 595, 40).fillColor(BLEU_FONCE).fill();
  doc.rect(37, 4, 86, 32).fillColor(BLANC).fill();
  drawLogo(doc, 38, 5, 84, 30);
  doc.fontSize(12).font('Helvetica-Bold').fillColor(BLANC)
    .text('ÉTAT DE LIVRAISON', 200, 13, { align: 'right', width: 355 });

  doc.fontSize(8).font('Helvetica').fillColor(GRIS)
    .text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, 40, 50, { align: 'right', width: 515 });
  doc.moveTo(40, 62).lineTo(555, 62).lineWidth(1).strokeColor(BLEU_CLAIR).stroke();

  // ── Infos commande ────────────────────────────────────────────────────────
  let y = 72;
  y = sectionTitle(doc, y, 'INFORMATIONS COMMANDE');
  y += 2;

  const infos = [
    ['Référence commande', c.reference || '—'],
    ['Client', c.nomClient || '—'],
    ['Téléphone', c.telephone || '—'],
    ['Chantier / Site', c.adresseChantier || '—'],
    ['Type béton', c.typeBeton || '—'],
    ['Volume commandé', `${c.volumeBeton || 0} m³`],
    ['Montant de vente', fmtF(c.montantCommande || 0)],
  ];
  infos.forEach(([label, val], i) => {
    drawRow(doc, y, 17, [200, 310], [label, val], i % 2 === 0 ? BLANC : GRIS_LEGER, [GRIS, NOIR], [true, false], ['left', 'left']);
    y += 17;
  });

  // ── KPI résumé ────────────────────────────────────────────────────────────
  y += 8;
  const livrees = livraisons.filter((l) => l.statut === 'LIVREE');
  const totalLivre = livrees.reduce((a, l) => a + (l.volumeReel || 0), 0);
  const tauxRealisation = c.volumeBeton > 0 ? Math.round((totalLivre / c.volumeBeton) * 100) : 0;

  const kpiW = 120;
  const kpiData = [
    { label: 'Total livraisons', val: String(livraisons.length), color: BLEU },
    { label: 'Livraisons effectuées', val: String(livrees.length), color: VERT },
    { label: 'Volume livré (m³)', val: String(totalLivre), color: BLEU_FONCE },
    { label: 'Taux réalisation', val: `${tauxRealisation} %`, color: tauxRealisation >= 100 ? VERT : ORANGE },
  ];
  kpiData.forEach((k, i) => {
    const x = 40 + i * (kpiW + 8);
    doc.rect(x, y, kpiW, 36).fillColor('#f8fafc').fill();
    doc.rect(x, y, 3, 36).fillColor(k.color).fill();
    doc.fontSize(7).font('Helvetica').fillColor(GRIS).text(k.label, x + 8, y + 5, { width: kpiW - 12, lineBreak: false });
    doc.fontSize(11).font('Helvetica-Bold').fillColor(k.color).text(k.val, x + 8, y + 17, { width: kpiW - 12, lineBreak: false });
  });
  y += 46;

  // ── Tableau livraisons ────────────────────────────────────────────────────
  y = sectionTitle(doc, y, 'DÉTAIL DES LIVRAISONS');
  y += 2;

  const LCOL = [100, 90, 85, 65, 65, 100];
  const LHDRS = ['Date', 'Référence', 'Chauffeur', 'Volume livré', 'Statut', 'Observations'];

  // En-tête
  doc.rect(40, y, 515, 16).fillColor(BLEU_FONCE).fill();
  let x = 40;
  LHDRS.forEach((h, i) => {
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(BLANC)
      .text(h, x + 4, y + 4, { width: LCOL[i] - 8, align: i >= 3 ? 'center' : 'left', lineBreak: false });
    x += LCOL[i];
  });
  y += 16;

  if (livraisons.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(GRIS).text('Aucune livraison enregistrée.', 44, y + 6);
    y += 24;
  }

  const STATUT_LBL = { PLANIFIEE: 'Planifiée', EN_ROUTE: 'En route', LIVREE: 'Livrée', RETARD: 'Retard', ANNULEE: 'Annulée' };
  const STATUT_COL = { PLANIFIEE: BLEU, EN_ROUTE: ORANGE, LIVREE: VERT, RETARD: ROUGE, ANNULEE: GRIS };

  livraisons.forEach((l, idx) => {
    if (y + 16 > 760) { doc.addPage(); y = 40; }
    const bg = idx % 2 === 0 ? BLANC : '#fffbeb';
    doc.rect(40, y, 515, 16).fillColor(bg).fill();
    const vals = [
      l.heureArrivee ? new Date(l.heureArrivee).toLocaleDateString('fr-FR') : (l.heureDepart ? new Date(l.heureDepart).toLocaleDateString('fr-FR') : '—'),
      l.reference || '—',
      l.chauffeur || '—',
      l.volumeReel ? `${l.volumeReel} m³` : '—',
      STATUT_LBL[l.statut] || l.statut,
      (l.observations || '').substring(0, 30),
    ];
    let xc = 40;
    vals.forEach((v, i) => {
      const col = i === 4 ? (STATUT_COL[l.statut] || NOIR) : NOIR;
      doc.fontSize(7.5).font(i === 4 ? 'Helvetica-Bold' : 'Helvetica').fillColor(col)
        .text(v, xc + 4, y + 4, { width: LCOL[i] - 8, align: i >= 3 ? 'center' : 'left', lineBreak: false });
      xc += LCOL[i];
    });
    doc.moveTo(40, y + 16).lineTo(555, y + 16).lineWidth(0.2).strokeColor(GRIS_MOY).stroke();
    y += 16;
  });

  // Ligne total
  y += 2;
  doc.rect(40, y, 515, 18).fillColor(BLEU_CLAIR).fill();
  doc.fontSize(8).font('Helvetica-Bold').fillColor(BLEU_FONCE)
    .text('TOTAL LIVRÉ', 44, y + 5, { width: 275, lineBreak: false })
    .text(`${totalLivre} m³  (${tauxRealisation}% de ${c.volumeBeton} m³ commandés)`, 320, y + 5, { width: 230, align: 'right', lineBreak: false });
  y += 22;

  // ── Pied ──────────────────────────────────────────────────────────────────
  const pH = doc.page.height;
  doc.rect(0, pH - 24, 595, 24).fillColor(BLEU_FONCE).fill();
  doc.fontSize(7).font('Helvetica').fillColor('#fed7aa')
    .text(`AMP BÉTON — État de livraison confidentiel  |  Généré le ${new Date().toLocaleString('fr-FR')}`,
      40, pH - 14, { align: 'center', width: 515 });

  return doc;
};

// ─────────────────────────────────────────────────────────────────────────────
// État de Paiement par commande
// ─────────────────────────────────────────────────────────────────────────────
const generateEtatPaiement = (commande, result) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 0, left: 40, right: 40 }, bufferPages: true });
  const c = commande;
  const paiements = result.paiements || [];
  const totalPaye = result.totalPaye || 0;
  const restant = result.restant || ((c.montantCommande || 0) - totalPaye);

  // ── En-tête ───────────────────────────────────────────────────────────────
  doc.rect(0, 0, 595, 40).fillColor(BLEU_FONCE).fill();
  doc.rect(37, 4, 86, 32).fillColor(BLANC).fill();
  drawLogo(doc, 38, 5, 84, 30);
  doc.fontSize(12).font('Helvetica-Bold').fillColor(BLANC)
    .text('ÉTAT DE PAIEMENT', 200, 13, { align: 'right', width: 355 });

  doc.fontSize(8).font('Helvetica').fillColor(GRIS)
    .text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, 40, 50, { align: 'right', width: 515 });
  doc.moveTo(40, 62).lineTo(555, 62).lineWidth(1).strokeColor(BLEU_CLAIR).stroke();

  // ── Infos commande ────────────────────────────────────────────────────────
  let y = 72;
  y = sectionTitle(doc, y, 'INFORMATIONS CLIENT & COMMANDE');
  y += 2;

  const infos = [
    ['Client', c.nomClient || '—'],
    ['Téléphone', c.telephone || '—'],
    ['Référence commande', c.reference || '—'],
    ['Chantier', c.adresseChantier || '—'],
    ['Montant total', fmtF(c.montantCommande || 0)],
  ];
  infos.forEach(([label, val], i) => {
    drawRow(doc, y, 17, [200, 310], [label, val], i % 2 === 0 ? BLANC : GRIS_LEGER, [GRIS, NOIR], [true, false], ['left', 'left']);
    y += 17;
  });

  // ── KPI résumé ────────────────────────────────────────────────────────────
  y += 8;
  const tauxPaiement = c.montantCommande > 0 ? Math.round((totalPaye / c.montantCommande) * 100) : 0;
  const kpiW = 120;
  const kpiData = [
    { label: 'Total paiements', val: String(paiements.length), color: BLEU },
    { label: 'Montant total', val: fmtF(c.montantCommande), color: BLEU_FONCE },
    { label: 'Total payé', val: fmtF(totalPaye), color: VERT },
    { label: 'Reste à payer', val: fmtF(Math.max(0, restant)), color: restant <= 0 ? VERT : ROUGE },
  ];
  kpiData.forEach((k, i) => {
    const x = 40 + i * (kpiW + 8);
    doc.rect(x, y, kpiW, 36).fillColor('#f8fafc').fill();
    doc.rect(x, y, 3, 36).fillColor(k.color).fill();
    doc.fontSize(7).font('Helvetica').fillColor(GRIS).text(k.label, x + 8, y + 5, { width: kpiW - 12, lineBreak: false });
    doc.fontSize(9).font('Helvetica-Bold').fillColor(k.color).text(k.val, x + 8, y + 17, { width: kpiW - 12, lineBreak: false });
  });
  y += 46;

  // ── Tableau paiements ─────────────────────────────────────────────────────
  y = sectionTitle(doc, y, 'HISTORIQUE DES PAIEMENTS');
  y += 2;

  const PCOL = [90, 95, 100, 90, 75, 65];
  const PHDRS = ['Date', 'Référence', 'Montant (FCFA)', 'Mode', 'Statut', 'Saisi par'];
  const MODE_LBL = { ESPECE: 'Espèces', VIREMENT: 'Virement', CHEQUE: 'Chèque', CREDIT_CLIENT: 'Crédit', MOBILE_MONEY: 'Mobile' };
  const PSTATUT_CFG = { EN_ATTENTE: { l: 'En attente', c: ORANGE }, PAYE: { l: 'Payé', c: VERT }, RETARD: { l: 'Retard', c: ROUGE }, ANNULE: { l: 'Annulé', c: GRIS }, PARTIEL: { l: 'Partiel', c: BLEU } };

  doc.rect(40, y, 515, 16).fillColor(BLEU_FONCE).fill();
  let x = 40;
  PHDRS.forEach((h, i) => {
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(BLANC)
      .text(h, x + 4, y + 4, { width: PCOL[i] - 8, align: i === 2 ? 'right' : 'left', lineBreak: false });
    x += PCOL[i];
  });
  y += 16;

  if (paiements.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(GRIS).text('Aucun paiement enregistré.', 44, y + 6);
    y += 24;
  }

  paiements.forEach((p, idx) => {
    if (y + 16 > 760) { doc.addPage(); y = 40; }
    const bg = idx % 2 === 0 ? BLANC : '#fffbeb';
    doc.rect(40, y, 515, 16).fillColor(bg).fill();
    const st = PSTATUT_CFG[p.statut] || { l: p.statut, c: NOIR };
    const saisiPar = p.user ? `${p.user.prenom} ${p.user.nom}`.substring(0, 15) : '—';
    const vals = [
      new Date(p.createdAt).toLocaleDateString('fr-FR'),
      p.reference || '—',
      fmt(p.montant),
      MODE_LBL[p.modePaiement] || p.modePaiement,
      st.l,
      saisiPar,
    ];
    let xc = 40;
    vals.forEach((v, i) => {
      doc.fontSize(7.5).font(i === 4 ? 'Helvetica-Bold' : 'Helvetica').fillColor(i === 4 ? st.c : NOIR)
        .text(v, xc + 4, y + 4, { width: PCOL[i] - 8, align: i === 2 ? 'right' : 'left', lineBreak: false });
      xc += PCOL[i];
    });
    doc.moveTo(40, y + 16).lineTo(555, y + 16).lineWidth(0.2).strokeColor(GRIS_MOY).stroke();
    y += 16;
  });

  // ── Récapitulatif ─────────────────────────────────────────────────────────
  y += 8;
  y = ligneFinanciere(doc, y, 'Montant total de la commande', fmtF(c.montantCommande || 0), BLANC, NOIR, true);
  y = ligneFinanciere(doc, y, 'Total des paiements confirmés (PAYÉ)', fmtF(totalPaye), VERT_CLAIR, VERT, true);
  const restColor = restant <= 0 ? VERT : ROUGE;
  const restBg    = restant <= 0 ? VERT_CLAIR : ROUGE_CLAIR;
  y += 2;
  doc.rect(40, y, 515, 22).fillColor(restBg).fill();
  doc.fontSize(10).font('Helvetica-Bold').fillColor(restColor)
    .text('SOLDE RESTANT À PAYER', 44, y + 6, { width: 320, lineBreak: false })
    .text(fmtF(Math.max(0, restant)), 364, y + 6, { width: 187, align: 'right', lineBreak: false });
  y += 26;

  if (tauxPaiement >= 100) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(VERT)
      .text('✓ COMMANDE ENTIÈREMENT PAYÉE', 40, y, { align: 'center', width: 515 });
  }

  // ── Pied ──────────────────────────────────────────────────────────────────
  const pH = doc.page.height;
  doc.rect(0, pH - 24, 595, 24).fillColor(BLEU_FONCE).fill();
  doc.fontSize(7).font('Helvetica').fillColor('#fed7aa')
    .text(`AMP BÉTON — État de paiement confidentiel  |  Généré le ${new Date().toLocaleString('fr-FR')}`,
      40, pH - 14, { align: 'center', width: 515 });

  return doc;
};

module.exports = { generateDevis, generateRapportBenefices, generateFactureProforma, generateEtatLivraison, generateEtatPaiement };
