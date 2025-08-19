#!/bin/bash

# Comprehensive Security Validation Script for MusicDB
# Validates all security implementations across the entire stack

set -euo pipefail

# Configuration
PROJECT_ROOT="/home/marku/Documents/programming/songnodes"
NGINX_CONTAINER="nginx-proxy"
API_GATEWAY_CONTAINER="api-gateway"
REDIS_CONTAINER="musicdb-redis"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✓ $1${NC}"
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠ $1${NC}"
    ((WARNING_CHECKS++))
    ((TOTAL_CHECKS++))
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ✗ $1${NC}"
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] ℹ $1${NC}"
}

section() {
    echo ""
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

# Check if required tools are available
check_prerequisites() {
    section "Checking Prerequisites"
    
    local tools=("docker" "openssl" "curl" "jq")
    for tool in "${tools[@]}"; do
        if command -v "$tool" &> /dev/null; then
            log "$tool is available"
        else
            error "$tool is not installed"
        fi
    done
}

# Validate SSL certificates
validate_ssl_certificates() {
    section "Validating SSL Certificates"
    
    local ssl_dir="$PROJECT_ROOT/nginx/ssl"
    
    # Check if certificates exist
    if [ -f "$ssl_dir/musicdb.crt" ] && [ -f "$ssl_dir/musicdb.key" ]; then
        log "SSL certificate files exist"
    else
        error "SSL certificate files missing"
        return
    fi
    
    # Check certificate validity
    if openssl x509 -checkend 86400 -noout -in "$ssl_dir/musicdb.crt"; then
        log "SSL certificate is valid and not expiring within 24 hours"
    else
        warn "SSL certificate expires within 24 hours or is invalid"
    fi
    
    # Check certificate and key match
    local cert_hash=$(openssl x509 -noout -modulus -in "$ssl_dir/musicdb.crt" | openssl md5)
    local key_hash=$(openssl rsa -noout -modulus -in "$ssl_dir/musicdb.key" | openssl md5)
    
    if [ "$cert_hash" = "$key_hash" ]; then
        log "Certificate and private key match"
    else
        error "Certificate and private key do not match"
    fi
    
    # Check DH parameters
    if [ -f "$ssl_dir/dhparam.pem" ]; then
        local dh_size=$(openssl dhparam -in "$ssl_dir/dhparam.pem" -text -noout | grep "prime" | awk '{print $3}')
        if [ "$dh_size" -ge 2048 ]; then
            log "DH parameters are strong ($dh_size bit)"
        else
            warn "DH parameters are weak ($dh_size bit)"
        fi
    else
        error "DH parameters file missing"
    fi
    
    # Check certificate SAN
    local san=$(openssl x509 -in "$ssl_dir/musicdb.crt" -text -noout | grep -A 10 "Subject Alternative Name")
    if [[ "$san" == *"musicdb.local"* ]] && [[ "$san" == *"api.musicdb.local"* ]]; then
        log "Certificate contains required SAN entries"
    else
        warn "Certificate may be missing required SAN entries"
    fi
}

# Validate Docker container security
validate_container_security() {
    section "Validating Container Security"
    
    # Check if containers are running
    local containers=("$NGINX_CONTAINER" "$API_GATEWAY_CONTAINER" "$REDIS_CONTAINER")
    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "$container"; then
            log "$container is running"
        else
            warn "$container is not running"
            continue
        fi
        
        # Check if container is running as non-root
        local user=$(docker exec "$container" whoami 2>/dev/null || echo "unknown")
        if [ "$user" != "root" ] && [ "$user" != "unknown" ]; then
            log "$container runs as non-root user ($user)"
        else
            warn "$container may be running as root or user check failed"
        fi
        
        # Check for security options
        local security_opts=$(docker inspect "$container" | jq -r '.[0].HostConfig.SecurityOpt[]? // empty' 2>/dev/null || echo "")
        if [ -n "$security_opts" ]; then
            log "$container has security options configured"
        else
            info "$container has no additional security options"
        fi
    done
}

# Validate Nginx configuration
validate_nginx_configuration() {
    section "Validating Nginx Configuration"
    
    # Test nginx configuration syntax
    if docker exec "$NGINX_CONTAINER" nginx -t 2>&1 | grep -q "syntax is ok"; then
        log "Nginx configuration syntax is valid"
    else
        error "Nginx configuration syntax error"
    fi
    
    # Check if security headers are configured
    local nginx_conf="$PROJECT_ROOT/nginx/nginx.conf"
    if [ -f "$nginx_conf" ]; then
        local security_headers=("Strict-Transport-Security" "X-Frame-Options" "X-Content-Type-Options" "Content-Security-Policy")
        for header in "${security_headers[@]}"; do
            if grep -q "$header" "$nginx_conf"; then
                log "Nginx configured with $header header"
            else
                warn "Nginx missing $header header configuration"
            fi
        done
        
        # Check SSL configuration
        if grep -q "ssl_protocols TLSv1.2 TLSv1.3" "$nginx_conf"; then
            log "Nginx configured with secure TLS protocols"
        else
            warn "Nginx TLS protocol configuration may be insecure"
        fi
        
        # Check rate limiting
        if grep -q "limit_req_zone" "$nginx_conf"; then
            log "Nginx configured with rate limiting"
        else
            warn "Nginx rate limiting not configured"
        fi
    else
        error "Nginx configuration file not found"
    fi
}

# Validate API Gateway security
validate_api_gateway_security() {
    section "Validating API Gateway Security"
    
    local api_dir="$PROJECT_ROOT/services/api-gateway"
    
    # Check if JWT middleware exists
    if [ -f "$api_dir/middleware/auth.js" ]; then
        log "JWT authentication middleware exists"
        
        # Check for secure JWT configuration
        if grep -q "argon2" "$api_dir/middleware/auth.js"; then
            log "Secure password hashing (Argon2) configured"
        else
            warn "Secure password hashing may not be configured"
        fi
        
        # Check for token blacklisting
        if grep -q "blacklist" "$api_dir/middleware/auth.js"; then
            log "Token blacklisting implemented"
        else
            warn "Token blacklisting not implemented"
        fi
    else
        error "JWT authentication middleware missing"
    fi
    
    # Check rate limiting middleware
    if [ -f "$api_dir/middleware/rateLimit.js" ]; then
        log "Rate limiting middleware exists"
    else
        error "Rate limiting middleware missing"
    fi
    
    # Check security middleware
    if [ -f "$api_dir/middleware/security.js" ]; then
        log "Security middleware exists"
        
        # Check for input sanitization
        if grep -q "sanitize" "$api_dir/middleware/security.js"; then
            log "Input sanitization implemented"
        else
            warn "Input sanitization may not be implemented"
        fi
        
        # Check for attack detection
        if grep -q "attackDetection" "$api_dir/middleware/security.js"; then
            log "Attack detection implemented"
        else
            warn "Attack detection not implemented"
        fi
    else
        error "Security middleware missing"
    fi
    
    # Check environment configuration
    if [ -f "$api_dir/.env.example" ]; then
        log "Environment configuration template exists"
    else
        warn "Environment configuration template missing"
    fi
}

# Validate Redis security
validate_redis_security() {
    section "Validating Redis Security"
    
    # Check Redis configuration
    if docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null | grep -q "PONG"; then
        log "Redis is accessible and responding"
    else
        error "Redis is not accessible"
        return
    fi
    
    # Check if Redis has authentication enabled
    local auth_test=$(docker exec "$REDIS_CONTAINER" redis-cli auth "wrongpassword" 2>&1 || echo "no_auth")
    if [[ "$auth_test" == *"WRONGPASS"* ]]; then
        log "Redis authentication is enabled"
    else
        warn "Redis authentication may not be enabled"
    fi
    
    # Check Redis memory settings
    local maxmemory=$(docker exec "$REDIS_CONTAINER" redis-cli config get maxmemory | tail -1)
    if [ "$maxmemory" != "0" ]; then
        log "Redis memory limit is configured"
    else
        warn "Redis memory limit not configured"
    fi
}

# Test security endpoints
test_security_endpoints() {
    section "Testing Security Endpoints"
    
    local api_url="http://localhost:8080"
    
    # Test health endpoint (should be accessible)
    if curl -s -f "$api_url/health" -o /dev/null; then
        log "Health endpoint is accessible"
    else
        error "Health endpoint is not accessible"
    fi
    
    # Test protected endpoint without auth (should fail)
    local protected_response=$(curl -s -o /dev/null -w "%{http_code}" "$api_url/api/v1/tracks" || echo "000")
    if [ "$protected_response" = "401" ]; then
        log "Protected endpoints require authentication"
    else
        warn "Protected endpoints may not require authentication (HTTP $protected_response)"
    fi
    
    # Test rate limiting (make multiple requests)
    info "Testing rate limiting with multiple requests..."
    local rate_limited=false
    for i in {1..15}; do
        local response=$(curl -s -o /dev/null -w "%{http_code}" "$api_url/health" || echo "000")
        if [ "$response" = "429" ]; then
            rate_limited=true
            break
        fi
        sleep 0.1
    done
    
    if [ "$rate_limited" = "true" ]; then
        log "Rate limiting is working"
    else
        warn "Rate limiting may not be working properly"
    fi
}

# Validate security configurations
validate_security_configurations() {
    section "Validating Security Configurations"
    
    # Check docker-compose.yml for security settings
    local compose_file="$PROJECT_ROOT/docker-compose.yml"
    if [ -f "$compose_file" ]; then
        # Check for non-standard ports
        if grep -q "5433:5432" "$compose_file"; then
            log "PostgreSQL configured with non-standard port"
        else
            warn "PostgreSQL may be using standard port"
        fi
        
        if grep -q "6380:6379" "$compose_file"; then
            log "Redis configured with non-standard port"
        else
            warn "Redis may be using standard port"
        fi
        
        # Check for environment variable security
        if grep -q "POSTGRES_PASSWORD" "$compose_file"; then
            log "Database password is configured via environment variable"
        else
            error "Database password configuration missing"
        fi
        
        # Check for resource limits
        if grep -q "deploy:" "$compose_file"; then
            log "Container resource limits are configured"
        else
            warn "Container resource limits not configured"
        fi
    else
        error "Docker Compose configuration not found"
    fi
}

# Security scan summary
generate_security_report() {
    section "Security Validation Summary"
    
    local score=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    
    echo ""
    echo "Security Score: $score% ($PASSED_CHECKS/$TOTAL_CHECKS checks passed)"
    echo ""
    echo "Results:"
    echo -e "  ${GREEN}✓ Passed: $PASSED_CHECKS${NC}"
    echo -e "  ${YELLOW}⚠ Warnings: $WARNING_CHECKS${NC}"
    echo -e "  ${RED}✗ Failed: $FAILED_CHECKS${NC}"
    echo ""
    
    if [ $FAILED_CHECKS -eq 0 ] && [ $WARNING_CHECKS -eq 0 ]; then
        echo -e "${GREEN}🔒 Excellent! All security checks passed.${NC}"
    elif [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${YELLOW}🔐 Good security posture with some recommendations.${NC}"
    elif [ $score -ge 70 ]; then
        echo -e "${YELLOW}⚠ Moderate security posture. Address failures and warnings.${NC}"
    else
        echo -e "${RED}🚨 Poor security posture. Immediate attention required.${NC}"
    fi
    
    echo ""
    echo "Security Recommendations:"
    echo "1. Review and fix any failed checks immediately"
    echo "2. Address warnings to improve security posture"
    echo "3. Regularly run this validation script"
    echo "4. Keep all dependencies up to date"
    echo "5. Monitor security logs for anomalies"
    echo "6. Implement regular security audits"
    echo ""
}

# Main execution
main() {
    echo "=========================================="
    echo "🔒 MusicDB Security Validation Suite 🔒"
    echo "=========================================="
    echo ""
    
    info "Starting comprehensive security validation..."
    info "Project root: $PROJECT_ROOT"
    echo ""
    
    check_prerequisites
    validate_ssl_certificates
    validate_container_security
    validate_nginx_configuration
    validate_api_gateway_security
    validate_redis_security
    test_security_endpoints
    validate_security_configurations
    
    generate_security_report
    
    # Exit with appropriate code
    if [ $FAILED_CHECKS -gt 0 ]; then
        exit 1
    elif [ $WARNING_CHECKS -gt 0 ]; then
        exit 2
    else
        exit 0
    fi
}

# Usage information
usage() {
    echo "Usage: $0"
    echo ""
    echo "Validates security configurations across the MusicDB stack including:"
    echo "  - SSL/TLS certificates and configuration"
    echo "  - Container security settings"
    echo "  - Nginx security configuration"
    echo "  - API Gateway authentication and authorization"
    echo "  - Redis security settings"
    echo "  - Security endpoint functionality"
    echo ""
    echo "Exit codes:"
    echo "  0 - All checks passed"
    echo "  1 - One or more checks failed"
    echo "  2 - Warnings present (no failures)"
}

# Handle command line arguments
if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
    exit 0
fi

# Run main function
main