FROM node:20-slim

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
RUN pnpm --filter @voltera/db run build
RUN pnpm --filter api run build

ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/api/dist/server.js"]