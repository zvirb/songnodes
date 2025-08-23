# ===========================================
# Enhanced Visualization Service Dockerfile
# Optimized multi-stage build for Node.js 18 TypeScript application
# Performance target: <200MB final image, <60s build time
# ===========================================

# ===== DEPENDENCIES CACHE STAGE =====
FROM node:18-alpine AS deps-cache

# Install system dependencies once for better caching
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    dumb-init \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

WORKDIR /app

# Copy only package files for better layer caching
COPY package*.json ./

# Install all dependencies (dev + prod) for build
RUN npm install && npm cache clean --force

# ===== BUILD STAGE =====
FROM deps-cache AS builder

# Copy build configuration
COPY tsconfig.json ./

# Copy source code (order matters for layer caching)
COPY src/ ./src/

# Build application with TypeScript compilation
RUN npm run build && \
    # Remove development dependencies to reduce transfer size
    npm prune --omit=dev && \
    # Clean up build artifacts
    rm -rf .npm tsconfig.json src/

# ===== NODE.JS PRODUCTION STAGE =====
FROM node:18-alpine AS production

# Apply security updates and install minimal runtime dependencies
RUN apk upgrade --no-cache && \
    apk add --no-cache \
    curl \
    ca-certificates \
    dumb-init \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Create non-root user with minimal privileges
RUN addgroup -g 1001 -S appgroup && \
    adduser -S -u 1001 -G appgroup -h /app appuser

WORKDIR /app

# Copy built application and production dependencies from builder stage
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json

# Set proper permissions
RUN chown -R appuser:appgroup /app && \
    chmod -R 755 /app

# Optimized health check for Node.js service
HEALTHCHECK --interval=45s --timeout=5s --start-period=30s --retries=2 \
    CMD curl -f --max-time 3 http://localhost:8085/health || exit 1

# Use specific port for production
EXPOSE 8085

# Switch to non-root user before starting
USER appuser

# Use dumb-init for proper signal handling and zombie reaping
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# ===== DEVELOPMENT STAGE =====
FROM deps-cache AS development

# Install additional development tools
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Create non-root user for development
RUN addgroup -g 1001 -S devgroup && \
    adduser -S -u 1001 -G devgroup -h /app devuser

# Copy configuration files
COPY --chown=devuser:devgroup tsconfig.json ./

# Switch to non-root user
USER devuser

# Copy source code for development
COPY --chown=devuser:devgroup src/ ./src/
COPY --chown=devuser:devgroup public/ ./public/
COPY --chown=devuser:devgroup minimal-server.js ./minimal-server.js

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8085/health || exit 1

# Expose port
EXPOSE 8085 8086

# Default command for development - use minimal server for testing
CMD ["npm", "run", "dev:minimal"]

# ===== METADATA =====
LABEL maintainer="SongNodes Development Team"
LABEL version="1.0.0"
LABEL description="Enhanced Visualization Service for SongNodes Music Graph Platform"
LABEL org.opencontainers.image.source="https://github.com/songnodes/enhanced-visualization"
LABEL org.opencontainers.image.documentation="https://docs.songnodes.com/visualization"
LABEL org.opencontainers.image.licenses="MIT"