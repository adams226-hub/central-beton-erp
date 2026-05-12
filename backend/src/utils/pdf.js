const PDFDocument = require('pdfkit');

const BLEU = '#1e40af';
const BLEU_CLAIR = '#dbeafe';
const GRIS = '#6b7280';
const VERT = '#16a34a';
const ROUGE = '#dc2626';
const BLANC = '#ffffff';
const NOIR = '#1f2937';
const GRIS_LEGER = '#f9fafb';

const fmt = (n) => n != null ? Number(n).toLocaleString('fr-FR') : '0';
const fmtF = (n) => fmt(n) + ' FCFA';

const generateDevis = (commande, calculs) => {
  const doc = new PDFDocument({ size: 'A4', margin: 45, bufferPages: true });

  // ── EN-TÊTE ────────────────────────────────────────────────────────────
  doc.fontSize(22).font('Helvetica-Bold').fillColor(BLEU).text('AMP BÉTON', 45, 45);
  doc.fontSize(9).font('Helvetica').fillColor(GRIS)
    .text('Centrale à Béton — Ouaga 2000, Ouagadougou, Burkina Faso', 45, 72)
    .text('Tél : +226 70 XX XX XX  |  Email : contact@ampbeton.bf', 45, 83);

  doc.fontSize(20).font('Helvetica-Bold').fillColor(NOIR)
    .text('DEVIS', 350, 45, { align: 'right', width: 200 });
  doc.fontSize(10).font('Helvetica').fillColor(GRIS)
    .text(`Réf : ${commande.reference}`, 350, 72, { align: 'right', width: 200 })
    .text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 350, 83, { align: 'right', width: 200 });

  doc.moveTo(45, 103).lineTo(550, 103).lineWidth(2).strokeColor(BLEU).stroke();

  // ── INFORMATIONS CLIENT ────────────────────────────────────────────────
  let y = 117;
  doc.fontSize(12).font('Helvetica-Bold').fillColor(BLEU).text('INFORMATIONS CLIENT', 45, y);
  y += 18;

  const infoClient = [
    ['Client', commande.nomClient || '—'],
    ['Téléphone', commande.telephone || '—'],
    ['Chantier', commande.adresseChantier || '—'],
    ['Date livraison', commande.dateLivraison ? new Date(commande.dateLivraison).toLocaleDateString('fr-FR') : '—'],
  ];
  infoClient.forEach(([k, v]) => {
    drawRow(doc, y, [155, 350], [k + ' :', v], GRIS_LEGER, [GRIS, NOIR], [true, false]);
    y += 19;
  });

  // ── DÉTAILS COMMANDE ───────────────────────────────────────────────────
  y += 8;
  doc.fontSize(12).font('Helvetica-Bold').fillColor(BLEU).text('DÉTAILS DE LA COMMANDE', 45, y);
  y += 18;

  drawRow(doc, y, [230, 60, 75, 140], ['Désignation', 'Unité', 'Quantité', 'Montant HTVA'], BLEU, [BLANC, BLANC, BLANC, BLANC], [true, true, true, true]);
  y += 20;
  drawRow(doc, y, [230, 60, 75, 140],
    [`Béton prêt à l'emploi ${commande.typeBeton || ''}`, 'm³', fmt(commande.volumeBeton), fmtF(commande.montantCommande)],
    '#eff6ff', [NOIR, NOIR, NOIR, NOIR], [false, false, false, false]);
  y += 20;

  // ── MATIÈRES PREMIÈRES ─────────────────────────────────────────────────
  y += 10;
  doc.fontSize(12).font('Helvetica-Bold').fillColor(BLEU).text('BESOINS EN MATIÈRES PREMIÈRES', 45, y);
  y += 18;

  const colM = [195, 50, 85, 175];
  drawRow(doc, y, colM, ['Matière', 'Unité', 'Quantité', 'Montant estimé'], BLEU, [BLANC, BLANC, BLANC, BLANC], [true, true, true, true]);
  y += 20;

  const matieres = [
    ['Ciment CPA 42.5', 'kg', fmt(calculs.totalCiment), fmtF((calculs.coutMateriaux || 0) * 0.58)],
    ['Gravier 5/15', 't', fmt(calculs.totalGravier515), fmtF((calculs.coutMateriaux || 0) * 0.06)],
    ['Gravier 15/25', 't', fmt(calculs.totalGravier1525), fmtF((calculs.coutMateriaux || 0) * 0.10)],
    ['Sable naturel', 'm³', fmt(calculs.totalSable), fmtF((calculs.coutMateriaux || 0) * 0.09)],
    ['Powerflow 6425', 'L', fmt(calculs.totalPowerflow), fmtF((calculs.coutMateriaux || 0) * 0.08)],
    ['Gasoil total', 'L', fmt(calculs.totalGasoil), fmtF(calculs.coutGasoil)],
  ];
  matieres.forEach((row, i) => {
    drawRow(doc, y, colM, row, i % 2 === 0 ? BLANC : GRIS_LEGER, [NOIR, NOIR, NOIR, NOIR], [false, false, false, false]);
    y += 19;
  });

  // ── RÉCAPITULATIF FINANCIER ────────────────────────────────────────────
  y += 10;
  doc.fontSize(12).font('Helvetica-Bold').fillColor(BLEU).text('RÉCAPITULATIF FINANCIER', 45, y);
  y += 18;

  const colF = [335, 170];
  const lignes = [
    ['Coût matériaux', fmtF(calculs.coutMateriaux), BLANC, false],
    ['Coût gasoil', fmtF(calculs.coutGasoil), GRIS_LEGER, false],
    ['Amortissement matériels', fmtF(calculs.coutAmortissement), BLANC, false],
    ['Charges de personnel', fmtF(calculs.coutPersonnel), GRIS_LEGER, false],
    ['Frais divers (restauration)', fmtF(calculs.fraisRestauration || 0), BLANC, false],
    ['COÛT DE PRODUCTION TOTAL', fmtF(calculs.coutTotal), BLEU_CLAIR, true],
    ['Coût unitaire / m³', fmtF(calculs.coutUnitaire), GRIS_LEGER, false],
  ];
  lignes.forEach(([label, val, bg, bold]) => {
    drawRow(doc, y, colF, [label, val], bg, bold ? [BLEU, BLEU] : [NOIR, NOIR], [bold, bold]);
    y += 19;
  });

  // Ligne montant commande (fond bleu)
  drawRow(doc, y, colF, ['MONTANT COMMANDE', fmtF(commande.montantCommande)], BLEU, [BLANC, BLANC], [true, true]);
  y += 21;

  // Marge
  const margePos = (calculs.margePrevisionnelle || 0) >= 0;
  const couleurMarge = margePos ? VERT : ROUGE;
  doc.rect(45, y, colF[0], 20).fillColor('#f0fdf4').fill();
  doc.rect(45 + colF[0], y, colF[1], 20).fillColor('#f0fdf4').fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(couleurMarge)
    .text(`Marge bénéficiaire (${calculs.tauxMarge || 0}%)`, 50, y + 5, { width: colF[0] - 10, lineBreak: false })
    .text(fmtF(calculs.margePrevisionnelle), 45 + colF[0], y + 5, { width: colF[1] - 8, align: 'right', lineBreak: false });
  y += 28;

  // ── CONDITIONS & SIGNATURE ─────────────────────────────────────────────
  doc.fontSize(9).font('Helvetica').fillColor(GRIS)
    .text('Conditions : Paiement à la livraison. Validité du devis : 30 jours.', 45, y);
  y += 35;
  doc.fontSize(11).font('Helvetica-Bold').fillColor(NOIR)
    .text('Signature & Cachet AMP BÉTON', 300, y, { align: 'right', width: 250 });

  // ── PIED DE PAGE ───────────────────────────────────────────────────────
  const pageHeight = doc.page.height;
  doc.fontSize(8).font('Helvetica').fillColor(GRIS)
    .text(
      `AMP BÉTON — ERP v3.0  |  Généré le ${new Date().toLocaleString('fr-FR')}`,
      45, pageHeight - 40, { align: 'center', width: 505 }
    );

  return doc;
};

function drawRow(doc, y, colWidths, values, bgColor, textColors, bolds) {
  let x = 45;
  colWidths.forEach((w, i) => {
    doc.rect(x, y, w, 19).fillColor(bgColor).fill();
    doc.fontSize(9)
      .font(bolds[i] ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(textColors[i])
      .text(String(values[i] ?? ''), x + 4, y + 5, {
        width: w - 8,
        align: i === 0 ? 'left' : 'right',
        lineBreak: false,
      });
    x += w;
  });
}

module.exports = { generateDevis };
