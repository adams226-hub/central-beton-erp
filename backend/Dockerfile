FROM node:20-alpine

WORKDIR /app

# Installer les dépendances système nécessaires pour Baileys/WhatsApp
RUN apk add --no-cache python3 make g++ git

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

COPY . .

EXPOSE 5000

CMD ["node", "src/app.js"]
