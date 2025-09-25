# Multi-stage Dockerfile for SongNodes Frontend
# Development and Production Build Support

# Development stage
FROM public.ecr.aws/docker/library/node:20-alpine AS development

# Set working directory
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install all dependencies for development
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copy source code
COPY . .

# Expose development port
EXPOSE 3006

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3006 || exit 1

# Development command
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3006"]

# Stage 1: Build environment
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV VITE_FILTER_PIXI_DEPRECATIONS=true

# Install system dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY vite.config.production.ts ./
COPY tailwind.config.js ./

# Install all dependencies including devDependencies for build
# Must explicitly set NODE_ENV or use --include=dev to install devDependencies
RUN NODE_ENV=development npm install --no-audit --legacy-peer-deps

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./

# Build the application using production config without PWA
RUN npx vite build --config vite.config.production.ts --mode production

# Stage 2: Production server
FROM nginx:alpine AS production

# Install security updates
RUN apk upgrade --no-cache

# Copy custom nginx configuration
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/x-javascript
        application/javascript
        application/xml+rss
        application/json;
    
    # Serve static files
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Production frontend serves only static files
    # All API and WebSocket traffic is handled by the nginx load balancer
    
    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx user already exists in nginx:alpine, just set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Health check for production nginx
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Run as root (nginx manages its own privileges)
# USER nginx - commented out to avoid permission issues

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
