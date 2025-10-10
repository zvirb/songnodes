#!/bin/bash
# API Gateway Load Testing Script
# Tests resilience patterns under concurrent load

set -e

# Configuration
API_URL="http://localhost:8100"
CONCURRENT_REQUESTS=100
TEST_DURATION=30
RESULTS_FILE="/tmp/api_gateway_load_test_results.txt"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "API Gateway Load Testing"
echo "=========================================="
echo "Target: $API_URL"
echo "Concurrent Requests: $CONCURRENT_REQUESTS"
echo "Duration: ${TEST_DURATION}s"
echo "=========================================="
echo ""

# Create results file
echo "API Gateway Load Test Results - $(date)" > "$RESULTS_FILE"
echo "=========================================" >> "$RESULTS_FILE"

# Test 1: Health check baseline
echo -e "${YELLOW}[1/5] Testing baseline health check...${NC}"
START_TIME=$(date +%s%N)
HEALTH_RESPONSE=$(curl -s http://localhost:8100/health)
END_TIME=$(date +%s%N)
HEALTH_LATENCY=$(( (END_TIME - START_TIME) / 1000000 ))
echo "  Health Check Latency: ${HEALTH_LATENCY}ms"
echo "  Response: $HEALTH_RESPONSE"
echo "" >> "$RESULTS_FILE"
echo "1. Health Check Baseline" >> "$RESULTS_FILE"
echo "  Latency: ${HEALTH_LATENCY}ms" >> "$RESULTS_FILE"
echo "  Response: $HEALTH_RESPONSE" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Test 2: Concurrent Spotify search requests
echo -e "${YELLOW}[2/5] Executing $CONCURRENT_REQUESTS concurrent Spotify search requests...${NC}"
echo "2. Concurrent Spotify Search (${CONCURRENT_REQUESTS} requests)" >> "$RESULTS_FILE"

# Create temp file for storing individual request times
TEMP_TIMES="/tmp/request_times_$$"
> "$TEMP_TIMES"

# Launch concurrent requests
pids=()
SUCCESS_COUNT=0
ERROR_COUNT=0
RATE_LIMITED_COUNT=0
START_BATCH_TIME=$(date +%s%N)

for i in $(seq 1 $CONCURRENT_REQUESTS); do
    (
        REQ_START=$(date +%s%N)
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/spotify/search" \
            -H "Content-Type: application/json" \
            -d "{\"artist\": \"Deadmau5\", \"title\": \"Strobe\", \"limit\": 5}")
        REQ_END=$(date +%s%N)
        REQ_TIME=$(( (REQ_END - REQ_START) / 1000000 ))

        echo "$HTTP_CODE:$REQ_TIME" >> "$TEMP_TIMES"
    ) &
    pids+=($!)

    # Small delay to prevent overwhelming the system
    if [ $((i % 10)) -eq 0 ]; then
        sleep 0.1
    fi
done

# Wait for all requests to complete
echo "  Waiting for all requests to complete..."
for pid in "${pids[@]}"; do
    wait $pid
done

END_BATCH_TIME=$(date +%s%N)
TOTAL_BATCH_TIME=$(( (END_BATCH_TIME - START_BATCH_TIME) / 1000000000 ))

# Analyze results
while IFS=: read -r code time; do
    if [ "$code" = "200" ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    elif [ "$code" = "429" ]; then
        RATE_LIMITED_COUNT=$((RATE_LIMITED_COUNT + 1))
    else
        ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
done < "$TEMP_TIMES"

# Calculate statistics
LATENCIES=$(cut -d: -f2 "$TEMP_TIMES" | sort -n)
P50=$(echo "$LATENCIES" | awk '{a[NR]=$1} END {print a[int(NR*0.5)]}')
P95=$(echo "$LATENCIES" | awk '{a[NR]=$1} END {print a[int(NR*0.95)]}')
P99=$(echo "$LATENCIES" | awk '{a[NR]=$1} END {print a[int(NR*0.99)]}')
AVG=$(echo "$LATENCIES" | awk '{sum+=$1; count++} END {print sum/count}')
MAX=$(echo "$LATENCIES" | tail -1)
MIN=$(echo "$LATENCIES" | head -1)

SUCCESS_RATE=$(awk "BEGIN {printf \"%.2f\", ($SUCCESS_COUNT / $CONCURRENT_REQUESTS) * 100}")
REQ_PER_SEC=$(awk "BEGIN {printf \"%.2f\", $CONCURRENT_REQUESTS / $TOTAL_BATCH_TIME}")

echo ""
echo -e "${GREEN}  Results:${NC}"
echo "    Total Requests:    $CONCURRENT_REQUESTS"
echo "    Successful:        $SUCCESS_COUNT (${SUCCESS_RATE}%)"
echo "    Rate Limited:      $RATE_LIMITED_COUNT"
echo "    Errors:            $ERROR_COUNT"
echo "    Total Time:        ${TOTAL_BATCH_TIME}s"
echo "    Throughput:        ${REQ_PER_SEC} req/s"
echo ""
echo "  Latency Statistics (ms):"
echo "    Min:    $MIN"
echo "    P50:    $P50"
echo "    P95:    $P95"
echo "    P99:    $P99"
echo "    Max:    $MAX"
echo "    Avg:    $AVG"

# Write to results file
echo "  Success: $SUCCESS_COUNT / $CONCURRENT_REQUESTS (${SUCCESS_RATE}%)" >> "$RESULTS_FILE"
echo "  Rate Limited: $RATE_LIMITED_COUNT" >> "$RESULTS_FILE"
echo "  Errors: $ERROR_COUNT" >> "$RESULTS_FILE"
echo "  Total Time: ${TOTAL_BATCH_TIME}s" >> "$RESULTS_FILE"
echo "  Throughput: ${REQ_PER_SEC} req/s" >> "$RESULTS_FILE"
echo "  Latency - Min: ${MIN}ms, P50: ${P50}ms, P95: ${P95}ms, P99: ${P99}ms, Max: ${MAX}ms" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Cleanup
rm -f "$TEMP_TIMES"

# Test 3: Rate limiter validation (should be 10 req/s max for Spotify)
echo ""
echo -e "${YELLOW}[3/5] Testing rate limiter (Spotify: 10 req/s max)...${NC}"
echo "3. Rate Limiter Validation" >> "$RESULTS_FILE"

RATE_TEST_REQS=20
RATE_TEST_SUCCESS=0
RATE_TEST_LIMITED=0
START_RATE_TEST=$(date +%s%N)

for i in $(seq 1 $RATE_TEST_REQS); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/spotify/search" \
        -H "Content-Type: application/json" \
        -d "{\"artist\": \"Test\", \"title\": \"Track\", \"limit\": 1}")

    if [ "$HTTP_CODE" = "200" ]; then
        RATE_TEST_SUCCESS=$((RATE_TEST_SUCCESS + 1))
    elif [ "$HTTP_CODE" = "429" ]; then
        RATE_TEST_LIMITED=$((RATE_TEST_LIMITED + 1))
    fi

    # No delay - fire as fast as possible
done

END_RATE_TEST=$(date +%s%N)
RATE_TEST_TIME=$(( (END_RATE_TEST - START_RATE_TEST) / 1000000000 ))

echo "  Sent $RATE_TEST_REQS requests as fast as possible"
echo "  Time: ${RATE_TEST_TIME}s"
echo "  Success: $RATE_TEST_SUCCESS"
echo "  Rate Limited: $RATE_TEST_LIMITED"

echo "  Requests: $RATE_TEST_REQS" >> "$RESULTS_FILE"
echo "  Time: ${RATE_TEST_TIME}s" >> "$RESULTS_FILE"
echo "  Success: $RATE_TEST_SUCCESS" >> "$RESULTS_FILE"
echo "  Rate Limited: $RATE_TEST_LIMITED" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Test 4: Circuit breaker status
echo ""
echo -e "${YELLOW}[4/5] Checking circuit breaker states...${NC}"
echo "4. Circuit Breaker Status" >> "$RESULTS_FILE"
CB_STATUS=$(curl -s "$API_URL/admin/circuit-breakers" | jq .)
echo "$CB_STATUS"
echo "$CB_STATUS" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Test 5: Cache statistics
echo ""
echo -e "${YELLOW}[5/5] Checking cache statistics...${NC}"
echo "5. Cache Statistics" >> "$RESULTS_FILE"
CACHE_STATS=$(curl -s "$API_URL/admin/cache/stats" | jq .)
echo "$CACHE_STATS"
echo "$CACHE_STATS" >> "$RESULTS_FILE"

# Final summary
echo ""
echo "=========================================="
echo -e "${GREEN}Load Test Complete!${NC}"
echo "=========================================="
echo "Results saved to: $RESULTS_FILE"
echo ""

# Assessment
echo "Assessment:"
if [ $SUCCESS_RATE -gt 90 ]; then
    echo -e "${GREEN}✓ Success rate: PASS (${SUCCESS_RATE}%)${NC}"
else
    echo -e "${RED}✗ Success rate: FAIL (${SUCCESS_RATE}%)${NC}"
fi

if [ $RATE_LIMITED_COUNT -gt 0 ]; then
    echo -e "${GREEN}✓ Rate limiting: ACTIVE (${RATE_LIMITED_COUNT} requests throttled)${NC}"
else
    echo -e "${YELLOW}⚠ Rate limiting: Check configuration (no throttling observed)${NC}"
fi

if [ -n "$P95" ] && [ "$P95" -lt 5000 ]; then
    echo -e "${GREEN}✓ P95 latency: GOOD (${P95}ms)${NC}"
else
    echo -e "${YELLOW}⚠ P95 latency: SLOW (${P95}ms)${NC}"
fi

echo ""
