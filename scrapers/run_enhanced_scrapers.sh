#!/bin/bash

# Enhanced Scrapers Runner Script
# Usage: ./run_enhanced_scrapers.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

# Function to show usage
show_usage() {
    print_color "Enhanced Scrapers Runner" "$BLUE"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  build         - Build the Docker image"
    echo "  start         - Start all services (Redis, PostgreSQL, scrapers)"
    echo "  stop          - Stop all services"
    echo "  restart       - Restart all services"
    echo "  status        - Show service status"
    echo "  logs          - Show logs from all services"
    echo "  shell         - Open shell in scrapers container"
    echo "  run-spider    - Run a specific spider"
    echo "  run-all       - Run all enhanced spiders"
    echo "  clean         - Stop services and remove volumes"
    echo "  test          - Run test suite"
    echo ""
    echo "Monitoring Commands:"
    echo "  monitor       - Show monitoring dashboard (add 'detailed' for more info)"
    echo "  monitor-live  - Live monitoring with auto-refresh (Ctrl+C to stop)"
    echo "  stats         - Show scraping statistics and metrics"
    echo "  health        - Run system health check"
    echo ""
    echo "Examples:"
    echo "  $0 build"
    echo "  $0 start"
    echo "  $0 run-spider enhanced_1001tracklists"
    echo "  $0 run-all"
    echo "  $0 monitor"
    echo "  $0 monitor detailed"
    echo "  $0 monitor-live"
    echo "  $0 stats"
    echo "  $0 health"
    echo ""
}

# Function to build Docker image
build_image() {
    print_color "Building enhanced scrapers Docker image..." "$BLUE"
    docker compose -f docker-compose.enhanced.yml build
    print_color "Build complete!" "$GREEN"
}

# Function to start services
start_services() {
    print_color "Starting services..." "$BLUE"
    docker compose -f docker-compose.enhanced.yml up -d redis postgres

    # Wait for services to be ready
    print_color "Waiting for services to be healthy..." "$YELLOW"
    sleep 5

    docker compose -f docker-compose.enhanced.yml up -d enhanced-scrapers adminer
    print_color "All services started!" "$GREEN"

    # Show status
    docker compose -f docker-compose.enhanced.yml ps
}

# Function to stop services
stop_services() {
    print_color "Stopping services..." "$BLUE"
    docker compose -f docker-compose.enhanced.yml down
    print_color "Services stopped!" "$GREEN"
}

# Function to restart services
restart_services() {
    stop_services
    start_services
}

# Function to show service status
show_status() {
    print_color "Service Status:" "$BLUE"
    docker compose -f docker-compose.enhanced.yml ps
}

# Function to show logs
show_logs() {
    docker compose -f docker-compose.enhanced.yml logs -f --tail=100
}

# Function to open shell
open_shell() {
    print_color "Opening shell in enhanced-scrapers container..." "$BLUE"
    docker compose -f docker-compose.enhanced.yml exec enhanced-scrapers bash
}

# Function to run a specific spider
run_spider() {
    if [ -z "$1" ]; then
        print_color "Error: Please specify a spider name" "$RED"
        echo "Available spiders:"
        docker compose -f docker-compose.enhanced.yml exec enhanced-scrapers scrapy list
        exit 1
    fi

    SPIDER_NAME=$1
    shift  # Remove spider name from arguments

    print_color "Running spider: $SPIDER_NAME" "$BLUE"
    docker compose -f docker-compose.enhanced.yml exec enhanced-scrapers \
        scrapy crawl "$SPIDER_NAME" "$@"
}

# Function to run all enhanced spiders
run_all_spiders() {
    print_color "Running all enhanced spiders..." "$BLUE"

    # List of enhanced spiders
    SPIDERS=(
        "enhanced_1001tracklists"
        "enhanced_mixesdb"
        "enhanced_reddit"
        "setlistfm_api"
    )

    for spider in "${SPIDERS[@]}"; do
        print_color "Running $spider..." "$YELLOW"
        docker compose -f docker-compose.enhanced.yml exec enhanced-scrapers \
            scrapy crawl "$spider" -s CLOSESPIDER_PAGECOUNT=10 || true
        print_color "Completed $spider" "$GREEN"
        sleep 2
    done

    print_color "All spiders completed!" "$GREEN"
}

# Function to clean up
clean_up() {
    print_color "Cleaning up..." "$BLUE"
    docker compose -f docker-compose.enhanced.yml down -v
    print_color "Clean up complete!" "$GREEN"
}

# Function to run tests
run_tests() {
    print_color "Running tests..." "$BLUE"
    docker compose -f docker-compose.enhanced.yml exec enhanced-scrapers \
        python test_multi_spider.py
}

# Function to monitor scrapers
monitor_scrapers() {
    local MONITOR_TYPE="${1:-basic}"

    print_color "=== Scraper Monitoring Dashboard ===" "$BLUE"
    echo ""

    # Check service health
    print_color "Service Health:" "$YELLOW"
    docker compose -f docker-compose.enhanced.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.State}}"
    echo ""

    # Redis monitoring
    print_color "Redis State Management:" "$YELLOW"
    docker compose -f docker-compose.enhanced.yml exec redis redis-cli --raw eval "
        local keys = redis.call('keys', 'scraped:*')
        local stats = {}
        stats['total_keys'] = #keys
        stats['1001tracklists'] = #redis.call('keys', 'scraped:*:1001tracklists*')
        stats['mixesdb'] = #redis.call('keys', 'scraped:*:mixesdb*')
        stats['setlistfm'] = #redis.call('keys', 'scraped:*:setlistfm*')
        stats['reddit'] = #redis.call('keys', 'scraped:*:reddit*')
        return cjson.encode(stats)
    " 0 2>/dev/null | python3 -m json.tool || echo "Redis stats unavailable"
    echo ""

    # Database monitoring
    print_color "Database Records:" "$YELLOW"
    docker compose -f docker-compose.enhanced.yml exec postgres psql -U musicuser -d musicdb -t -c "
        SELECT
            'Tracks' as table_name, COUNT(*) as count FROM tracks
        UNION ALL
        SELECT 'Artists', COUNT(*) FROM artists
        UNION ALL
        SELECT 'Setlists', COUNT(*) FROM setlists
        UNION ALL
        SELECT 'Track Artists', COUNT(*) FROM track_artists
        UNION ALL
        SELECT 'Setlist Tracks', COUNT(*) FROM setlist_tracks;
    " 2>/dev/null || echo "Database stats unavailable"
    echo ""

    if [ "$MONITOR_TYPE" == "detailed" ]; then
        # Recent activity
        print_color "Recent Scraping Activity (Last 10):" "$YELLOW"
        docker compose -f docker-compose.enhanced.yml exec postgres psql -U musicuser -d musicdb -t -c "
            SELECT
                created_at,
                track_name,
                artist_name
            FROM tracks t
            JOIN track_artists ta ON t.id = ta.track_id
            JOIN artists a ON ta.artist_id = a.id
            ORDER BY t.created_at DESC
            LIMIT 10;
        " 2>/dev/null || echo "No recent activity"
    fi
}

# Function for live monitoring
monitor_live() {
    print_color "Starting live monitoring (Press Ctrl+C to stop)..." "$BLUE"
    echo ""

    while true; do
        clear
        print_color "=== LIVE MONITORING - $(date) ===" "$GREEN"
        echo ""

        # Container status
        print_color "Container Status:" "$YELLOW"
        docker compose -f docker-compose.enhanced.yml ps --format "table {{.Name}}\t{{.State}}\t{{.Status}}"
        echo ""

        # Redis operations per second
        print_color "Redis Operations:" "$YELLOW"
        docker compose -f docker-compose.enhanced.yml exec redis redis-cli --raw INFO stats | grep -E "instantaneous_ops_per_sec|total_commands_processed|rejected_connections"
        echo ""

        # Database connections
        print_color "Database Connections:" "$YELLOW"
        docker compose -f docker-compose.enhanced.yml exec postgres psql -U musicuser -d musicdb -t -c "
            SELECT count(*) as active_connections
            FROM pg_stat_activity
            WHERE state = 'active';
        " 2>/dev/null || echo "Unable to query database"
        echo ""

        # Recent logs (last 5 lines from each spider)
        print_color "Recent Spider Activity:" "$YELLOW"
        docker compose -f docker-compose.enhanced.yml logs --tail=5 enhanced-scrapers 2>/dev/null | grep -E "INFO|WARNING|ERROR" | tail -10

        sleep 5
    done
}

# Function to show statistics
show_statistics() {
    print_color "=== Scraping Statistics ===" "$BLUE"
    echo ""

    # Time-based statistics
    print_color "Scraping Activity by Hour (Last 24h):" "$YELLOW"
    docker compose -f docker-compose.enhanced.yml exec postgres psql -U musicuser -d musicdb -t -c "
        SELECT
            DATE_TRUNC('hour', created_at) as hour,
            COUNT(*) as tracks_scraped
        FROM tracks
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour DESC
        LIMIT 24;
    " 2>/dev/null || echo "No data available"
    echo ""

    # Spider performance
    print_color "Spider Performance Metrics:" "$YELLOW"
    echo "Checking Redis for spider metrics..."
    docker compose -f docker-compose.enhanced.yml exec redis redis-cli --raw eval "
        local result = {}
        local spiders = {'1001tracklists', 'mixesdb', 'setlistfm', 'reddit'}
        for i, spider in ipairs(spiders) do
            local keys = redis.call('keys', 'scraped:*:' .. spider .. '*')
            local last_run = redis.call('get', 'scraped:setlists:' .. spider .. ':last_run')
            result[spider] = {
                sources_processed = #keys,
                last_run = last_run or 'never'
            }
        end
        return cjson.encode(result)
    " 0 2>/dev/null | python3 -m json.tool || echo "Metrics unavailable"
    echo ""

    # Top artists found
    print_color "Top 10 Artists by Track Count:" "$YELLOW"
    docker compose -f docker-compose.enhanced.yml exec postgres psql -U musicuser -d musicdb -t -c "
        SELECT
            a.artist_name,
            COUNT(DISTINCT ta.track_id) as track_count
        FROM artists a
        JOIN track_artists ta ON a.id = ta.artist_id
        GROUP BY a.artist_name
        ORDER BY track_count DESC
        LIMIT 10;
    " 2>/dev/null || echo "No artist data"
}

# Function to check health
check_health() {
    print_color "=== System Health Check ===" "$BLUE"
    echo ""

    local HEALTH_SCORE=0
    local MAX_SCORE=5

    # Check Redis
    print_color "Checking Redis..." "$YELLOW"
    if docker compose -f docker-compose.enhanced.yml exec redis redis-cli ping &>/dev/null; then
        print_color "✓ Redis is healthy" "$GREEN"
        ((HEALTH_SCORE++))
    else
        print_color "✗ Redis is not responding" "$RED"
    fi

    # Check PostgreSQL
    print_color "Checking PostgreSQL..." "$YELLOW"
    if docker compose -f docker-compose.enhanced.yml exec postgres pg_isready -U musicuser &>/dev/null; then
        print_color "✓ PostgreSQL is healthy" "$GREEN"
        ((HEALTH_SCORE++))
    else
        print_color "✗ PostgreSQL is not responding" "$RED"
    fi

    # Check scrapers container
    print_color "Checking Scrapers Container..." "$YELLOW"
    if docker compose -f docker-compose.enhanced.yml exec enhanced-scrapers scrapy version &>/dev/null; then
        print_color "✓ Scrapers container is healthy" "$GREEN"
        ((HEALTH_SCORE++))
    else
        print_color "✗ Scrapers container is not responding" "$RED"
    fi

    # Check disk space
    print_color "Checking Disk Space..." "$YELLOW"
    DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -lt 80 ]; then
        print_color "✓ Disk space is adequate ($DISK_USAGE% used)" "$GREEN"
        ((HEALTH_SCORE++))
    else
        print_color "⚠ Disk space is low ($DISK_USAGE% used)" "$YELLOW"
    fi

    # Check memory
    print_color "Checking Memory Usage..." "$YELLOW"
    if command -v free &>/dev/null; then
        MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
        if [ "$MEM_USAGE" -lt 80 ]; then
            print_color "✓ Memory usage is normal ($MEM_USAGE%)" "$GREEN"
            ((HEALTH_SCORE++))
        else
            print_color "⚠ High memory usage ($MEM_USAGE%)" "$YELLOW"
        fi
    else
        print_color "- Memory check not available" "$YELLOW"
        ((MAX_SCORE--))
    fi

    echo ""
    print_color "Health Score: $HEALTH_SCORE/$MAX_SCORE" "$BLUE"

    if [ "$HEALTH_SCORE" -eq "$MAX_SCORE" ]; then
        print_color "System is fully healthy! ✓" "$GREEN"
    elif [ "$HEALTH_SCORE" -ge $((MAX_SCORE - 1)) ]; then
        print_color "System is mostly healthy with minor issues" "$YELLOW"
    else
        print_color "System has health issues that need attention" "$RED"
    fi
}

# Main script logic
case "$1" in
    build)
        build_image
        ;;
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    shell)
        open_shell
        ;;
    run-spider)
        shift  # Remove 'run-spider' from arguments
        run_spider "$@"
        ;;
    run-all)
        run_all_spiders
        ;;
    clean)
        clean_up
        ;;
    test)
        run_tests
        ;;
    monitor)
        shift
        monitor_scrapers "$@"
        ;;
    monitor-live)
        monitor_live
        ;;
    stats)
        show_statistics
        ;;
    health)
        check_health
        ;;
    *)
        show_usage
        ;;
esac