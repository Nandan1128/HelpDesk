# =======================================================
# Multi-Stage Dockerfile for Unified Fullstack Deployment
# =======================================================

# Stage 1: Build Frontend and Generate Prisma Client
FROM oven/bun:1.2-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine compatibility
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Provide dummy build-time DATABASE_URL so Prisma client can generate without live database
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"

# Copy package descriptors and lockfile for caching
COPY package.json bun.lock* ./
COPY core/package.json ./core/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install all dependencies (including devDependencies for build)
RUN bun install

# Copy source code
COPY core/ ./core/
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Generate Prisma Client
WORKDIR /app/backend
RUN bun run db:generate || bun run prisma generate || bun x prisma generate

# Build Frontend Static Assets (Vite SPA)
WORKDIR /app/frontend
RUN bun run build

# =======================================================
# Stage 2: Production Runner
# =======================================================
FROM oven/bun:1.2-slim AS runner

WORKDIR /app

# Install runtime dependencies (OpenSSL required by Prisma)
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000

# Copy root workspace configs and dependencies
COPY package.json bun.lock* ./
COPY core/ ./core/
COPY backend/ ./backend/

# Copy built frontend assets to backend public directory for static serving
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules

WORKDIR /app/backend

# Expose server port
EXPOSE 5000

# Run production web server
CMD ["bun", "src/index.ts"]
