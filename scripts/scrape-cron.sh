#!/bin/bash
# MySpy scraper cron wrapper
# Runs scraper with limited combos, logs output
cd "$(dirname "$0")/.."
LOG_DIR="$HOME/.myspy-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/scrape-$(date +%Y%m%d-%H%M%S).log"

echo "=== MySpy Scrape $(date) ===" > "$LOG_FILE"
MAX_COMBOS=15 npx tsx scripts/scrape.ts >> "$LOG_FILE" 2>&1
echo "=== Done $(date) ===" >> "$LOG_FILE"

# Keep only last 20 logs
ls -t "$LOG_DIR"/scrape-*.log 2>/dev/null | tail -n +21 | xargs rm -f 2>/dev/null
