const fs   = require('fs');
const path = require('path');

const AUTH_DIR = path.join(__dirname, 'whatsapp-auth');

if (fs.existsSync(AUTH_DIR)) {
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  console.log('✅ Session WhatsApp effacée (dossier supprimé)');
} else {
  console.log('ℹ️  Aucune session à effacer');
}
