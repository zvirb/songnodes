FROM node:18-alpine

# Install PostgreSQL client tools for backup/restore
RUN apk add --no-cache postgresql-client

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create temp directory for uploads and backups
RUN mkdir -p /tmp/uploads && chmod 777 /tmp/uploads

# Change ownership to non-root user
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Security: Drop all capabilities and run as non-root
# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1

CMD ["node", "server.js"]