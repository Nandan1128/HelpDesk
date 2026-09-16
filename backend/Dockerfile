# =======================================================
# Standalone Backend Dockerfile
# =======================================================
FROM oven/bun:1.2-slim AS runner

WORKDIR /app

# Install OpenSSL for Prisma engine compatibility
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000

# Copy workspace descriptors
COPY package.json bun.lock* ./
COPY core/ ./core/
COPY backend/ ./backend/

# Install dependencies across workspaces
RUN bun install --production

# Generate Prisma Client
WORKDIR /app/backend
RUN bun x prisma generate

EXPOSE 5000

CMD ["bun", "scripts/start-production.ts"]
