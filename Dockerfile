# syntax=docker/dockerfile:1
#
# Four stages: deps -> builder -> migrator -> runner.
#
# `migrator` is a separate target because the standalone build does not carry
# the Prisma CLI: migrations cannot run from the image that serves the web app.
# Compose runs it once and waits for it to exit before starting `app`.

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app

# The Prisma schema engine is a native binary that links against OpenSSL.
RUN apk add --no-cache openssl

# The schema is copied before `npm ci` because two install hooks need it:
# `postinstall: prisma generate`, and the @prisma/engines fetch that pulls the
# linux-musl schema-engine binary used by `prisma migrate deploy`. Running the
# install with --ignore-scripts would leave the migrator without that binary.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma

# Placeholder only: `prisma generate` reads the URL from prisma.config.ts and
# would refuse an undefined one. Nothing connects to a database during install.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN npm ci

# ---------- migrator-deps ----------
# Trimmed copy of the install for the migrator. It has to be its own stage:
# deleting files in a later layer hides them without reclaiming the space, so
# the prune only counts if what follows COPYs the resulting tree instead.
#
# This stage runs `prisma migrate deploy` and `tsx prisma/seed.ts`, nothing
# else. The seed's import graph is three files deep - the generated client, the
# rule catalogue and the settings catalogue - and none of them reach the front
# end, so the front-end trees are dead weight here.
FROM deps AS migrator-deps
RUN cd node_modules \
 && rm -rf next @next react react-dom \
           lucide-react @base-ui tailwindcss @tailwindcss shadcn @img \
           exceljs typescript \
           eslint @eslint eslint-config-next @typescript-eslint \
           vitest @vitest

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# src/generated is excluded from the build context (it is gitignored output),
# so the client has to be generated here or `next build` cannot resolve it.
RUN npx prisma generate

# Baked into the standalone server.js, hence a build argument rather than an
# env var. Changing the domain means rebuilding the image - see the ops doc.
ARG ALLOWED_ORIGINS=localhost:3000
ENV ALLOWED_ORIGINS=$ALLOWED_ORIGINS

# Placeholder again: modules imported during the build touch the Prisma client,
# and a missing DATABASE_URL throws before a page is ever rendered.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- migrator (runs once, serves nothing) ----------
FROM node:22-alpine AS migrator
WORKDIR /app
ENV TZ=Asia/Ho_Chi_Minh
ENV NODE_ENV=production
RUN apk add --no-cache openssl tzdata

COPY --from=migrator-deps /app/node_modules ./node_modules
COPY --from=builder /app/src/generated ./src/generated
COPY package.json tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
# The seed imports the rule catalogue straight from the app source.
COPY src ./src

# DATABASE_URL arrives at run time from the compose env, never from a layer.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache tzdata \
 && addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs

# Created with the right owner up front: Docker copies these permissions onto
# the volume the first time it is mounted, and the app cannot chown as nextjs.
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Not part of the standalone bundle. Without them every page loads unstyled.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
