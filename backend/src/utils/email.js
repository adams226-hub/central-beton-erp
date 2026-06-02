const nodemailer = require('nodemailer');
const logger = require('../config/logger');

// Transporter configuré via variables d'environnement
// EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS (optionnels — désactivé si absents)
const createTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) return null;
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
};

/**
 * Envoie un email de notification de validation
 * @param {string} to - Email du destinataire
 * @param {string} nom - Nom complet du destinataire
 * @param {object} commande - La commande concernée
 * @param {string} etape - Description de l'étape (ex: "Étape 3 — Chef Comptable")
 */
const envoyerNotifValidation = async (to, nom, commande, etape) => {
  const transporter = createTransporter();
  if (!transporter) return; // Email non configuré, on passe

  const sujet = `[AMP BÉTON] Validation requise — Commande ${commande.reference}`;
  const corps = `
Bonjour ${nom},

Une commande nécessite votre validation.

━━━━━━━━━━━━━━━━━━━━━━━━━
Référence    : ${commande.reference}
Client       : ${commande.nomClient}
Volume       : ${commande.volumeBeton} m³ de ${commande.typeBeton}
Chantier     : ${commande.adresseChantier}
Étape        : ${etape}
━━━━━━━━━━━━━━━━━━━━━━━━━

Connectez-vous à la plateforme AMP BÉTON  pour valider ou rejeter cette commande.

Cordialement,
AMP BÉTON 
  `.trim();

  try {
    await transporter.sendMail({
      from: `"AMP BÉTON" <${process.env.EMAIL_USER}>`,
      to,
      subject: sujet,
      text: corps,
    });
    logger.info(`Email de validation envoyé à ${to} pour commande ${commande.reference}`);
  } catch (err) {
    logger.warn(`Échec envoi email à ${to} : ${err.message}`);
  }
};

/**
 * Envoie un email d'information (commande validée, rejetée, etc.)
 * @param {string} to - Email du destinataire
 * @param {string} nom - Nom complet du destinataire
 * @param {string} sujet - Sujet du message
 * @param {string} message - Corps du message
 */
const envoyerEmail = async (to, nom, sujet, message) => {
  const transporter = createTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: `"AMP BÉTON ERP" <${process.env.EMAIL_USER}>`,
      to,
      subject: `[AMP BÉTON] ${sujet}`,
      text: `Bonjour ${nom},\n\n${message}\n\nCordialement,\nAMP BÉTON ERP`,
    });
    logger.info(`Email envoyé à ${to} : ${sujet}`);
  } catch (err) {
    logger.warn(`Échec envoi email à ${to} : ${err.message}`);
  }
};

module.exports = { envoyerNotifValidation, envoyerEmail };
