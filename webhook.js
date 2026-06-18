const http    = require('http');
const { exec } = require('child_process');
const crypto   = require('crypto');

const SECRET = 'amp-beton-deploy-2024';
const PORT   = 9000;

const UPDATE_CMD = [
  'cd /opt/amp-beton',
  'git pull origin main',
  'cd frontend && VITE_API_URL=https://ampbeton.com/api VITE_SOCKET_URL=https://ampbeton.com npm run build',
  'cd ../backend && npm install',
  'npx prisma generate',
  'pm2 restart amp-backend',
].join(' && ');

http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(200); res.end('AMP BETON Webhook OK'); return;
  }

  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    const sig      = req.headers['x-hub-signature-256'] || '';
    const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    if (sig !== expected) { res.writeHead(401); res.end('Unauthorized'); return; }

    res.writeHead(200); res.end('Deploy started');
    console.log('[Webhook] Deploy déclenché —', new Date().toISOString());

    exec(UPDATE_CMD, { timeout: 180000 }, (err, stdout, stderr) => {
      if (err) console.error('[Webhook] Erreur:', err.message);
      else     console.log('[Webhook] Succès\n', stdout.slice(-500));
    });
  });
}).listen(PORT, () => console.log(`[Webhook] Serveur démarré sur port ${PORT}`));
