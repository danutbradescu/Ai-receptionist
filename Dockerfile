# === BUILDER STAGE ===
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-workspace.yaml .
COPY package.json .
COPY pnpm-lock.yaml .

COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @voltera/db run db:generate

# Compilam DB package
RUN pnpm --filter @voltera/db run build

# Compilam API
RUN pnpm --filter api run build

# === PRODUCTION STAGE ===
FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pnpm

COPY --from=builder /app/pnpm-workspace.yaml .
COPY --from=builder /app/package.json .
COPY --from=builder /app/pnpm-lock.yaml .

# Copiem db compilat
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

# Copiem API compilat
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Copiem node_modules cu Prisma client generat
COPY --from=builder /app/node_modules ./node_modules

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "apps/api/dist/server.js"]