const XLSX = require('xlsx');

// Formatage monétaire sans FCFA pour les cellules numériques
const num = (n) => (n == null || isNaN(Number(n)) ? 0 : Math.round(Number(n)));

/**
 * Génère un fichier Excel professionnel pour le rapport Bénéfices par commande
 */
const generateExcelBenefices = (data, dateDebut, dateFin) => {
  const wb = XLSX.utils.book_new();

  // ── Feuille 1 : Données détaillées ──────────────────────────────────────
  const headers = [
    'Référence', 'Client', 'Type béton', 'Volume (m³)',
    'CA (FCFA)', 'Coût total (FCFA)', 'Bénéfice net (FCFA)', 'Taux marge (%)',
    'Date création',
  ];

  const rows = (data.commandes || []).map((c) => [
    c.reference || '',
    c.nomClient || '',
    c.typeBeton || '',
    num(c.volumeBeton),
    num(c.montantCommande),
    num(c.depensesReelles),
    num(c.beneficeNetReel),
    num(c.tauxMargeReel),
    c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '',
  ]);

  // Ligne totaux
  const totaux = data.totaux || {};
  rows.push([
    'TOTAUX', '', '', '',
    num(totaux.ca),
    num(totaux.depenses),
    num(totaux.benefice),
    num(totaux.tauxMarge),
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Largeurs de colonnes
  ws['!cols'] = [
    { wch: 20 }, // Référence
    { wch: 25 }, // Client
    { wch: 12 }, // Type béton
    { wch: 12 }, // Volume
    { wch: 18 }, // CA
    { wch: 18 }, // Coût
    { wch: 18 }, // Bénéfice
    { wch: 12 }, // Taux
    { wch: 14 }, // Date
  ];

  // Style en-tête (ligne 1)
  const headerStyle = {
    fill: { fgColor: { rgb: '1E40AF' } },
    font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      bottom: { style: 'medium', color: { rgb: '1E3A8A' } },
    },
  };

  headers.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cell]) ws[cell].s = headerStyle;
  });

  // Style lignes données (alternance)
  const dataRows = data.commandes || [];
  dataRows.forEach((_, ri) => {
    const rowIdx = ri + 1;
    const bgColor = ri % 2 === 0 ? 'FFFFFF' : 'EFF6FF';
    for (let ci = 0; ci < headers.length; ci++) {
      const cell = XLSX.utils.encode_cell({ r: rowIdx, c: ci });
      if (!ws[cell]) continue;
      ws[cell].s = {
        fill: { fgColor: { rgb: bgColor } },
        font: { sz: 10 },
        alignment: ci >= 4 && ci <= 7 ? { horizontal: 'right' } : { horizontal: 'left' },
        border: { bottom: { style: 'thin', color: { rgb: 'E5E7EB' } } },
      };
    }
  });

  // Style ligne totaux
  const totauxRow = dataRows.length + 1;
  for (let ci = 0; ci < headers.length; ci++) {
    const cell = XLSX.utils.encode_cell({ r: totauxRow, c: ci });
    if (!ws[cell]) continue;
    ws[cell].s = {
      fill: { fgColor: { rgb: 'DBEAFE' } },
      font: { bold: true, sz: 11, color: { rgb: '1E40AF' } },
      alignment: ci >= 4 ? { horizontal: 'right' } : { horizontal: 'left' },
      border: {
        top: { style: 'medium', color: { rgb: '1E40AF' } },
        bottom: { style: 'medium', color: { rgb: '1E40AF' } },
      },
    };
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Bénéfices par commande');

  // ── Feuille 2 : Résumé ──────────────────────────────────────────────────
  const resumeData = [
    ['RAPPORT BÉNÉFICES — AMP BÉTON'],
    [''],
    ['Période', `${dateDebut || '—'} au ${dateFin || '—'}`],
    ['Nombre de commandes', (data.commandes || []).length],
    [''],
    ['INDICATEURS FINANCIERS', ''],
    ["Chiffre d'affaires total", num(totaux.ca)],
    ['Dépenses totales', num(totaux.depenses)],
    ['Bénéfice net total', num(totaux.benefice)],
    ['Taux de marge moyen', `${num(totaux.tauxMarge)} %`],
    [''],
    ['Généré le', new Date().toLocaleString('fr-FR')],
    ['AMP BÉTON — ERP v3.0', ''],
  ];

  const wsResume = XLSX.utils.aoa_to_sheet(resumeData);
  wsResume['!cols'] = [{ wch: 30 }, { wch: 25 }];

  // Titre principal
  if (wsResume['A1']) {
    wsResume['A1'].s = {
      font: { bold: true, sz: 16, color: { rgb: '1E40AF' } },
      fill: { fgColor: { rgb: 'DBEAFE' } },
    };
  }
  // Section indicateurs
  if (wsResume['A6']) {
    wsResume['A6'].s = {
      font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1E40AF' } },
    };
  }

  XLSX.utils.book_append_sheet(wb, wsResume, 'Résumé');

  // Retourner le buffer binaire
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = { generateExcelBenefices };
