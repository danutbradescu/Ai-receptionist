# === BUILDER STAGE ===
FROM node:20-slim AS builder

# Instalăm dependențele necesare pentru Prisma și sistem
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalăm pnpm
RUN npm install -g pnpm

# Copiem fișierele workspace
COPY pnpm-workspace.yaml .
COPY package.json .
COPY pnpm-lock.yaml .

# Instalăm dependențele workspace
RUN pnpm install --frozen-lockfile

# Copiem pachetele workspace
COPY packages ./packages
COPY apps ./apps

# Generăm clientul Prisma pentru pachetul db
RUN pnpm --filter @voltera/db exec prisma generate

# Compilăm TypeScript în JavaScript pentru API
RUN pnpm --filter api run build

# === PRODUCTION STAGE ===
FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalăm pnpm
RUN npm install -g pnpm

# Copiem doar fișierele necesare din builder
COPY --from=builder /app/pnpm-workspace.yaml .
COPY --from=builder /app/package.json .
COPY --from=builder /app/pnpm-lock.yaml .
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Instalăm doar dependențele de producție
RUN pnpm install --prod --frozen-lockfile

# Cloud Run expune automat portul 8080
ENV PORT=8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "apps/api/dist/server.js"]