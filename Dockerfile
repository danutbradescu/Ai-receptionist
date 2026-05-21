# === BUILDER STAGE ===
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-workspace.yaml .
COPY package.json .
COPY pnpm-lock.yaml .

# Copiem packages ÎNAINTE de install ca pnpm să vadă workspace-ul complet
COPY packages ./packages
COPY apps ./apps

# Instalăm toate dependențele inclusiv cele din sub-pachete
RUN pnpm install --frozen-lockfile

# Acum binarul prisma e în node_modules/.bin din rădăcină
RUN pnpm --filter @voltera/db run db:generate

# Compilăm TypeScript
RUN pnpm --filter api run build

# === PRODUCTION STAGE ===
FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pnpm

COPY --from=builder /app/pnpm-workspace.yaml .
COPY --from=builder /app/package.json .
COPY --from=builder /app/pnpm-lock.yaml .
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

RUN pnpm install --prod --frozen-lockfile

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "apps/api/dist/server.js"] 
 
