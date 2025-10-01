#!/bin/bash
# Screenshot Cleanup Script
# Deletes screenshots older than 7 days to prevent disk space exhaustion

SCREENSHOT_DIR="/app/screenshots"
RETENTION_DAYS=${SCREENSHOT_RETENTION_DAYS:-7}

echo "[$(date)] Starting screenshot cleanup..."
echo "  Directory: $SCREENSHOT_DIR"
echo "  Retention: $RETENTION_DAYS days"

# Count before cleanup
BEFORE_COUNT=$(find "$SCREENSHOT_DIR" -type f -name "*.png" 2>/dev/null | wc -l)
echo "  Screenshots before cleanup: $BEFORE_COUNT"

# Delete old screenshots
DELETED=$(find "$SCREENSHOT_DIR" -type f -name "*.png" -mtime +$RETENTION_DAYS -delete -print 2>/dev/null | wc -l)

# Count after cleanup
AFTER_COUNT=$(find "$SCREENSHOT_DIR" -type f -name "*.png" 2>/dev/null | wc -l)

echo "  Screenshots deleted: $DELETED"
echo "  Screenshots remaining: $AFTER_COUNT"
echo "[$(date)] Screenshot cleanup completed"

# Optional: Log to file for audit trail
if [ -n "$LOG_FILE" ]; then
    echo "[$(date)] Cleanup: deleted $DELETED, remaining $AFTER_COUNT" >> "$LOG_FILE"
fi

exit 0
