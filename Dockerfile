# ==========================================
# CosmoAI Multi-Stage Production Dockerfile
# ==========================================

# Stage 1: Build Frontend Assets
FROM node:20-alpine AS client-builder
WORKDIR /app/client

# Copy client manifests and install dependencies
COPY client/package*.json ./
RUN npm ci

# Copy client source code and build Vite bundle
COPY client/ ./
RUN npm run build

# Stage 2: Production Backend Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install root dependencies (production only)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source code and extractors
COPY server/ ./server/

# Copy built frontend bundle from Stage 1 into client/dist
COPY --from=client-builder /app/client/dist ./client/dist

# Create storage directory for uploaded files and set permissions
RUN mkdir -p uploads_storage && chown -R node:node /app

# Run as non-root user for security
USER node

# Expose backend service port
EXPOSE 5000

# Start production server
CMD ["node", "server/index.js"]

