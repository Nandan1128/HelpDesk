# =======================================================
# Standalone Frontend Dockerfile (Vite + Nginx)
# =======================================================
FROM oven/bun:1.2-slim AS builder

WORKDIR /app

# Copy package descriptors
COPY package.json bun.lock* ./
COPY core/package.json ./core/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN bun install

# Copy source
COPY core/ ./core/
COPY frontend/ ./frontend/

# Build Vite frontend
WORKDIR /app/frontend
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN bun run build

# Nginx runner
FROM nginx:alpine AS runner

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
