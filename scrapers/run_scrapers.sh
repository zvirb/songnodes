#!/bin/bash

# SongNodes Scraper Stack Runner
# Usage: ./run_scrapers.sh [command]

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_color() {
    echo -e "${2}${1}${NC}"
}

show_usage() {
    print_color "SongNodes Scraper Runner" "$BLUE"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    cat <<USAGE
Commands:
  build         Build the Docker image
  start         Start Redis, Postgres, and scraper services
  stop          Stop all services
  restart       Restart all services
  status        Show service status
  logs          Tail combined logs
  shell         Open a shell in the scraper container
  run-spider    Run a specific spider (pass name)
  run-all       Run all spiders sequentially
  clean         Stop services and remove volumes
  test          Run pytest suite

Monitoring:
  monitor       Show monitoring dashboard (add 'detailed' for verbose)
  monitor-live  Live monitoring (Ctrl+C to exit)
  stats         Print scraping statistics
  health        Run system health check
USAGE
    echo ""
    echo "Examples:"
    echo "  $0 build"
    echo "  $0 start"
    echo "  $0 run-spider 1001tracklists"
    echo "  $0 run-all"
    echo "  $0 monitor-live"
}

compose="docker compose -f docker-compose.yml"
container="scrapers"

build_image() {
    print_color "Building scraper Docker image..." "$BLUE"
    $compose build
    print_color "Build complete" "$GREEN"
}

start_services() {
    print_color "Starting Redis and Postgres..." "$BLUE"
    $compose up -d redis postgres
    print_color "Waiting for services to become healthy..." "$YELLOW"
    sleep 5
    print_color "Starting scraper service..." "$BLUE"
    $compose up -d scrapers adminer
    $compose ps
}

stop_services() {
    print_color "Stopping services..." "$BLUE"
    $compose down
    print_color "Services stopped" "$GREEN"
}

show_status() {
    print_color "Service status" "$BLUE"
    $compose ps
}

show_logs() {
    $compose logs -f --tail=100
}

open_shell() {
    print_color "Opening interactive shell..." "$BLUE"
    $compose exec "$container" bash
}

run_spider() {
    if [ $# -lt 1 ]; then
        print_color "Error: specify a spider name" "$RED"
        echo "Available spiders:"
        $compose exec "$container" scrapy list
        exit 1
    fi
    local spider="$1"; shift || true
    print_color "Running spider: $spider" "$BLUE"
    $compose exec "$container" scrapy crawl "$spider" "$@"
}

run_all_spiders() {
    local spiders=(
        "1001tracklists"
        "mixesdb"
        "reddit"
        "setlistfm"
    )
    for spider in "${spiders[@]}"; do
        print_color "Running $spider" "$YELLOW"
        $compose exec "$container" scrapy crawl "$spider" -s CLOSESPIDER_PAGECOUNT=10 || true
        print_color "Completed $spider" "$GREEN"
        sleep 2
    done
}

clean_up() {
    print_color "Removing containers and volumes..." "$BLUE"
    $compose down -v
    print_color "Cleanup complete" "$GREEN"
}

run_tests() {
    print_color "Running pytest suite..." "$BLUE"
    $compose exec "$container" pytest
}

monitor_dashboard() {
    local mode="$1"
    if [ "$mode" == "detailed" ]; then
        $compose exec "$container" python monitor_scrapers.py --detailed
    else
        $compose exec "$container" python monitor_scrapers.py
    fi
}

monitor_live() {
    $compose exec "$container" watch -n 5 python monitor_scrapers.py --detailed
}

show_stats() {
    $compose exec "$container" python monitor_scrapers.py --stats
}

health_check() {
    $compose exec "$container" python monitor_scrapers.py --health
}

case "${1:-}" in
    build) shift; build_image ;;
    start) shift; start_services ;;
    stop) shift; stop_services ;;
    restart) shift; stop_services; start_services ;;
    status) shift; show_status ;;
    logs) shift; show_logs ;;
    shell) shift; open_shell ;;
    run-spider) shift; run_spider "$@" ;;
    run-all) shift; run_all_spiders ;;
    clean) shift; clean_up ;;
    test) shift; run_tests ;;
    monitor) shift; monitor_dashboard "${1:-}" ;;
    monitor-live) shift; monitor_live ;;
    stats) shift; show_stats ;;
    health) shift; health_check ;;
    ''|help|-h|--help) show_usage ;;
    *)
        print_color "Unknown command: $1" "$RED"
        show_usage
        exit 1
        ;;
esac
