FROM node:20-slim

WORKDIR /app

# Installer les dépendances système nécessaires pour Baileys/WhatsApp
RUN apt-get update && apt-get install -y python3 make g++ git openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

COPY . .

EXPOSE 5000

CMD ["node", "src/app.js"]
