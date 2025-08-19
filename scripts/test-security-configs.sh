#!/bin/bash

# Quick Security Configuration Test
# Tests security configurations without requiring running containers

set -euo pipefail

PROJECT_ROOT="/home/marku/Documents/programming/songnodes"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

log() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED++))
}

warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNINGS++))
}

error() {
    echo -e "${RED}✗ $1${NC}"
    ((FAILED++))
}

echo "🔒 MusicDB Security Configuration Test"
echo "======================================"

# Test SSL certificates
echo ""
echo "SSL Certificate Validation:"
if [ -f "$PROJECT_ROOT/nginx/ssl/musicdb.crt" ]; then
    log "SSL certificate exists"
    
    if openssl x509 -checkend 86400 -noout -in "$PROJECT_ROOT/nginx/ssl/musicdb.crt"; then
        log "SSL certificate is valid"
    else
        warn "SSL certificate expires soon"
    fi
    
    # Check SAN
    if openssl x509 -in "$PROJECT_ROOT/nginx/ssl/musicdb.crt" -text -noout | grep -q "musicdb.local"; then
        log "Certificate contains musicdb.local domain"
    else
        error "Certificate missing musicdb.local domain"
    fi
else
    error "SSL certificate not found"
fi

# Test private key
if [ -f "$PROJECT_ROOT/nginx/ssl/musicdb.key" ]; then
    log "SSL private key exists"
    
    # Check permissions
    local perms=$(stat -c "%a" "$PROJECT_ROOT/nginx/ssl/musicdb.key")
    if [ "$perms" = "600" ]; then
        log "SSL private key has secure permissions (600)"
    else
        warn "SSL private key permissions not secure ($perms)"
    fi
else
    error "SSL private key not found"
fi

# Test DH parameters
if [ -f "$PROJECT_ROOT/nginx/ssl/dhparam.pem" ]; then
    log "DH parameters file exists"
else
    error "DH parameters file not found"
fi

# Test Nginx configuration
echo ""
echo "Nginx Configuration Validation:"
if [ -f "$PROJECT_ROOT/nginx/nginx.conf" ]; then
    log "Nginx configuration file exists"
    
    # Check for security headers
    local security_headers=("Strict-Transport-Security" "X-Frame-Options" "X-Content-Type-Options" "Content-Security-Policy")
    for header in "${security_headers[@]}"; do
        if grep -q "$header" "$PROJECT_ROOT/nginx/nginx.conf"; then
            log "Nginx configured with $header"
        else
            warn "Nginx missing $header configuration"
        fi
    done
    
    # Check TLS configuration
    if grep -q "TLSv1.2 TLSv1.3" "$PROJECT_ROOT/nginx/nginx.conf"; then
        log "Nginx configured with secure TLS protocols"
    else
        warn "Nginx TLS configuration may be insecure"
    fi
    
    # Check rate limiting
    if grep -q "limit_req_zone" "$PROJECT_ROOT/nginx/nginx.conf"; then
        log "Nginx rate limiting configured"
    else
        warn "Nginx rate limiting not configured"
    fi
else
    error "Nginx configuration file not found"
fi

# Test API Gateway files
echo ""
echo "API Gateway Security Validation:"
local api_dir="$PROJECT_ROOT/services/api-gateway"

if [ -f "$api_dir/package.json" ]; then
    log "API Gateway package.json exists"
    
    # Check for security dependencies
    if grep -q "helmet" "$api_dir/package.json"; then
        log "Helmet security middleware included"
    else
        warn "Helmet security middleware not included"
    fi
    
    if grep -q "express-rate-limit" "$api_dir/package.json"; then
        log "Rate limiting dependency included"
    else
        warn "Rate limiting dependency not included"
    fi
    
    if grep -q "argon2" "$api_dir/package.json"; then
        log "Argon2 password hashing included"
    else
        warn "Secure password hashing not included"
    fi
else
    error "API Gateway package.json not found"
fi

# Check middleware files
local middleware_files=("auth.js" "security.js" "rateLimit.js")
for file in "${middleware_files[@]}"; do
    if [ -f "$api_dir/middleware/$file" ]; then
        log "Middleware file $file exists"
    else
        error "Middleware file $file not found"
    fi
done

# Check route files
if [ -f "$api_dir/routes/auth.js" ]; then
    log "Authentication routes exist"
    
    # Check for validation
    if grep -q "express-validator" "$api_dir/routes/auth.js"; then
        log "Input validation implemented in auth routes"
    else
        warn "Input validation may not be implemented"
    fi
else
    error "Authentication routes not found"
fi

# Test Docker configuration
echo ""
echo "Docker Security Configuration:"
if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
    log "Docker Compose configuration exists"
    
    # Check for non-standard ports
    if grep -q "5433:5432" "$PROJECT_ROOT/docker-compose.yml"; then
        log "PostgreSQL configured with non-standard port"
    else
        warn "PostgreSQL using standard port"
    fi
    
    if grep -q "6380:6379" "$PROJECT_ROOT/docker-compose.yml"; then
        log "Redis configured with non-standard port"
    else
        warn "Redis using standard port"
    fi
    
    # Check for environment variables
    if grep -q "POSTGRES_PASSWORD" "$PROJECT_ROOT/docker-compose.yml"; then
        log "Database password configured via environment"
    else
        error "Database password not configured"
    fi
    
    # Check for resource limits
    if grep -q "deploy:" "$PROJECT_ROOT/docker-compose.yml"; then
        log "Container resource limits configured"
    else
        warn "Container resource limits not configured"
    fi
else
    error "Docker Compose configuration not found"
fi

# Test environment configuration
echo ""
echo "Environment Configuration:"
if [ -f "$api_dir/.env.example" ]; then
    log "Environment configuration template exists"
    
    if grep -q "JWT_SECRET" "$api_dir/.env.example"; then
        log "JWT configuration template present"
    else
        warn "JWT configuration template missing"
    fi
    
    if grep -q "RATE_LIMIT" "$api_dir/.env.example"; then
        log "Rate limiting configuration template present"
    else
        warn "Rate limiting configuration template missing"
    fi
else
    warn "Environment configuration template not found"
fi

# Summary
echo ""
echo "======================================"
echo "Security Configuration Test Summary"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

local total=$((PASSED + WARNINGS + FAILED))
local score=$((PASSED * 100 / total))

echo ""
echo "Security Score: $score%"

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🔒 Excellent! All security configurations are in place.${NC}"
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}🔐 Good security setup with some recommendations.${NC}"
    exit 0
elif [ $score -ge 70 ]; then
    echo -e "${YELLOW}⚠ Moderate security. Address failures.${NC}"
    exit 1
else
    echo -e "${RED}🚨 Poor security setup. Immediate attention required.${NC}"
    exit 1
fi