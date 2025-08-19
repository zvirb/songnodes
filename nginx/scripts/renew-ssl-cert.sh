#!/bin/bash

# SSL Certificate Renewal Script for MusicDB
# Handles certificate renewal, validation, and nginx reload

set -euo pipefail

# Configuration
SSL_DIR="/home/marku/Documents/programming/songnodes/nginx/ssl"
NGINX_CONTAINER="nginx-proxy"
BACKUP_DIR="$SSL_DIR/backup"
LOG_FILE="/var/log/ssl-renewal.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${GREEN}$message${NC}"
    echo "$message" >> "$LOG_FILE" 2>/dev/null || true
}

warn() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1"
    echo -e "${YELLOW}$message${NC}"
    echo "$message" >> "$LOG_FILE" 2>/dev/null || true
}

error() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1"
    echo -e "${RED}$message${NC}"
    echo "$message" >> "$LOG_FILE" 2>/dev/null || true
    exit 1
}

# Check if certificate exists
check_certificate_exists() {
    local cert_file="$SSL_DIR/musicdb.crt"
    local key_file="$SSL_DIR/musicdb.key"
    
    if [ ! -f "$cert_file" ] || [ ! -f "$key_file" ]; then
        error "Certificate files not found. Run generate-ssl-cert.sh first."
    fi
}

# Check certificate expiration
check_certificate_expiration() {
    local cert_file="$SSL_DIR/musicdb.crt"
    local days_threshold=${1:-30}
    
    if [ ! -f "$cert_file" ]; then
        error "Certificate file not found: $cert_file"
    fi
    
    # Get expiration date
    local exp_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
    local exp_epoch=$(date -d "$exp_date" +%s)
    local current_epoch=$(date +%s)
    local days_until_expiry=$(( (exp_epoch - current_epoch) / 86400 ))
    
    log "Certificate expires in $days_until_expiry days"
    
    if [ $days_until_expiry -lt $days_threshold ]; then
        warn "Certificate expires in $days_until_expiry days (threshold: $days_threshold)"
        return 0  # Needs renewal
    else
        log "Certificate is valid for $days_until_expiry more days"
        return 1  # No renewal needed
    fi
}

# Backup existing certificates
backup_certificates() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/$timestamp"
    
    log "Creating certificate backup..."
    mkdir -p "$backup_path"
    
    # Copy existing certificates
    cp "$SSL_DIR"/*.{crt,key,pem} "$backup_path/" 2>/dev/null || true
    
    log "Certificates backed up to: $backup_path"
    
    # Cleanup old backups (keep last 5)
    find "$BACKUP_DIR" -type d -name "*_*" | sort -r | tail -n +6 | xargs rm -rf 2>/dev/null || true
}

# Validate certificate and key
validate_certificate() {
    local cert_file="$SSL_DIR/musicdb.crt"
    local key_file="$SSL_DIR/musicdb.key"
    
    log "Validating certificate and key..."
    
    # Check if certificate and key match
    local cert_hash=$(openssl x509 -noout -modulus -in "$cert_file" | openssl md5)
    local key_hash=$(openssl rsa -noout -modulus -in "$key_file" | openssl md5)
    
    if [ "$cert_hash" != "$key_hash" ]; then
        error "Certificate and key do not match!"
    fi
    
    # Check certificate validity
    if ! openssl x509 -checkend 86400 -noout -in "$cert_file"; then
        error "Certificate is expired or expires within 24 hours"
    fi
    
    # Check certificate chain
    local chain_file="$SSL_DIR/musicdb-chain.crt"
    if [ -f "$chain_file" ]; then
        if ! openssl verify -CAfile "$SSL_DIR/ca.crt" "$chain_file"; then
            warn "Certificate chain validation failed"
        else
            log "Certificate chain is valid"
        fi
    fi
    
    log "Certificate validation successful"
}

# Test nginx configuration
test_nginx_config() {
    log "Testing nginx configuration..."
    
    if command -v docker &> /dev/null; then
        if docker ps --format "table {{.Names}}" | grep -q "$NGINX_CONTAINER"; then
            if docker exec "$NGINX_CONTAINER" nginx -t; then
                log "Nginx configuration test passed"
                return 0
            else
                error "Nginx configuration test failed"
            fi
        else
            warn "Nginx container not running, skipping configuration test"
            return 0
        fi
    else
        if command -v nginx &> /dev/null; then
            if nginx -t; then
                log "Nginx configuration test passed"
                return 0
            else
                error "Nginx configuration test failed"
            fi
        else
            warn "Nginx not found, skipping configuration test"
            return 0
        fi
    fi
}

# Reload nginx
reload_nginx() {
    log "Reloading nginx configuration..."
    
    if command -v docker &> /dev/null; then
        if docker ps --format "table {{.Names}}" | grep -q "$NGINX_CONTAINER"; then
            if docker exec "$NGINX_CONTAINER" nginx -s reload; then
                log "Nginx reloaded successfully"
                return 0
            else
                error "Failed to reload nginx"
            fi
        else
            warn "Nginx container not running, cannot reload"
            return 1
        fi
    else
        if command -v nginx &> /dev/null; then
            if nginx -s reload; then
                log "Nginx reloaded successfully"
                return 0
            else
                error "Failed to reload nginx"
            fi
        else
            warn "Nginx not found, cannot reload"
            return 1
        fi
    fi
}

# Renew certificate using Let's Encrypt (if available)
renew_letsencrypt() {
    log "Attempting Let's Encrypt renewal..."
    
    if command -v certbot &> /dev/null; then
        if certbot renew --dry-run; then
            log "Let's Encrypt dry run successful"
            if certbot renew; then
                log "Let's Encrypt renewal successful"
                
                # Copy certificates to our SSL directory
                local le_dir="/etc/letsencrypt/live/musicdb.local"
                if [ -d "$le_dir" ]; then
                    cp "$le_dir/fullchain.pem" "$SSL_DIR/musicdb.crt"
                    cp "$le_dir/privkey.pem" "$SSL_DIR/musicdb.key"
                    cp "$le_dir/chain.pem" "$SSL_DIR/musicdb-chain.crt"
                    log "Let's Encrypt certificates copied"
                fi
                
                return 0
            else
                error "Let's Encrypt renewal failed"
            fi
        else
            error "Let's Encrypt dry run failed"
        fi
    else
        warn "Certbot not found, cannot use Let's Encrypt"
        return 1
    fi
}

# Renew self-signed certificate
renew_selfsigned() {
    log "Renewing self-signed certificate..."
    
    local script_dir="$(dirname "$0")"
    local gen_script="$script_dir/generate-ssl-cert.sh"
    
    if [ -f "$gen_script" ]; then
        # Backup current certificates
        backup_certificates
        
        # Generate new certificates
        "$gen_script" ca
        
        log "Self-signed certificate renewed successfully"
        return 0
    else
        error "Certificate generation script not found: $gen_script"
    fi
}

# Send notification (webhook, email, etc.)
send_notification() {
    local status="$1"
    local message="$2"
    
    # Webhook notification
    if [ -n "${WEBHOOK_URL:-}" ]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"status\":\"$status\",\"message\":\"$message\",\"service\":\"musicdb-ssl\"}" \
            2>/dev/null || warn "Failed to send webhook notification"
    fi
    
    # Log notification
    log "NOTIFICATION: $status - $message"
}

# Health check after renewal
health_check() {
    log "Performing health check..."
    
    local health_url="https://localhost:8443/health"
    
    # Wait for nginx to fully reload
    sleep 5
    
    if curl -k -f "$health_url" -o /dev/null -s; then
        log "Health check passed - HTTPS endpoint accessible"
        return 0
    else
        error "Health check failed - HTTPS endpoint not accessible"
    fi
}

# Main renewal function
main() {
    local force_renewal="${1:-false}"
    local days_threshold="${2:-30}"
    
    log "Starting SSL certificate renewal check"
    
    # Ensure backup directory exists
    mkdir -p "$BACKUP_DIR"
    
    check_certificate_exists
    
    # Check if renewal is needed
    if [ "$force_renewal" = "true" ] || check_certificate_expiration "$days_threshold"; then
        log "Certificate renewal required"
        
        # Try Let's Encrypt first, fallback to self-signed
        if ! renew_letsencrypt; then
            renew_selfsigned
        fi
        
        # Validate new certificate
        validate_certificate
        
        # Test nginx configuration
        test_nginx_config
        
        # Reload nginx
        if reload_nginx; then
            # Health check
            if health_check; then
                send_notification "success" "SSL certificate renewed successfully"
                log "Certificate renewal completed successfully"
            else
                send_notification "warning" "Certificate renewed but health check failed"
                warn "Certificate renewed but health check failed"
            fi
        else
            send_notification "error" "Certificate renewed but nginx reload failed"
            error "Certificate renewed but nginx reload failed"
        fi
    else
        log "Certificate renewal not required"
        send_notification "info" "Certificate check completed - no renewal needed"
    fi
}

# Usage information
usage() {
    echo "Usage: $0 [force] [days_threshold]"
    echo "  force           - Force certificate renewal regardless of expiration"
    echo "  days_threshold  - Renew if certificate expires within N days (default: 30)"
    echo ""
    echo "Examples:"
    echo "  $0              # Check and renew if expires within 30 days"
    echo "  $0 force        # Force renewal immediately"
    echo "  $0 false 7      # Renew if expires within 7 days"
    echo ""
    echo "Environment variables:"
    echo "  WEBHOOK_URL     - Webhook URL for notifications"
}

# Handle command line arguments
if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
    exit 0
fi

# Run main function
main "${1:-false}" "${2:-30}"