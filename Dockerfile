FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL requis par Prisma
RUN apk add --no-cache openssl

# Dépendances backend
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Dépendances frontend
COPY frontend/package*.json ./frontend/
RUN npm install --prefix frontend

# Sources backend
COPY tsconfig.json ./
COPY src ./src/

# Sources frontend
COPY frontend/index.html ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/tsconfig.node.json ./frontend/
COPY frontend/postcss.config.js ./frontend/
COPY frontend/tailwind.config.js ./frontend/
COPY frontend/src ./frontend/src/

# Build backend + frontend
RUN npx prisma generate && npx tsc && npm run build --prefix frontend

# ── Image finale ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma/

RUN mkdir -p logs

CMD ["node", "dist/index.js"]
