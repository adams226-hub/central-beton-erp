#!/bin/bash
set -e
echo "========================================"
echo "  AMP BETON — Configuration SSL HTTPS"
echo "========================================"

# 1. Installer certbot
echo "[1/3] Installation Certbot..."
apt-get update -qq
apt-get install -y certbot python3-certbot-nginx

# 2. Obtenir le certificat Let's Encrypt
echo "[2/3] Obtention certificat SSL pour ampbeton.com..."
certbot --nginx -d ampbeton.com \
  --non-interactive \
  --agree-tos \
  --email r.bationo@amp-bf.com \
  --redirect

# 3. Renouvellement automatique (cron)
echo "[3/3] Activation renouvellement automatique..."
systemctl enable certbot.timer
systemctl start certbot.timer

# Redémarrer Nginx
nginx -t && systemctl restart nginx

echo ""
echo "========================================"
echo "  SSL INSTALLÉ !"
echo "  Site accessible : https://ampbeton.com"
echo "========================================"
