#!/bin/bash
# Setup automated backup cron job for SongNodes

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup_database.sh"

echo "🕐 Setting up automated database backups..."

# Check if script exists
if [[ ! -f "$BACKUP_SCRIPT" ]]; then
    echo "❌ Backup script not found: $BACKUP_SCRIPT"
    exit 1
fi

# Create cron job entry
CRON_JOB="0 */6 * * * cd $SCRIPT_DIR && ./backup_database.sh >> $SCRIPT_DIR/backups/backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "backup_database.sh"; then
    echo "⚠️ Backup cron job already exists"
    echo "Current backup cron jobs:"
    crontab -l 2>/dev/null | grep "backup_database.sh"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Backup cron job added successfully"
    echo "   Schedule: Every 6 hours"
    echo "   Command: $CRON_JOB"
fi

echo ""
echo "📋 Current cron jobs:"
crontab -l 2>/dev/null || echo "No cron jobs found"

echo ""
echo "🔧 Manual backup commands:"
echo "   Create backup: $SCRIPT_DIR/backup_database.sh"
echo "   Test backup:   $SCRIPT_DIR/backup_database.sh --test-restore"
echo "   List backups:  $SCRIPT_DIR/restore_database.sh --list"
echo "   Restore:       $SCRIPT_DIR/restore_database.sh --latest"

echo ""
echo "✅ Backup system setup complete!"