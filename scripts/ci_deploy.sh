#!/bin/bash
################################################################################
# CI/CD Integration Script for SongNodes Enrichment Deployment
#
# Designed for use with:
# - GitHub Actions
# - GitLab CI
# - Jenkins
# - Any CI/CD system supporting bash
#
# Features:
# - Structured JSON logging for CI/CD parsers
# - Exit codes for CI/CD success/failure detection
# - Notification integration (Slack, Discord, etc.)
# - Prometheus push gateway support
# - Artifact upload support
#
# Usage: ./scripts/ci_deploy.sh [--environment <env>] [--notify]
# Environment variables:
#   CI_ENVIRONMENT      - Deployment environment (dev/staging/production)
#   SLACK_WEBHOOK_URL   - Slack webhook for notifications
#   DISCORD_WEBHOOK_URL - Discord webhook for notifications
#   PROMETHEUS_PUSHGATEWAY - Prometheus push gateway URL
#
# Exit codes:
#   0 - Deployment succeeded
#   1 - Deployment failed
#   2 - Rollback failed (critical)
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# CI/CD Configuration
CI_ENVIRONMENT="${CI_ENVIRONMENT:-staging}"
ENABLE_NOTIFICATIONS=false
DEPLOYMENT_ID="${CI_BUILD_ID:-$(date +%s)}"
DEPLOYMENT_START_TIME=$(date +%s)

################################################################################
# Structured logging for CI/CD
################################################################################

log_json() {
    local level="$1"
    local message="$2"
    local data="${3:-{}}"

    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    jq -n \
        --arg level "$level" \
        --arg message "$message" \
        --arg timestamp "$timestamp" \
        --arg deployment_id "$DEPLOYMENT_ID" \
        --arg environment "$CI_ENVIRONMENT" \
        --argjson data "$data" \
        '{level: $level, message: $message, timestamp: $timestamp, deployment_id: $deployment_id, environment: $environment, data: $data}'
}

log_ci_info() {
    log_json "info" "$1" "${2:-{}}"
}

log_ci_error() {
    log_json "error" "$1" "${2:-{}}"
}

log_ci_warn() {
    log_json "warn" "$1" "${2:-{}}"
}

################################################################################
# Parse arguments
################################################################################

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment) CI_ENVIRONMENT="$2"; shift 2 ;;
            --notify) ENABLE_NOTIFICATIONS=true; shift ;;
            -h|--help)
                echo "Usage: $0 [--environment <env>] [--notify]"
                exit 0 ;;
            *) log_ci_error "Unknown option: $1"; exit 1 ;;
        esac
    done
}

################################################################################
# Notifications
################################################################################

send_slack_notification() {
    local status="$1"
    local message="$2"

    if [ -z "${SLACK_WEBHOOK_URL:-}" ]; then
        return 0
    fi

    local color="good"
    [ "$status" = "failure" ] && color="danger"
    [ "$status" = "warning" ] && color="warning"

    local payload=$(jq -n \
        --arg text "SongNodes Enrichment Deployment" \
        --arg color "$color" \
        --arg message "$message" \
        --arg environment "$CI_ENVIRONMENT" \
        --arg deployment_id "$DEPLOYMENT_ID" \
        '{
            attachments: [{
                color: $color,
                title: $text,
                fields: [
                    {title: "Status", value: $message, short: true},
                    {title: "Environment", value: $environment, short: true},
                    {title: "Deployment ID", value: $deployment_id, short: false}
                ]
            }]
        }')

    curl -s -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "$payload" || true
}

send_discord_notification() {
    local status="$1"
    local message="$2"

    if [ -z "${DISCORD_WEBHOOK_URL:-}" ]; then
        return 0
    fi

    local color=5763719  # Green
    [ "$status" = "failure" ] && color=15548997  # Red
    [ "$status" = "warning" ] && color=16776960  # Yellow

    local payload=$(jq -n \
        --arg message "$message" \
        --arg environment "$CI_ENVIRONMENT" \
        --argjson color "$color" \
        '{
            embeds: [{
                title: "SongNodes Enrichment Deployment",
                description: $message,
                color: $color,
                fields: [
                    {name: "Environment", value: $environment, inline: true}
                ]
            }]
        }')

    curl -s -X POST "$DISCORD_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "$payload" || true
}

send_notification() {
    local status="$1"
    local message="$2"

    if [ "$ENABLE_NOTIFICATIONS" = true ]; then
        send_slack_notification "$status" "$message"
        send_discord_notification "$status" "$message"
    fi
}

################################################################################
# Prometheus metrics
################################################################################

push_prometheus_metric() {
    local metric_name="$1"
    local metric_value="$2"
    local metric_type="${3:-gauge}"

    if [ -z "${PROMETHEUS_PUSHGATEWAY:-}" ]; then
        return 0
    fi

    local payload="# TYPE $metric_name $metric_type
$metric_name{environment=\"$CI_ENVIRONMENT\",deployment_id=\"$DEPLOYMENT_ID\"} $metric_value"

    curl -s -X POST "${PROMETHEUS_PUSHGATEWAY}/metrics/job/songnodes_deployment" \
        --data-binary "$payload" || true
}

################################################################################
# CI/CD deployment flow
################################################################################

ci_pre_deployment() {
    log_ci_info "Starting pre-deployment checks"

    send_notification "info" "Deployment started for $CI_ENVIRONMENT"

    # Validate environment
    if ! "$SCRIPT_DIR/validate_environment.sh"; then
        log_ci_error "Environment validation failed"
        return 1
    fi

    log_ci_info "Pre-deployment checks passed"
    return 0
}

ci_deploy() {
    log_ci_info "Starting deployment"

    local deploy_opts="--no-rollback"  # Manual rollback in CI

    # Run deployment
    if ! "$SCRIPT_DIR/deploy_enrichment_upgrades.sh" $deploy_opts; then
        log_ci_error "Deployment failed"
        return 1
    fi

    log_ci_info "Deployment completed"
    return 0
}

ci_post_deployment() {
    log_ci_info "Running post-deployment verification"

    # Final health check
    if ! "$SCRIPT_DIR/comprehensive_health_check.sh" --wait --timeout 60; then
        log_ci_error "Post-deployment health check failed"
        return 1
    fi

    # Record metrics
    local deployment_end_time=$(date +%s)
    local deployment_duration=$((deployment_end_time - DEPLOYMENT_START_TIME))

    push_prometheus_metric "songnodes_deployment_duration_seconds" "$deployment_duration" "gauge"
    push_prometheus_metric "songnodes_deployment_success" "1" "gauge"

    log_ci_info "Post-deployment verification passed" "{\"duration_seconds\": $deployment_duration}"
    return 0
}

ci_handle_failure() {
    local exit_code=$1

    log_ci_error "Deployment failed with exit code: $exit_code"

    # Record failure metric
    push_prometheus_metric "songnodes_deployment_success" "0" "gauge"

    # Notify
    send_notification "failure" "Deployment failed in $CI_ENVIRONMENT (exit code: $exit_code)"

    # Attempt rollback
    log_ci_info "Attempting automatic rollback"

    if "$SCRIPT_DIR/rollback_deployment.sh"; then
        log_ci_info "Rollback succeeded"
        send_notification "warning" "Deployment rolled back successfully"
        exit 1
    else
        log_ci_error "Rollback failed - manual intervention required"
        send_notification "failure" "CRITICAL: Rollback failed - manual intervention required"
        exit 2
    fi
}

################################################################################
# Artifact collection
################################################################################

collect_deployment_artifacts() {
    log_ci_info "Collecting deployment artifacts"

    local artifact_dir="${CI_ARTIFACT_DIR:-$PROJECT_ROOT/artifacts}"
    mkdir -p "$artifact_dir"

    # Collect logs
    if [ -d "$PROJECT_ROOT/logs" ]; then
        cp -r "$PROJECT_ROOT/logs" "$artifact_dir/" || true
    fi

    # Export docker compose logs
    docker compose logs > "$artifact_dir/docker-compose-logs.txt" 2>&1 || true

    # Export service health
    "$SCRIPT_DIR/comprehensive_health_check.sh" > "$artifact_dir/health-check.txt" 2>&1 || true

    # Database migration status
    docker exec postgres psql -U musicdb_user -d musicdb -c \
        "SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;" \
        > "$artifact_dir/migration-status.txt" 2>&1 || true

    log_ci_info "Artifacts collected to: $artifact_dir"
}

################################################################################
# Main execution
################################################################################

main() {
    parse_args "$@"

    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║  SongNodes Enrichment - CI/CD Deployment                      ║"
    echo "║  Environment: $CI_ENVIRONMENT                                          ║"
    echo "║  Deployment ID: $DEPLOYMENT_ID                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""

    log_ci_info "Deployment initiated" "{\"environment\": \"$CI_ENVIRONMENT\", \"deployment_id\": \"$DEPLOYMENT_ID\"}"

    # Execute deployment pipeline
    ci_pre_deployment || ci_handle_failure $?
    ci_deploy || ci_handle_failure $?
    ci_post_deployment || ci_handle_failure $?

    # Collect artifacts
    collect_deployment_artifacts

    # Success notification
    local deployment_end_time=$(date +%s)
    local deployment_duration=$((deployment_end_time - DEPLOYMENT_START_TIME))
    local minutes=$((deployment_duration / 60))
    local seconds=$((deployment_duration % 60))

    send_notification "success" "Deployment succeeded in ${minutes}m ${seconds}s"

    log_ci_info "Deployment succeeded" "{\"duration_seconds\": $deployment_duration}"

    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║  Deployment completed successfully!                           ║"
    echo "║  Duration: ${minutes}m ${seconds}s                                         ║"
    echo "╚════════════════════════════════════════════════════════════════╝"

    exit 0
}

main "$@"
