# Multi-stage Dockerfile for GridPulse Server
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# Copy root workspace configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

# Build shared package and server
RUN pnpm --filter @gridpulse/shared build || true
RUN pnpm --filter @gridpulse/server build

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV SERVER_PORT=3001

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# Copy workspace setup and built code
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
