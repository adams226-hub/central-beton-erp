#!/bin/bash
set -e
echo "========================================"
echo "  AMP BETON ERP - Déploiement VPS"
echo "========================================"

# ── 1. Node.js 20 ─────────────────────────
echo "[1/8] Installation Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version

# ── 2. Nginx ──────────────────────────────
echo "[2/8] Installation Nginx..."
apt-get install -y nginx
systemctl enable nginx

# ── 3. PM2 ────────────────────────────────
echo "[3/8] Installation PM2..."
npm install -g pm2

# ── 4. Cloner le repo ─────────────────────
echo "[4/8] Téléchargement du code..."
rm -rf /opt/amp-beton
git clone https://github.com/adams226-hub/central-beton-erp.git /opt/amp-beton
cd /opt/amp-beton

# ── 5. Fichier .env backend ───────────────
echo "[5/8] Configuration environnement..."
cat > /opt/amp-beton/backend/.env << 'ENVEOF'
PORT=5000
NODE_ENV=production
FRONTEND_URL=http://92.113.29.87
DATABASE_URL="postgresql://postgres.xurfkgdvqxrwlifgneww:mLRmggkeqOw40PFy@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xurfkgdvqxrwlifgneww:mLRmggkeqOw40PFy@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
JWT_ACCESS_SECRET=74dc000fcb934a17157d6e7a312393382bf179f1e401a32ec09e2e6b433c2c5e
JWT_REFRESH_SECRET=e7f74fde21fc38ca7c5ff4ace34e673f7e8a8921ef501c0adbd1ca60ad1e1d35
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
LOG_LEVEL=info
LOG_DIR=logs
ML_SERVICE_URL=http://localhost:8001
AMP_BETON=8806228518:AAHFpkUMh3rTyp6N1RotOLmirksOsPuYfkE
CHATID=2014444407
ENVEOF

# ── 6. Installer dépendances backend ──────
echo "[6/8] Installation dépendances backend..."
cd /opt/amp-beton/backend
npm install
npx prisma generate
mkdir -p uploads logs

# ── 7. Build frontend ─────────────────────
echo "[7/8] Construction du frontend..."
cd /opt/amp-beton/frontend
npm install
VITE_API_URL=http://92.113.29.87/api VITE_SOCKET_URL=http://92.113.29.87 npm run build

# ── 8. Configurer Nginx ───────────────────
echo "[8/8] Configuration Nginx..."
cat > /etc/nginx/sites-available/amp-beton << 'NGINXEOF'
server {
    listen 80;
    server_name 92.113.29.87 _;

    # Frontend React
    root /opt/amp-beton/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Socket.io
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
NGINXEOF

ln -sf /etc/nginx/sites-available/amp-beton /etc/nginx/sites-enabled/amp-beton
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# ── Démarrer backend avec PM2 ─────────────
echo "Démarrage backend..."
cd /opt/amp-beton/backend
pm2 delete amp-backend 2>/dev/null || true
pm2 start src/app.js --name amp-backend
pm2 save
pm2 startup | tail -1 | bash || true

echo ""
echo "========================================"
echo "  DÉPLOIEMENT TERMINÉ !"
echo "========================================"
echo "  Frontend : http://92.113.29.87"
echo "  API      : http://92.113.29.87/api"
echo "  Coolify  : http://92.113.29.87:8000"
echo "========================================"
pm2 status
