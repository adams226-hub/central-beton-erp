const QRCode   = require('qrcode');
const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const FormData = require('form-data');
require('dotenv').config();

// ─── Baileys ──────────────────────────────────────────────────────────────────
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  BufferJSON,
  initAuthCreds,
} = require('@whiskeysockets/baileys');

// ─── Prisma (Supabase) ────────────────────────────────────────────────────────
const prisma = require('./src/config/prisma');

// ─── Telegram config ──────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.AMP_BETON;
const CHAT_ID   = process.env.CHATID;

if (BOT_TOKEN && CHAT_ID) {
  console.log('✅ Telegram AMP_BETON configuré');
} else {
  console.warn('⚠️  AMP_BETON ou CHATID manquant dans .env');
}

// ─── État global ──────────────────────────────────────────────────────────────
let sock            = null;
let isWhatsAppReady = false;
let qrPendingTimer  = null;

// ═══════════════════════════════════════════════════════════════════════════════
//  Auth state stocké dans Supabase via Prisma
// ═══════════════════════════════════════════════════════════════════════════════
async function usePrismaAuthState(operatorId) {
  const toJSON   = (d) => JSON.parse(JSON.stringify(d, BufferJSON?.replacer));
  const fromJSON = (r) => r ? JSON.parse(JSON.stringify(r), BufferJSON?.reviver) : null;

  const writeData = async (data, key) => {
    await prisma.whatsAppAuthState.upsert({
      where:  { operatorId_dataKey: { operatorId, dataKey: key } },
      create: { operatorId, dataKey: key, data: toJSON(data) },
      update: { data: toJSON(data) },
    });
  };

  const readData = async (key) => {
    const item = await prisma.whatsAppAuthState.findUnique({
      where: { operatorId_dataKey: { operatorId, dataKey: key } },
    });
    return item?.data ? fromJSON(item.data) : null;
  };

  const removeData = async (key) => {
    await prisma.whatsAppAuthState.deleteMany({ where: { operatorId, dataKey: key } });
  };

  const credsRaw = await readData('creds');
  const creds    = credsRaw || initAuthCreds();

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
        const result = {};
        for (const id of ids) {
          result[id] = await readData(`keys.${type}.${id}`);
        }
        return result;
      },
      set: async (data) => {
        const tasks = [];
        for (const cat of Object.keys(data)) {
          for (const id of Object.keys(data[cat])) {
            const val = data[cat][id];
            tasks.push(val ? writeData(val, `keys.${cat}.${id}`) : removeData(`keys.${cat}.${id}`));
          }
        }
        await Promise.all(tasks);
      },
    },
  };

  const saveCreds = async () => writeData(state.creds, 'creds');
  return { state, saveCreds };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  QR Code → Telegram (multipart via https natif, retry x3)
// ═══════════════════════════════════════════════════════════════════════════════
function _telegramSendPhoto(token, chatId, imgBuffer, caption) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');
    form.append('photo', imgBuffer, { filename: 'qr.png', contentType: 'image/png' });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendPhoto`,
      method: 'POST',
      headers: form.getHeaders(),
      timeout: 20000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        const parsed = JSON.parse(body);
        if (parsed.ok) resolve(parsed);
        else reject(new Error(parsed.description || 'Telegram error'));
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    form.pipe(req);
  });
}

async function sendQRToTelegram(qrData) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    const imgBuffer = await QRCode.toBuffer(qrData, { width: 400, margin: 2, type: 'png' });
    const caption   = '📱 *AMP BETON — WhatsApp QR Code*\n\nScannez pour connecter WhatsApp\\.\n_Expire dans quelques minutes\\._';

    // 3 tentatives avec back-off
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await _telegramSendPhoto(BOT_TOKEN, CHAT_ID, imgBuffer, caption);
        console.log('✅ QR Code envoyé sur Telegram');
        return;
      } catch (e) {
        console.warn(`⚠️  Telegram tentative ${attempt}/3 : ${e.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 3000));
      }
    }
    console.error('❌ Impossible d\'envoyer le QR sur Telegram après 3 tentatives');
  } catch (e) {
    console.error('❌ Génération QR :', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Initialisation WhatsApp
// ═══════════════════════════════════════════════════════════════════════════════
async function initializeWhatsApp(operatorId = 'amp-beton-main') {
  try {
    console.log('\n════════════════════════════════════════════════');
    console.log('🚀 [WhatsApp] Baileys + Supabase (Prisma)');
    console.log(`   operatorId : ${operatorId}`);
    console.log('════════════════════════════════════════════════\n');

    let version;
    try {
      const fetched = await fetchLatestBaileysVersion();
      version = fetched.version;
    } catch (_) {
      version = [2, 3000, 1015901307];
    }

    const { state, saveCreds } = await usePrismaAuthState(operatorId);

    const silent = {
      level: 'silent',
      info: () => {}, warn: () => {}, debug: () => {}, trace: () => {},
      error: (o, m) => console.error('[Baileys]', m || o),
      child: function () { return this; },
    };

    sock = makeWASocket({
      version,
      auth: makeCacheableSignalKeyStore
        ? { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silent) }
        : state,
      printQRInTerminal: true,
      logger: silent,
      browser: ['AMP BETON', 'Chrome', '110.0.0'],
      connectTimeoutMs:       60_000,
      defaultQueryTimeoutMs:  60_000,
      keepAliveIntervalMs:    30_000,
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        if (qrPendingTimer) { clearTimeout(qrPendingTimer); qrPendingTimer = null; }
        const captured = qr;
        qrPendingTimer = setTimeout(async () => {
          qrPendingTimer = null;
          if (!isWhatsAppReady) await sendQRToTelegram(captured);
        }, 5000);
      }

      if (connection === 'open') {
        if (qrPendingTimer) { clearTimeout(qrPendingTimer); qrPendingTimer = null; }
        console.log('✅ [WhatsApp] Connecté — session Supabase sauvegardée');
        isWhatsAppReady = true;
      }

      if (connection === 'close') {
        isWhatsAppReady = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) {
          console.log('🔄 [WhatsApp] Reconnexion dans 5s...');
          setTimeout(() => initializeWhatsApp(operatorId), 5000);
        } else {
          await prisma.whatsAppAuthState.deleteMany({ where: { operatorId } });
          sock = null;
        }
      }
    });

    return sock;
  } catch (e) {
    console.error('❌ [WhatsApp] Init:', e.message);
    isWhatsAppReady = false;
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Envoi message WhatsApp (numéro burkinabé +226)
// ═══════════════════════════════════════════════════════════════════════════════
async function sendWhatsAppMessage(phone, message) {
  if (!sock || !isWhatsAppReady) {
    console.warn('⚠️  WhatsApp non connecté — message non envoyé');
    return { success: false };
  }
  try {
    let num = phone.replace(/[\s\-\(\)\+]/g, '');
    if (!num.startsWith('226')) num = '226' + (num.startsWith('0') ? num.slice(1) : num);
    const jid = `${num}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    console.log(`📤 WhatsApp → ${jid}`);
    return { success: true };
  } catch (e) {
    console.error('❌ WhatsApp send:', e.message);
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Envoi groupé vers les utilisateurs internes ayant un rôle donné
// ═══════════════════════════════════════════════════════════════════════════════
async function notifierRoles(roles, message) {
  try {
    const contacts = await prisma.whatsAppContact.findMany({ where: { actif: true } });
    if (contacts.length === 0) return;
    await Promise.all(contacts.map(c => sendWhatsAppMessage(c.telephone, message)));
  } catch (e) {
    console.error('[WhatsApp] notifierRoles erreur:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Notifications métier → utilisateurs internes
// ═══════════════════════════════════════════════════════════════════════════════
async function notifierCommande(commande) {
  const msg = [
    `📦 *AMP BETON — Nouvelle Commande*`,
    `Référence : ${commande.reference}`,
    `Client : ${commande.nomClient}`,
    `Béton : ${commande.typeBeton} — Volume : ${commande.volumeBeton} m³`,
    `Montant : ${(commande.montantCommande || 0).toLocaleString('fr-FR')} FCFA`,
    `Date livraison : ${commande.dateLivraison ? new Date(commande.dateLivraison).toLocaleDateString('fr-FR') : '—'}`,
    `_En attente de validation._`,
  ].join('\n');
  return notifierRoles(['PDG', 'SECRETAIRE'], msg);
}

async function notifierPaiement(paiement, commande) {
  const MODE = {
    ESPECE: 'Espèces', VIREMENT: 'Virement', CHEQUE: 'Chèque',
    MOBILE_MONEY: 'Mobile Money', CREDIT_CLIENT: 'Crédit client',
  };
  const resteAPayer = Math.max(0, (commande.montantCommande || 0) - (commande.montantPaye || 0));
  const msg = [
    `💰 *AMP BETON — Paiement Reçu*`,
    `Commande : ${commande.reference}`,
    `Client : ${commande.nomClient}`,
    `Montant payé : ${parseFloat(paiement.montant).toLocaleString('fr-FR')} FCFA`,
    `Mode : ${MODE[paiement.modePaiement] || paiement.modePaiement}`,
    `Reste à payer : ${resteAPayer.toLocaleString('fr-FR')} FCFA`,
  ].join('\n');
  return notifierRoles(['PDG', 'CHEF_COMPTABLE', 'ASSISTANT_COMPTABLE'], msg);
}

async function notifierLivraison(livraison, commande, statut) {
  let msg;
  if (statut === 'EN_ROUTE') {
    msg = [
      `🚚 *AMP BETON — Livraison en Route*`,
      `Commande : ${commande.reference}`,
      `Client : ${commande.nomClient || '—'}`,
      `Volume : ${livraison.volumePlanifie} m³`,
      `Chauffeur : ${livraison.chauffeur || '—'}`,
    ].join('\n');
  } else if (statut === 'LIVREE') {
    msg = [
      `✅ *AMP BETON — Livraison Confirmée*`,
      `Commande : ${commande.reference}`,
      `Client : ${commande.nomClient || '—'}`,
      `Volume livré : ${livraison.volumeReel || livraison.volumePlanifie} m³`,
    ].join('\n');
  }
  if (msg) return notifierRoles(['PDG', 'CHEF_DE_SITE'], msg);
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const isWhatsAppConnected = () => isWhatsAppReady;

const getWhatsAppStatus = () => ({
  isReady:  isWhatsAppReady,
  client:   sock ? 'initialized' : 'not initialized',
  library:  'baileys',
  storage:  'supabase/prisma',
});

async function resetWhatsAppSession(operatorId = 'amp-beton-main') {
  if (sock) { try { await sock.logout(); } catch (_) {} sock = null; }
  await prisma.whatsAppAuthState.deleteMany({ where: { operatorId } });
  isWhatsAppReady = false;
  return { success: true, message: 'Session réinitialisée. Redémarrez pour re-scanner.' };
}

module.exports = {
  initializeWhatsApp,
  sendWhatsAppMessage,
  notifierCommande,
  notifierPaiement,
  notifierLivraison,
  isWhatsAppConnected,
  getWhatsAppStatus,
  resetWhatsAppSession,
};
