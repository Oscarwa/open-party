# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js evaluates every route module (including dynamic ones) during its
# build-time "collect page data" phase, which transitively imports
# src/db/client.ts and runs loadEnv() at module-import time. These are
# shape-valid placeholders only — no real secret, no live connection is
# attempted at build time (postgres.js connects lazily) — and they do not
# carry over to the runner stage below (Docker multi-stage builds don't
# propagate ENV across stages unless re-declared).
ENV DATABASE_URL="postgres://build:build@localhost:5432/build"
ENV WAHA_URL="http://build:3000"
ENV WAHA_SESSION="build"
ENV SESSION_SECRET="build-time-placeholder-not-a-real-secret-32c"
ENV ADMIN_PASSWORD="build-time-placeholder-password-12c"
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# SQL migrations ship with the image so the deployed schema version is always
# inspectable alongside the code it belongs to. Applying them is a documented
# manual step run from the host — see docs/deploy/tailscale.md,
# "Applying database migrations".
COPY --from=builder --chown=nextjs:nodejs /app/src/db/migrations ./src/db/migrations
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
