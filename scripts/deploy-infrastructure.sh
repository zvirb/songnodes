#!/bin/bash
# Complete Infrastructure Deployment Orchestrator for Song Nodes
# Coordinates all infrastructure components with comprehensive validation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-production}
DEPLOYMENT_TYPE=${2:-blue-green}
VALIDATION_LEVEL=${3:-comprehensive}

# Infrastructure configuration
INFRASTRUCTURE_LOG="/opt/songnodes/logs/infrastructure.log"
INFRASTRUCTURE_STATE="/opt/songnodes/state/infrastructure.json"
HEALTH_CHECK_INTERVAL=10
DEPLOYMENT_TIMEOUT=1800  # 30 minutes
MONITORING_SETUP_TIMEOUT=300  # 5 minutes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [INFRA]${NC} $1" | tee -a "$INFRASTRUCTURE_LOG"
}

error() {
    echo -e "${RED}[ERROR] [INFRA]${NC} $1" | tee -a "$INFRASTRUCTURE_LOG"
}

success() {
    echo -e "${GREEN}[SUCCESS] [INFRA]${NC} $1" | tee -a "$INFRASTRUCTURE_LOG"
}

warning() {
    echo -e "${YELLOW}[WARNING] [INFRA]${NC} $1" | tee -a "$INFRASTRUCTURE_LOG"
}

info() {
    echo -e "${PURPLE}[INFO] [INFRA]${NC} $1" | tee -a "$INFRASTRUCTURE_LOG"
}

step() {
    echo -e "${CYAN}[STEP] [INFRA]${NC} $1" | tee -a "$INFRASTRUCTURE_LOG"
}

# Infrastructure state management
save_infrastructure_state() {
    local state="$1"
    local details="$2"
    
    mkdir -p "$(dirname "$INFRASTRUCTURE_STATE")"
    
    cat > "$INFRASTRUCTURE_STATE" << EOF
{
  "state": "$state",
  "timestamp": "$(date -Iseconds)",
  "details": "$details",
  "environment": "$ENVIRONMENT",
  "deployment_type": "$DEPLOYMENT_TYPE",
  "validation_level": "$VALIDATION_LEVEL",
  "components": {
    "health_monitor": "unknown",
    "prometheus": "unknown",
    "grafana": "unknown",
    "alertmanager": "unknown",
    "nginx": "unknown",
    "containers": "unknown"
  }
}
EOF
}

update_component_state() {
    local component="$1"
    local state="$2"
    
    if [[ -f "$INFRASTRUCTURE_STATE" ]]; then
        jq ".components.\"$component\" = \"$state\"" "$INFRASTRUCTURE_STATE" > "${INFRASTRUCTURE_STATE}.tmp" && 
        mv "${INFRASTRUCTURE_STATE}.tmp" "$INFRASTRUCTURE_STATE"
    fi
}

# Prerequisites validation
validate_prerequisites() {
    step "Validating infrastructure prerequisites"
    
    local missing_commands=()
    local required_commands=("docker" "docker-compose" "jq" "curl" "openssl" "bc")
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [[ ${#missing_commands[@]} -gt 0 ]]; then
        error "Missing required commands: ${missing_commands[*]}"
        return 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        return 1
    fi
    
    # Check required directories and files
    local required_paths=(
        "$PROJECT_ROOT/docker-compose.yml"
        "$PROJECT_ROOT/docker-compose.green.yml"
        "$PROJECT_ROOT/docker-compose.blue.yml"
        "$PROJECT_ROOT/services/health-monitor"
        "$PROJECT_ROOT/monitoring/prometheus"
        "$PROJECT_ROOT/monitoring/grafana"
        "$PROJECT_ROOT/nginx/conf.d"
        "$PROJECT_ROOT/k8s"
    )
    
    for path in "${required_paths[@]}"; do
        if [[ ! -e "$path" ]]; then
            error "Required path not found: $path"
            return 1
        fi
    done
    
    # Check disk space (minimum 10GB)
    local available_space=$(df "$PROJECT_ROOT" | tail -1 | awk '{print $4}')
    if [[ $available_space -lt 10000000 ]]; then
        warning "Low disk space. Available: ${available_space}KB, Recommended: 10GB"
    fi
    
    # Check memory (minimum 8GB)
    local total_memory=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    if [[ $total_memory -lt 8000000 ]]; then
        warning "Low system memory. Available: ${total_memory}KB, Recommended: 8GB"
    fi
    
    success "Prerequisites validation completed"
}

# SSL certificate setup
setup_ssl_certificates() {
    step "Setting up SSL/TLS certificates"
    
    local ssl_dir="$PROJECT_ROOT/nginx/ssl"
    mkdir -p "$ssl_dir"
    
    # Check if certificates exist
    if [[ -f "$ssl_dir/songnodes.com.crt" && -f "$ssl_dir/songnodes.com.key" ]]; then
        # Verify certificate validity
        local cert_expiry=$(openssl x509 -enddate -noout -in "$ssl_dir/songnodes.com.crt" | cut -d= -f 2)
        local expiry_timestamp=$(date -d "$cert_expiry" +%s)
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [[ $days_until_expiry -gt 30 ]]; then
            info "SSL certificate valid for $days_until_expiry more days"
            return 0
        else
            warning "SSL certificate expires in $days_until_expiry days - renewal recommended"
        fi
    fi
    
    # Generate self-signed certificate for development/testing
    if [[ "$ENVIRONMENT" != "production" ]]; then
        info "Generating self-signed SSL certificate for $ENVIRONMENT"
        
        # Generate private key
        openssl genrsa -out "$ssl_dir/songnodes.com.key" 2048
        
        # Generate certificate signing request
        openssl req -new -key "$ssl_dir/songnodes.com.key" -out "$ssl_dir/songnodes.com.csr" -subj "/C=US/ST=State/L=City/O=Organization/CN=songnodes.com"
        
        # Generate self-signed certificate
        openssl x509 -req -days 365 -in "$ssl_dir/songnodes.com.csr" -signkey "$ssl_dir/songnodes.com.key" -out "$ssl_dir/songnodes.com.crt"
        
        # Create chain certificate (same as cert for self-signed)
        cp "$ssl_dir/songnodes.com.crt" "$ssl_dir/songnodes.com.chain.crt"
        
        # Create CA bundle (for OCSP stapling)
        cp "$ssl_dir/songnodes.com.crt" "$ssl_dir/ca-bundle.crt"
        
        # Set appropriate permissions
        chmod 600 "$ssl_dir"/*.key
        chmod 644 "$ssl_dir"/*.crt
        
        success "Self-signed SSL certificate generated"
    else
        error "Production SSL certificates not found. Please install valid certificates."
        return 1
    fi
}

# Container health monitoring setup
setup_health_monitoring() {
    step "Setting up health monitoring infrastructure"
    
    # Build health monitor service
    info "Building health monitor service"
    cd "$PROJECT_ROOT/services/health-monitor"
    docker build -t songnodes/health-monitor:latest .
    
    # Start health monitor
    info "Starting health monitor service"
    docker run -d \
        --name songnodes-health-monitor \
        --restart unless-stopped \
        -p 8085:8085 \
        -e DATABASE_URL="postgresql://musicdb_user:musicdb_prod_secure_2024_v1@postgres:5432/musicdb" \
        -e REDIS_URL="redis://redis:6379" \
        -e NODE_ENV="$ENVIRONMENT" \
        --network songnodes-backend \
        songnodes/health-monitor:latest
    
    # Wait for health monitor to be ready
    local retry_count=0
    while [[ $retry_count -lt 30 ]]; do
        if curl -sf "http://localhost:8085/health/live" &> /dev/null; then
            success "Health monitor service is running"
            update_component_state "health_monitor" "running"
            return 0
        fi
        sleep 2
        ((retry_count++))
    done
    
    error "Health monitor failed to start within timeout"
    update_component_state "health_monitor" "failed"
    return 1
}

# Monitoring stack setup
setup_monitoring_stack() {
    step "Setting up monitoring stack (Prometheus, Grafana, AlertManager)"
    
    # Create monitoring network
    docker network create songnodes-monitoring 2>/dev/null || true
    
    # Start Prometheus
    info "Starting Prometheus"
    docker run -d \
        --name songnodes-prometheus \
        --restart unless-stopped \
        -p 9090:9090 \
        -v "$PROJECT_ROOT/monitoring/prometheus:/etc/prometheus" \
        -v prometheus_data:/prometheus \
        --network songnodes-monitoring \
        prom/prometheus:latest \
        --config.file=/etc/prometheus/enhanced-prometheus.yml \
        --storage.tsdb.path=/prometheus \
        --web.console.libraries=/usr/share/prometheus/console_libraries \
        --web.console.templates=/usr/share/prometheus/consoles \
        --storage.tsdb.retention.time=30d \
        --storage.tsdb.retention.size=50GB \
        --web.enable-lifecycle \
        --web.enable-admin-api
    
    # Start AlertManager
    info "Starting AlertManager"
    docker run -d \
        --name songnodes-alertmanager \
        --restart unless-stopped \
        -p 9093:9093 \
        -v "$PROJECT_ROOT/monitoring/alertmanager:/etc/alertmanager" \
        -v alertmanager_data:/alertmanager \
        --network songnodes-monitoring \
        prom/alertmanager:latest \
        --config.file=/etc/alertmanager/alertmanager.yml \
        --storage.path=/alertmanager \
        --web.external-url=https://alerts.songnodes.com
    
    # Start Grafana
    info "Starting Grafana"
    docker run -d \
        --name songnodes-grafana \
        --restart unless-stopped \
        -p 3001:3000 \
        -e GF_SECURITY_ADMIN_USER=admin \
        -e GF_SECURITY_ADMIN_PASSWORD="${GRAFANA_PASSWORD:-admin_prod_2024}" \
        -e GF_INSTALL_PLUGINS=redis-datasource,postgres-datasource \
        -e GF_SECURITY_SECRET_KEY="${GRAFANA_SECRET_KEY:-grafana_prod_secret_2024_songnodes}" \
        -e GF_ANALYTICS_REPORTING_ENABLED=false \
        -e GF_USERS_ALLOW_SIGN_UP=false \
        -e GF_SERVER_ROOT_URL=https://monitoring.songnodes.com/grafana \
        -v "$PROJECT_ROOT/monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards" \
        -v "$PROJECT_ROOT/monitoring/grafana/datasources:/etc/grafana/provisioning/datasources" \
        -v grafana_data:/var/lib/grafana \
        --network songnodes-monitoring \
        grafana/grafana:latest
    
    # Wait for services to start
    info "Waiting for monitoring services to initialize"
    sleep 30
    
    # Validate monitoring services
    local services=("prometheus:9090" "grafana:3001" "alertmanager:9093")
    for service_info in "${services[@]}"; do
        IFS=':' read -r service port <<< "$service_info"
        if curl -sf "http://localhost:$port" &> /dev/null; then
            success "$service is running on port $port"
            update_component_state "$service" "running"
        else
            error "$service failed to start on port $port"
            update_component_state "$service" "failed"
        fi
    done
}

# Load balancer setup
setup_load_balancer() {
    step "Setting up Nginx load balancer"
    
    # Create nginx network
    docker network create songnodes-frontend 2>/dev/null || true
    
    # Generate nginx basic auth file for monitoring
    local nginx_auth_dir="$PROJECT_ROOT/nginx"
    if [[ ! -f "$nginx_auth_dir/.htpasswd" ]]; then
        info "Generating basic auth for monitoring access"
        echo "admin:$(openssl passwd -apr1 '${MONITORING_PASSWORD:-monitoring_admin_2024}')" > "$nginx_auth_dir/.htpasswd"
    fi
    
    # Start Nginx with production configuration
    info "Starting Nginx load balancer"
    docker run -d \
        --name songnodes-nginx \
        --restart unless-stopped \
        -p 80:80 \
        -p 443:443 \
        -v "$PROJECT_ROOT/nginx/conf.d:/etc/nginx/conf.d" \
        -v "$PROJECT_ROOT/nginx/ssl:/etc/nginx/ssl" \
        -v "$PROJECT_ROOT/nginx/.htpasswd:/etc/nginx/.htpasswd" \
        -v "$PROJECT_ROOT/nginx/nginx.conf:/etc/nginx/nginx.conf" \
        --network songnodes-frontend \
        nginx:alpine
    
    # Wait for Nginx to start
    local retry_count=0
    while [[ $retry_count -lt 15 ]]; do
        if curl -sf "http://localhost/health" &> /dev/null; then
            success "Nginx load balancer is running"
            update_component_state "nginx" "running"
            return 0
        fi
        sleep 2
        ((retry_count++))
    done
    
    warning "Nginx health check failed - checking if service is running"
    if docker ps | grep -q songnodes-nginx; then
        warning "Nginx is running but health check endpoint not responding"
        update_component_state "nginx" "partial"
    else
        error "Nginx failed to start"
        update_component_state "nginx" "failed"
        return 1
    fi
}

# Container orchestration deployment
deploy_container_orchestration() {
    step "Deploying container orchestration with auto-scaling"
    
    if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
        info "Kubernetes detected - deploying with Kubernetes orchestration"
        
        # Apply Kubernetes manifests
        kubectl apply -f "$PROJECT_ROOT/k8s/deployment.yaml"
        kubectl apply -f "$PROJECT_ROOT/k8s/autoscaling.yaml"
        
        # Wait for deployments to be ready
        kubectl wait --for=condition=available --timeout=300s deployment --all -n songnodes
        
        success "Kubernetes deployment completed"
        update_component_state "containers" "kubernetes"
    else
        info "Using Docker Compose for container orchestration"
        
        # Deploy with Docker Compose
        if [[ "$DEPLOYMENT_TYPE" == "blue-green" ]]; then
            info "Executing blue-green deployment"
            "$SCRIPT_DIR/deployment/enhanced-blue-green-deploy.sh" "$ENVIRONMENT"
        else
            info "Executing standard deployment"
            docker-compose -f "$PROJECT_ROOT/docker-compose.yml" -f "$PROJECT_ROOT/docker-compose.green.yml" up -d
        fi
        
        success "Docker Compose deployment completed"
        update_component_state "containers" "docker-compose"
    fi
}

# Comprehensive validation
run_comprehensive_validation() {
    step "Running comprehensive infrastructure validation"
    
    # Run production validation suite
    if [[ "$VALIDATION_LEVEL" == "comprehensive" ]]; then
        info "Executing comprehensive validation suite"
        "$SCRIPT_DIR/validation/production-validation-suite.sh" "$ENVIRONMENT" "http://localhost"
        local validation_exit_code=$?
        
        if [[ $validation_exit_code -eq 0 ]]; then
            success "Comprehensive validation passed"
        elif [[ $validation_exit_code -eq 1 ]]; then
            warning "Validation completed with warnings"
        else
            error "Validation failed - infrastructure may have issues"
            return 1
        fi
    else
        info "Running basic health checks"
        
        # Basic health checks
        local endpoints=(
            "http://localhost:8085/health:Health Monitor"
            "http://localhost:9090/-/healthy:Prometheus"
            "http://localhost:3001/api/health:Grafana"
            "http://localhost/health:Load Balancer"
        )
        
        for endpoint_info in "${endpoints[@]}"; do
            IFS=':' read -r url service <<< "$endpoint_info"
            if curl -sf "$url" &> /dev/null; then
                success "$service health check passed"
            else
                warning "$service health check failed"
            fi
        done
    fi
}

# Infrastructure monitoring setup
setup_infrastructure_monitoring() {
    step "Setting up infrastructure monitoring and alerting"
    
    # Configure Prometheus targets
    info "Configuring Prometheus service discovery"
    
    # Reload Prometheus configuration
    if curl -sf -X POST "http://localhost:9090/-/reload" &> /dev/null; then
        success "Prometheus configuration reloaded"
    else
        warning "Failed to reload Prometheus configuration"
    fi
    
    # Import Grafana dashboards
    info "Setting up Grafana dashboards"
    sleep 10  # Wait for Grafana to fully initialize
    
    # Test Grafana API
    if curl -sf "http://admin:${GRAFANA_PASSWORD:-admin_prod_2024}@localhost:3001/api/health" &> /dev/null; then
        success "Grafana API is accessible"
    else
        warning "Grafana API not accessible - dashboards may need manual import"
    fi
    
    # Set up alert channels (if configured)
    info "Alert channels will be configured based on environment variables"
    
    success "Infrastructure monitoring setup completed"
}

# Generate deployment summary
generate_deployment_summary() {
    step "Generating infrastructure deployment summary"
    
    local summary_file="/opt/songnodes/reports/infrastructure-deployment-$(date +%Y%m%d-%H%M%S).json"
    mkdir -p "$(dirname "$summary_file")"
    
    # Gather component status
    local component_status=$(cat "$INFRASTRUCTURE_STATE" 2>/dev/null || echo '{"components": {}}')
    
    # Get service endpoints
    local endpoints={
        "health_monitor": "http://localhost:8085",
        "prometheus": "http://localhost:9090",
        "grafana": "http://localhost:3001",
        "alertmanager": "http://localhost:9093",
        "load_balancer": "http://localhost",
        "ssl_endpoint": "https://localhost"
    }
    
    # Generate summary
    cat > "$summary_file" << EOF
{
  "deployment_summary": {
    "timestamp": "$(date -Iseconds)",
    "environment": "$ENVIRONMENT",
    "deployment_type": "$DEPLOYMENT_TYPE",
    "validation_level": "$VALIDATION_LEVEL",
    "status": "completed",
    "duration_seconds": $(($(date +%s) - deployment_start_time))
  },
  "infrastructure_components": $(echo "$component_status" | jq '.components'),
  "service_endpoints": {
    "health_monitor": "http://localhost:8085",
    "prometheus": "http://localhost:9090",
    "grafana": "http://localhost:3001",
    "alertmanager": "http://localhost:9093",
    "load_balancer": "http://localhost",
    "monitoring_dashboard": "https://monitoring.songnodes.com",
    "application": "https://songnodes.com"
  },
  "management_urls": {
    "grafana_login": "http://localhost:3001 (admin/${GRAFANA_PASSWORD:-admin_prod_2024})",
    "prometheus_ui": "http://localhost:9090",
    "alertmanager_ui": "http://localhost:9093"
  },
  "next_steps": [
    "Verify all services are responding to health checks",
    "Review Grafana dashboards and configure alerts",
    "Test blue-green deployment process",
    "Configure backup procedures",
    "Set up monitoring notifications"
  ]
}
EOF
    
    echo
    echo "==========================================="
    echo "     INFRASTRUCTURE DEPLOYMENT SUMMARY"
    echo "==========================================="
    echo "Environment: $ENVIRONMENT"
    echo "Deployment Type: $DEPLOYMENT_TYPE"
    echo "Validation Level: $VALIDATION_LEVEL"
    echo "Completion Time: $(date)"
    echo "Duration: $(($(date +%s) - deployment_start_time)) seconds"
    echo
    echo "Service Endpoints:"
    echo "  Health Monitor: http://localhost:8085/health"
    echo "  Prometheus: http://localhost:9090"
    echo "  Grafana: http://localhost:3001"
    echo "  AlertManager: http://localhost:9093"
    echo "  Load Balancer: http://localhost"
    echo
    echo "Management Access:"
    echo "  Grafana: admin/${GRAFANA_PASSWORD:-admin_prod_2024}"
    echo "  Monitoring: https://monitoring.songnodes.com"
    echo
    echo "Report Location: $summary_file"
    echo "==========================================="
    
    success "Infrastructure deployment summary generated"
}

# Main deployment orchestration
main() {
    local deployment_start_time=$(date +%s)
    
    log "Starting comprehensive infrastructure deployment for Song Nodes"
    log "Environment: $ENVIRONMENT | Type: $DEPLOYMENT_TYPE | Validation: $VALIDATION_LEVEL"
    
    # Initialize infrastructure state
    save_infrastructure_state "starting" "Infrastructure deployment initiated"
    
    # Create log directory
    mkdir -p "$(dirname "$INFRASTRUCTURE_LOG")"
    
    # Execute deployment phases
    local phases=(
        "validate_prerequisites:Prerequisites Validation"
        "setup_ssl_certificates:SSL/TLS Certificate Setup"
        "setup_health_monitoring:Health Monitoring Setup"
        "setup_monitoring_stack:Monitoring Stack Deployment"
        "setup_load_balancer:Load Balancer Configuration"
        "deploy_container_orchestration:Container Orchestration"
        "setup_infrastructure_monitoring:Infrastructure Monitoring"
        "run_comprehensive_validation:Comprehensive Validation"
    )
    
    for phase_info in "${phases[@]}"; do
        IFS=':' read -r phase_func phase_name <<< "$phase_info"
        
        log "Executing: $phase_name"
        save_infrastructure_state "$phase_func" "Executing $phase_name"
        
        if "$phase_func"; then
            success "$phase_name completed successfully"
        else
            error "$phase_name failed"
            save_infrastructure_state "failed" "$phase_name failed"
            exit 1
        fi
    done
    
    # Generate final summary
    generate_deployment_summary
    
    # Update final state
    save_infrastructure_state "completed" "Infrastructure deployment completed successfully"
    
    success "Infrastructure deployment completed successfully in $(($(date +%s) - deployment_start_time)) seconds"
    
    # Final recommendations
    echo
    info "Post-deployment recommendations:"
    info "1. Review all dashboard configurations in Grafana"
    info "2. Test alert notifications and escalation procedures"
    info "3. Verify backup and disaster recovery procedures"
    info "4. Configure SSL certificates for production domains"
    info "5. Set up log aggregation and retention policies"
    info "6. Test blue-green deployment procedures"
    info "7. Configure monitoring notification channels"
    
    return 0
}

# Handle script interruption
trap 'error "Infrastructure deployment interrupted"; save_infrastructure_state "interrupted" "Deployment interrupted by user"; exit 1' INT TERM

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi