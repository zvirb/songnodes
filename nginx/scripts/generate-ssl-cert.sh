#!/bin/bash

# SSL Certificate Generation Script for MusicDB
# Generates self-signed certificates for development and sets up CA for production

set -euo pipefail

# Configuration
SSL_DIR="/home/marku/Documents/programming/songnodes/nginx/ssl"
DOMAIN="musicdb.local"
COUNTRY="US"
STATE="CA"
CITY="San Francisco"
ORG="MusicDB"
OU="Development"
EMAIL="admin@musicdb.local"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if OpenSSL is installed
check_openssl() {
    if ! command -v openssl &> /dev/null; then
        error "OpenSSL is not installed. Please install it first."
    fi
    log "OpenSSL found: $(openssl version)"
}

# Create SSL directory
create_ssl_directory() {
    if [ ! -d "$SSL_DIR" ]; then
        log "Creating SSL directory: $SSL_DIR"
        mkdir -p "$SSL_DIR"
    fi
    
    # Set proper permissions
    chmod 700 "$SSL_DIR"
    log "SSL directory created with secure permissions"
}

# Generate DH Parameters for Perfect Forward Secrecy
generate_dhparam() {
    local dhparam_file="$SSL_DIR/dhparam.pem"
    
    if [ -f "$dhparam_file" ]; then
        warn "DH parameters already exist. Skipping generation."
        return
    fi
    
    log "Generating DH parameters (this may take a while)..."
    openssl dhparam -out "$dhparam_file" 2048
    chmod 600 "$dhparam_file"
    log "DH parameters generated successfully"
}

# Generate CA Certificate
generate_ca_cert() {
    local ca_key="$SSL_DIR/ca.key"
    local ca_cert="$SSL_DIR/ca.crt"
    
    if [ -f "$ca_cert" ]; then
        warn "CA certificate already exists. Skipping generation."
        return
    fi
    
    log "Generating CA private key..."
    openssl genrsa -out "$ca_key" 4096
    chmod 600 "$ca_key"
    
    log "Generating CA certificate..."
    openssl req -new -x509 -key "$ca_key" -sha256 -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG CA/OU=$OU/CN=$ORG Root CA/emailAddress=$EMAIL" -days 3650 -out "$ca_cert"
    chmod 644 "$ca_cert"
    
    log "CA certificate generated successfully"
}

# Generate Server Certificate
generate_server_cert() {
    local server_key="$SSL_DIR/musicdb.key"
    local server_csr="$SSL_DIR/musicdb.csr"
    local server_cert="$SSL_DIR/musicdb.crt"
    local ca_key="$SSL_DIR/ca.key"
    local ca_cert="$SSL_DIR/ca.crt"
    local server_conf="$SSL_DIR/server.conf"
    
    if [ -f "$server_cert" ]; then
        warn "Server certificate already exists. Skipping generation."
        return
    fi
    
    # Create server configuration file
    cat > "$server_conf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=$COUNTRY
ST=$STATE
L=$CITY
O=$ORG
OU=$OU
CN=$DOMAIN
emailAddress=$EMAIL

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = api.$DOMAIN
DNS.3 = localhost
DNS.4 = *.musicdb.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
    
    log "Generating server private key..."
    openssl genrsa -out "$server_key" 2048
    chmod 600 "$server_key"
    
    log "Generating server certificate signing request..."
    openssl req -new -key "$server_key" -out "$server_csr" -config "$server_conf"
    
    log "Generating server certificate..."
    openssl x509 -req -in "$server_csr" -CA "$ca_cert" -CAkey "$ca_key" -CAcreateserial -out "$server_cert" -days 365 -sha256 -extensions v3_req -extfile "$server_conf"
    chmod 644 "$server_cert"
    
    # Create certificate chain
    cat "$server_cert" "$ca_cert" > "$SSL_DIR/musicdb-chain.crt"
    
    # Clean up CSR and config files
    rm -f "$server_csr" "$server_conf"
    
    log "Server certificate generated successfully"
}

# Generate self-signed certificate (alternative method for development)
generate_self_signed() {
    local cert_file="$SSL_DIR/musicdb-selfsigned.crt"
    local key_file="$SSL_DIR/musicdb-selfsigned.key"
    local config_file="$SSL_DIR/selfsigned.conf"
    
    if [ -f "$cert_file" ]; then
        warn "Self-signed certificate already exists. Skipping generation."
        return
    fi
    
    cat > "$config_file" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=$COUNTRY
ST=$STATE
L=$CITY
O=$ORG
OU=$OU
CN=$DOMAIN
emailAddress=$EMAIL

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = api.$DOMAIN
DNS.3 = localhost
DNS.4 = *.musicdb.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
    
    log "Generating self-signed certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$key_file" \
        -out "$cert_file" \
        -config "$config_file" \
        -extensions v3_req
    
    chmod 600 "$key_file"
    chmod 644 "$cert_file"
    
    rm -f "$config_file"
    
    log "Self-signed certificate generated successfully"
}

# Verify certificates
verify_certificates() {
    local cert_file="$SSL_DIR/musicdb.crt"
    local key_file="$SSL_DIR/musicdb.key"
    
    if [ ! -f "$cert_file" ] || [ ! -f "$key_file" ]; then
        warn "Certificates not found for verification"
        return
    fi
    
    log "Verifying certificate and key match..."
    cert_hash=$(openssl x509 -noout -modulus -in "$cert_file" | openssl md5)
    key_hash=$(openssl rsa -noout -modulus -in "$key_file" | openssl md5)
    
    if [ "$cert_hash" = "$key_hash" ]; then
        log "Certificate and key match successfully"
    else
        error "Certificate and key do not match!"
    fi
    
    log "Certificate details:"
    openssl x509 -in "$cert_file" -text -noout | grep -A 2 "Subject:"
    openssl x509 -in "$cert_file" -text -noout | grep -A 10 "Subject Alternative Name:"
    
    log "Certificate expires on:"
    openssl x509 -in "$cert_file" -noout -dates | grep "notAfter"
}

# Create certificate info file
create_cert_info() {
    local info_file="$SSL_DIR/certificate-info.txt"
    local cert_file="$SSL_DIR/musicdb.crt"
    
    if [ ! -f "$cert_file" ]; then
        return
    fi
    
    cat > "$info_file" << EOF
SSL Certificate Information for MusicDB
=====================================

Generated: $(date)
Domain: $DOMAIN
Certificate File: musicdb.crt
Private Key File: musicdb.key
Certificate Chain: musicdb-chain.crt
DH Parameters: dhparam.pem

Certificate Details:
$(openssl x509 -in "$cert_file" -text -noout | head -20)

Expiration Date:
$(openssl x509 -in "$cert_file" -noout -dates | grep "notAfter")

To trust this certificate in development:
1. Import ca.crt into your browser's trusted root certificates
2. Add the following to your /etc/hosts file:
   127.0.0.1 musicdb.local
   127.0.0.1 api.musicdb.local

For production deployment:
1. Replace these certificates with ones signed by a trusted CA
2. Ensure proper certificate chain is configured
3. Test SSL configuration with: openssl s_client -connect domain:443

Security Notes:
- Private keys have 600 permissions (readable only by owner)
- Certificates have 644 permissions (readable by all)
- DH parameters use 2048-bit key for forward secrecy
- Certificate includes Subject Alternative Names for flexibility
EOF
    
    log "Certificate information saved to $info_file"
}

# Main execution
main() {
    local cert_type="${1:-ca}"
    
    log "Starting SSL certificate generation for MusicDB"
    log "Certificate type: $cert_type"
    
    check_openssl
    create_ssl_directory
    generate_dhparam
    
    case "$cert_type" in
        "ca")
            generate_ca_cert
            generate_server_cert
            ;;
        "selfsigned")
            generate_self_signed
            ;;
        *)
            error "Invalid certificate type. Use 'ca' or 'selfsigned'"
            ;;
    esac
    
    verify_certificates
    create_cert_info
    
    log "SSL certificate generation completed successfully!"
    log "Certificates are located in: $SSL_DIR"
    
    if [ "$cert_type" = "ca" ]; then
        log "For development, import ca.crt into your browser's trusted root certificates"
    else
        warn "Self-signed certificate generated. Browser will show security warnings."
    fi
    
    log "Add to /etc/hosts: 127.0.0.1 musicdb.local api.musicdb.local"
}

# Script usage
usage() {
    echo "Usage: $0 [ca|selfsigned]"
    echo "  ca          - Generate CA certificate and server certificate (default)"
    echo "  selfsigned  - Generate self-signed certificate"
    echo ""
    echo "Examples:"
    echo "  $0 ca         # Generate CA and server certificates"
    echo "  $0 selfsigned # Generate self-signed certificate"
}

# Handle command line arguments
if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
    exit 0
fi

# Run main function
main "${1:-ca}"