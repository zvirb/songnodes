#!/bin/bash
# Entrypoint script for browser-collector
# Starts cron for screenshot cleanup and the FastAPI service

set -e

echo "[$(date)] Starting browser-collector entrypoint..."

# Start cron in background for screenshot cleanup
echo "[$(date)] Starting cron service..."
cron

# Verify cron is running
if pgrep cron > /dev/null; then
    echo "[$(date)] Cron service started successfully"
else
    echo "[$(date)] WARNING: Cron service failed to start"
fi

# Display cron configuration
echo "[$(date)] Cron configuration:"
crontab -l

# Start the FastAPI application
echo "[$(date)] Starting FastAPI application on port 8030..."
exec python -m uvicorn main:app --host 0.0.0.0 --port 8030
