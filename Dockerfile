# syntax=docker/dockerfile:1

# ---- deps: install once, reused by both the build and prod-only layers ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile TypeScript -> dist/ ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- prod deps: node_modules without devDependencies, for a smaller image ----
# Installed fresh (not copied+pruned from deps) inside this same alpine
# container so sharp's native bindings resolve to the linux-musl build it
# actually needs at runtime, not whatever platform built the image.
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: only what's needed to run the compiled app ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runs as an unprivileged user rather than root — standard container
# hardening, and the base node:alpine image ships this user already.
RUN addgroup -S app && adduser -S app -G app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# STORAGE_DRIVER=local (the default — see src/uploads/storage/) writes
# uploads here. In production STORAGE_DRIVER=s3 is set and this directory
# stays empty, but it's kept as a mounted volume so anyone running this
# image locally/without S3 configured doesn't lose uploads across restarts.
RUN mkdir -p /app/uploads && chown -R app:app /app
VOLUME ["/app/uploads"]

USER app
EXPOSE 3000

# tsc compiles src/ into dist/src/ (no rootDir override), not dist/ directly
# — see main.ts's own comment on this. Matches package.json's start:prod.
CMD ["node", "dist/src/main"]
