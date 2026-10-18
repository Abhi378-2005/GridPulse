# Multi-stage Dockerfile for GridPulse Web Frontend
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# Copy root workspace configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build shared package and Next.js frontend
RUN pnpm --filter @gridpulse/shared build || true
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @gridpulse/web build

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# Copy workspace setup and built code
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/web/package.json ./apps/web/
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000

CMD ["pnpm", "--filter", "@gridpulse/web", "start"]
