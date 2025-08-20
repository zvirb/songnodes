FROM node:18-alpine

# Install system dependencies for health checks
RUN apk add --no-cache \
    curl \
    netcat-openbsd \
    bash \
    coreutils

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose health check port
EXPOSE 8085

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8085/health/live || exit 1

# Start the service
CMD ["node", "health-check.js"]