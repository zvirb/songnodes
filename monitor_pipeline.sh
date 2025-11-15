#!/bin/bash

# SongNodes Data Pipeline Monitor
# Monitors database growth, ETL pipeline, and scraper activity

echo "=========================================="
echo "SongNodes Data Collection Pipeline Monitor"
echo "=========================================="
echo "Starting monitoring at $(date)"
echo ""

MONITORING_DURATION=600  # 10 minutes
REPORT_INTERVAL=120      # 2 minutes
TARGET_TRACKS=200        # Target number of tracks
START_TIME=$(date +%s)

# Function to check database metrics
check_database() {
    echo -e "\n📊 DATABASE METRICS:"

    # Get all counts in one query for efficiency
    kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -t -c "
        SELECT 'Tracks:', COUNT(*) FROM musicdb.tracks
        UNION ALL
        SELECT 'Playlists:', COUNT(*) FROM musicdb.playlists
        UNION ALL
        SELECT 'Playlist_Tracks:', COUNT(*) FROM musicdb.playlist_tracks
        UNION ALL
        SELECT 'Track_Artists:', COUNT(*) FROM musicdb.track_artists
        UNION ALL
        SELECT 'Edges (Adjacency):', COUNT(*) FROM musicdb.edges
        UNION ALL
        SELECT 'Target_Tracks:', COUNT(*) FROM musicdb.target_track_searches;
    " 2>/dev/null | while read metric count; do
        printf "  %-20s %8s\n" "$metric" "$count"
    done
}

# Function to check ETL pipeline
check_etl() {
    echo -e "\n⚙️  ETL PIPELINE STATUS:"

    # Check CronJobs
    echo "  CronJobs:"
    kubectl get cronjobs -n songnodes | grep -E "silver|gold|etl" | while read line; do
        echo "    $line"
    done

    # Check recent jobs
    echo "  Recent Jobs (last 5):"
    kubectl get jobs -n songnodes --sort-by=.metadata.creationTimestamp | grep -E "silver|gold|etl" | tail -5 | while read line; do
        echo "    $line"
    done
}

# Function to check scraper activity
check_scrapers() {
    echo -e "\n🕷️  SCRAPER STATUS:"

    # Check scraper pods
    kubectl get pods -n songnodes | grep -E "scraper|unified" | while read line; do
        echo "  Pod: $line"
    done

    # Check for recent scraping activity
    echo "  Recent Activity:"

    # Check orchestrator logs for errors
    ORCH_ERRORS=$(kubectl logs scraper-orchestrator-6bf7959776-jp5l7 -n songnodes --since=2m 2>/dev/null | grep -c "error" || echo "0")
    echo "    Orchestrator errors (last 2m): $ORCH_ERRORS"

    # Check unified scraper for activity
    SCRAPER_HEALTH=$(kubectl logs unified-scraper-6d8f7ff5d9-2wgzc -n songnodes --tail=1 2>/dev/null | grep -q "200 OK" && echo "Healthy" || echo "Unknown")
    echo "    Unified Scraper health: $SCRAPER_HEALTH"
}

# Function to check critical issues
check_issues() {
    echo -e "\n⚠️  CRITICAL ISSUES:"

    # Check for Redis connectivity
    REDIS_ERRORS=$(kubectl logs scraper-orchestrator-6bf7959776-jp5l7 -n songnodes --since=2m 2>/dev/null | grep -c "Connection refused" || echo "0")
    if [ "$REDIS_ERRORS" -gt 0 ]; then
        echo "  ❌ Redis connection errors detected: $REDIS_ERRORS occurrences"
    fi

    # Check for failed ETL jobs
    FAILED_JOBS=$(kubectl get jobs -n songnodes | grep -E "silver|gold|etl" | grep -c "Failed" || echo "0")
    if [ "$FAILED_JOBS" -gt 0 ]; then
        echo "  ❌ Failed ETL jobs: $FAILED_JOBS"
    fi

    # Check database connection
    kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT 1" &>/dev/null
    if [ $? -ne 0 ]; then
        echo "  ❌ Database connection failed"
    fi

    if [ "$REDIS_ERRORS" -eq 0 ] && [ "$FAILED_JOBS" -eq 0 ] && [ $? -eq 0 ]; then
        echo "  ✅ No critical issues detected"
    fi
}

# Main monitoring loop
ITERATION=0
while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    # Report header
    echo -e "\n==========================================\n"
    echo "📍 MONITORING REPORT #$((ITERATION + 1))"
    echo "⏱️  Time Elapsed: ${ELAPSED}s / ${MONITORING_DURATION}s"
    echo "🕐 Timestamp: $(date)"

    # Check all systems
    check_database

    # Get track count for target check
    TRACK_COUNT=$(kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -t -c "SELECT COUNT(*) FROM musicdb.tracks;" 2>/dev/null | tr -d ' ')
    EDGE_COUNT=$(kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -t -c "SELECT COUNT(*) FROM musicdb.edges;" 2>/dev/null | tr -d ' ')

    check_etl
    check_scrapers
    check_issues

    # Progress summary
    echo -e "\n📈 PROGRESS SUMMARY:"
    echo "  Target: $TARGET_TRACKS tracks with adjacency edges"
    echo "  Current: $TRACK_COUNT tracks, $EDGE_COUNT edges"

    if [ "$TRACK_COUNT" -ge "$TARGET_TRACKS" ] && [ "$EDGE_COUNT" -gt 0 ]; then
        echo -e "\n🎉 SUCCESS! Target reached: $TRACK_COUNT tracks with $EDGE_COUNT adjacency edges"
        echo "Monitoring complete at $(date)"
        exit 0
    fi

    # Check if monitoring duration exceeded
    if [ "$ELAPSED" -ge "$MONITORING_DURATION" ]; then
        echo -e "\n⏱️  Monitoring duration ($MONITORING_DURATION seconds) reached"
        echo "Final status: $TRACK_COUNT tracks, $EDGE_COUNT edges"
        echo "Target not reached. Manual intervention may be required."
        exit 1
    fi

    # Wait for next report interval
    ITERATION=$((ITERATION + 1))
    echo -e "\nNext report in $REPORT_INTERVAL seconds..."
    sleep $REPORT_INTERVAL
done