const PDFDocument = require('pdfkit');

const BLEU       = '#1e40af';
const BLEU_CLAIR = '#dbeafe';
const BLEU_FONCE = '#1e3a8a';
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
  const doc = new PDFDocument({ size: 'A4', margin: 45, bufferPages: true });
  const c = commande;
  const k = calculs;
  const distance = c.distanceLivraison || 0;

  // ── EN-TÊTE ────────────────────────────────────────────────────────────
  // Bandeau bleu supérieur
  doc.rect(0, 0, 595, 38).fillColor(BLEU_FONCE).fill();
  doc.fontSize(18).font('Helvetica-Bold').fillColor(BLANC).text('AMP BÉTON', 45, 10);
  doc.fontSize(20).font('Helvetica-Bold').fillColor(BLANC).text('DEVIS', 350, 8, { align: 'right', width: 200 });

  doc.fontSize(8.5).font('Helvetica').fillColor(GRIS)
    .text('Centrale à Béton — Ouaga 2000, Ouagadougou, Burkina Faso', 45, 46)
    .text('Tél : +226 70 XX XX XX  |  Email : contact@ampbeton.bf', 45, 56);

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

  const prixUnitaireDevis = c.montantCommande && c.volumeBeton
    ? Math.round(c.montantCommande / c.volumeBeton)
    : 0;

  drawRow(doc, y, ROW_H, [210, 55, 70, 100, 70],
    [`Béton prêt à l'emploi ${c.typeBeton || ''}`, 'm³', fmtD(c.volumeBeton),
      prixUnitaireDevis > 0 ? fmtF(prixUnitaireDevis) + '/m³' : '—', fmtF(c.montantCommande)],
    '#eff6ff', [NOIR, NOIR, NOIR, NOIR, NOIR], [false, false, true, false, true]);
  y += ROW_H;

  if (distance > 0 && k.fraisTransport > 0) {
    drawRow(doc, y, ROW_H, [210, 55, 70, 100, 70],
      [`Frais de livraison (${fmtD(distance)} km A/R)`, 'forfait', '1', '—', fmtF(k.fraisTransport)],
      GRIS_LEGER, [NOIR, NOIR, NOIR, NOIR, NOIR], [false, false, false, false, false]);
    y += ROW_H;
  }

  // ── BESOINS EN MATIÈRES PREMIÈRES ─────────────────────────────────────
  y += 6;
  y = sectionTitle(doc, y, 'BESOINS EN MATIÈRES PREMIÈRES');
  y += 2;

  const colM = [195, 50, 90, 170];
  drawRow(doc, y, 16, colM, ['Matière', 'Unité', 'Quantité', 'Coût estimé'],
    BLEU, [BLANC, BLANC, BLANC, BLANC], [true, true, true, true]);
  y += 16;

  const matieres = [
    ['Ciment CPA 42.5', 'kg',  fmt(k.totalCiment),    fmtF(k.coutCiment)],
    ['Gravier 5/15',    't',   fmtD(k.totalGravier515), fmtF(k.coutGravier515)],
    ['Gravier 15/25',   't',   fmtD(k.totalGravier1525),fmtF(k.coutGravier1525)],
    ['Sable naturel',   'm³',  fmtD(k.totalSable),     fmtF(k.coutSable)],
    ['Powerflow 6425',  'L',   fmt(k.totalPowerflow),  fmtF(k.coutPowerflow)],
    ['Gasoil production','L',  fmt(k.totalGasoil),     fmtF(k.coutGasoil)],
  ];
  matieres.forEach((row, i) => {
    drawRow(doc, y, ROW_H, colM, row, i % 2 === 0 ? BLANC : GRIS_LEGER, [NOIR, NOIR, NOIR, NOIR], [false, false, false, false]);
    y += ROW_H;
  });

  // ── RÉCAPITULATIF FINANCIER — COÛTS DE PRODUCTION ─────────────────────
  y += 6;
  y = sectionTitle(doc, y, 'RÉCAPITULATIF FINANCIER — COÛTS DE PRODUCTION');
  y += 2;

  y = ligneFinanciere(doc, y, 'Coût matières premières', fmtF(k.coutMateriaux), BLANC);
  y = ligneFinanciere(doc, y, 'Coût gasoil production', fmtF(k.coutGasoil), GRIS_LEGER);
  y = ligneFinanciere(doc, y, 'Amortissement matériels', fmtF(k.coutAmortissement), BLANC);
  y = ligneFinanciere(doc, y, 'Charges de personnel (245 FCFA/m³)', fmtF(k.coutPersonnel), GRIS_LEGER);
  y = ligneFinanciere(doc, y, 'Restauration & divers chantier', fmtF(k.fraisRestauration || 0), BLANC);
  if (k.fraisTransport > 0) {
    y = ligneFinanciere(doc, y, `Frais de transport livraison (${fmtD(distance)} km)`, fmtF(k.fraisTransport), ORANGE_CLAIR, ORANGE);
  }

  // Ligne coût total (fond bleu clair + gras)
  y += 2;
  doc.rect(45, y, 505, 20).fillColor(BLEU_CLAIR).fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(BLEU_FONCE)
    .text('COÛT DE PRODUCTION TOTAL', 50, y + 5, { width: 325, lineBreak: false })
    .text(fmtF(k.coutTotal), 380, y + 5, { width: 160, align: 'right', lineBreak: false });
  y += 22;
  y = ligneFinanciere(doc, y, `Coût unitaire / m³ (base ${fmtD(c.volumeBeton)} m³)`, fmtF(k.coutUnitaire), GRIS_LEGER, GRIS);

  // Ligne montant commande
  y += 2;
  doc.rect(45, y, 505, 20).fillColor(BLEU_FONCE).fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(BLANC)
    .text('MONTANT COMMANDE CLIENT', 50, y + 5, { width: 325, lineBreak: false })
    .text(fmtF(c.montantCommande), 380, y + 5, { width: 160, align: 'right', lineBreak: false });
  y += 22;

  // Ligne marge commerciale
  const margePos = (k.margePrevisionnelle || 0) >= 0;
  const margeBg   = margePos ? VERT_CLAIR : ROUGE_CLAIR;
  const margeColor = margePos ? VERT : ROUGE;
  doc.rect(45, y, 505, 20).fillColor(margeBg).fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(margeColor)
    .text(`Marge commerciale (${fmtD(k.tauxMarge)}%)`, 50, y + 5, { width: 325, lineBreak: false })
    .text(fmtF(k.margePrevisionnelle), 380, y + 5, { width: 160, align: 'right', lineBreak: false });
  y += 24;

  // ── ANALYSE DE RENTABILITÉ — USAGE INTERNE ────────────────────────────
  y += 2;
  // Bandeau titre "interne"
  doc.rect(45, y, 505, 20).fillColor('#78350f').fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(BLANC)
    .text('ANALYSE DE RENTABILITÉ — USAGE INTERNE CONFIDENTIEL', 50, y + 5, { width: 460, lineBreak: false });
  y += 22;

  y = ligneFinanciere(doc, y, 'Loyer / Location centrale (proratisé au volume)', fmtF(k.fraisLoyer), BLANC, GRIS);
  y = ligneFinanciere(doc, y, 'Frais généraux (électricité, eau, bureau — proratisés)', fmtF(k.fraisAutresCharges), GRIS_LEGER, GRIS);
  y = ligneFinanciere(doc, y, `Impôts et taxes (5% du CA = 5% × ${fmtF(c.montantCommande)})`, fmtF(k.fraisImpots), BLANC, GRIS);

  // Total charges
  y += 2;
  doc.rect(45, y, 505, 18).fillColor(ORANGE_CLAIR).fill();
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(ORANGE)
    .text('Total charges d\'exploitation', 50, y + 4, { width: 325, lineBreak: false })
    .text(fmtF(k.chargesExploitation), 380, y + 4, { width: 160, align: 'right', lineBreak: false });
  y += 20;

  // Bénéfice réel net
  const benefPos = (k.beneficeReel || 0) >= 0;
  const benefBg    = benefPos ? VERT_CLAIR : ROUGE_CLAIR;
  const benefColor = benefPos ? VERT : ROUGE;
  y += 2;
  doc.rect(45, y, 505, 22).fillColor(benefBg).fill();
  doc.fontSize(10).font('Helvetica-Bold').fillColor(benefColor)
    .text(`BÉNÉFICE RÉEL NET (${fmtD(k.tauxBeneficeReel)}% du CA)`, 50, y + 6, { width: 325, lineBreak: false })
    .text(fmtF(k.beneficeReel), 380, y + 6, { width: 160, align: 'right', lineBreak: false });
  y += 26;

  // ── CONDITIONS ─────────────────────────────────────────────────────────
  doc.moveTo(45, y).lineTo(550, y).lineWidth(0.5).strokeColor(GRIS_MOY).stroke();
  y += 8;
  doc.fontSize(8).font('Helvetica').fillColor(GRIS)
    .text('Conditions : Paiement à la livraison. Validité du devis : 30 jours.', 45, y, { width: 300 });
  doc.fontSize(9).font('Helvetica-Bold').fillColor(NOIR)
    .text('Signature & Cachet AMP BÉTON', 300, y, { align: 'right', width: 250 });

  // ── PIED DE PAGE ───────────────────────────────────────────────────────
  const pageH = doc.page.height;
  doc.rect(0, pageH - 28, 595, 28).fillColor(BLEU_FONCE).fill();
  doc.fontSize(7.5).font('Helvetica').fillColor('#93c5fd')
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
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const totaux = data.totaux || {};
  const commandes = data.commandes || [];

  // ── EN-TÊTE ─────────────────────────────────────────────────────────────
  doc.rect(0, 0, 595, 40).fillColor(BLEU_FONCE).fill();
  doc.fontSize(16).font('Helvetica-Bold').fillColor(BLANC).text('AMP BÉTON', 40, 10);
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

    const bg = idx % 2 === 0 ? BLANC : '#f8faff';
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
  doc.fontSize(7).font('Helvetica').fillColor('#93c5fd')
    .text(
      `AMP BÉTON — ERP v3.0  |  Rapport confidentiel  |  Généré le ${new Date().toLocaleString('fr-FR')}`,
      40, pageH - 15, { align: 'center', width: 515 }
    );

  return doc;
};

module.exports = { generateDevis, generateRapportBenefices };
