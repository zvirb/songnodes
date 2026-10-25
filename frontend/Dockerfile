# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies using clean install and clear cache
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Remove default nginx static assets and clean package caches
RUN rm -rf /usr/share/nginx/html/* /var/cache/apk/* /tmp/*

# Copy built assets from builder stage
COPY --chown=nginx:nginx --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration for non-root execution on unprivileged port 8080
RUN echo 'server { \
    listen 8080; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Long-term cache for hashed assets (JS, CSS with [hash] in filename) \
    # These have content hashes, so new versions get new URLs \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # NO CACHE for index.html and root path - CRITICAL for updates \
    location = / { \
        try_files /index.html =404; \
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"; \
        add_header Pragma "no-cache"; \
        add_header Expires "0"; \
        add_header Last-Modified $date_gmt; \
        add_header ETag ""; \
        if_modified_since off; \
        etag off; \
    } \
    \
    location ~ \.html$ { \
        try_files $uri /index.html; \
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"; \
        add_header Pragma "no-cache"; \
        add_header Expires "0"; \
        add_header Last-Modified $date_gmt; \
        add_header ETag ""; \
        if_modified_since off; \
        etag off; \
    } \
    \
    # Fallback for other files and SPA routing \
    location / { \
        try_files $uri $uri/ /index.html; \
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"; \
        add_header Pragma "no-cache"; \
        add_header Expires "0"; \
        add_header Last-Modified $date_gmt; \
        add_header ETag ""; \
        if_modified_since off; \
        etag off; \
    } \
    \
    # API proxy routing - Kubernetes ConfigMap will override this with correct service names \
    # This is a fallback config for non-k8s deployments \
    location ~ ^/api/(graph|v1/visualization|user-setlists) { \
        proxy_pass http://graph-visualization:8084; \
        proxy_http_version 1.1; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
    } \
    \
    location /api/ { \
        proxy_pass http://rest-api:8082; \
        proxy_http_version 1.1; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Set directory permissions for unprivileged nginx execution
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d /usr/share/nginx/html

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
