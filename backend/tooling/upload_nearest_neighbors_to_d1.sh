#!/bin/bash

# Script to upload only the nearest_paper_ids column to Cloudflare D1
# This avoids re-uploading the entire database
#
# Prerequisites:
# 1. Run precompute_nearest.py locally first
# 2. Have wrangler installed and configured

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/data"
SOURCE_DB="$DATA_DIR/db.sqlite"
D1_DATABASE_NAME="laion-data-exploration"
TEMP_SQL_DIR="$DATA_DIR/nearest_neighbors_updates"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting nearest_paper_ids column upload to Cloudflare D1...${NC}\n"

# Check if source database exists
if [ ! -f "$SOURCE_DB" ]; then
    echo -e "${RED}Error: Source database '$SOURCE_DB' not found!${NC}"
    exit 1
fi

# Check if bunx/wrangler is available
if ! command -v bunx &> /dev/null; then
    echo -e "${RED}bunx/wrangler not found. Please install wrangler.${NC}"
    exit 1
fi

# Create temp directory for SQL files
rm -rf "$TEMP_SQL_DIR"
mkdir -p "$TEMP_SQL_DIR"

echo -e "${GREEN}Step 1: Adding column to D1 database (if not exists)...${NC}"
cd "$SCRIPT_DIR/.."

# Try to add the column (will fail if it already exists, which is okay)
bunx wrangler d1 execute "$D1_DATABASE_NAME" --remote \
    --command="ALTER TABLE papers ADD COLUMN nearest_paper_ids TEXT" \
    2>/dev/null || echo -e "${YELLOW}Column may already exist, continuing...${NC}"

echo -e "\n${GREEN}Step 2: Exporting nearest_paper_ids data from local database...${NC}"

# Export environment variables for Python script
export DATA_DIR
export SOURCE_DB
export TEMP_SQL_DIR

# Export UPDATE statements in batches
python3 << 'PYTHON_SCRIPT'
import sqlite3
import json
import os

# Configuration
data_dir = os.environ.get('DATA_DIR')
source_db = os.environ.get('SOURCE_DB')
temp_sql_dir = os.environ.get('TEMP_SQL_DIR')

# Connect to database
conn = sqlite3.connect(source_db)
cursor = conn.cursor()

# Get all papers with nearest_paper_ids
cursor.execute("""
    SELECT id, nearest_paper_ids
    FROM papers
    WHERE nearest_paper_ids IS NOT NULL
    ORDER BY id
""")

rows = cursor.fetchall()
conn.close()

print(f"Found {len(rows)} papers with nearest_paper_ids")

# Split into batches of 10000 UPDATE statements per file
# (D1 has limits on transaction size)
batch_size = 10000
num_batches = (len(rows) + batch_size - 1) // batch_size

print(f"Creating {num_batches} batch files...")

for batch_num in range(num_batches):
    start_idx = batch_num * batch_size
    end_idx = min((batch_num + 1) * batch_size, len(rows))
    batch_rows = rows[start_idx:end_idx]

    # Create SQL file for this batch
    sql_file = os.path.join(temp_sql_dir, f'batch_{batch_num:04d}.sql')

    with open(sql_file, 'w') as f:
        for paper_id, nearest_ids_json in batch_rows:
            # Escape single quotes in JSON for SQL
            escaped_json = nearest_ids_json.replace("'", "''")
            f.write(f"UPDATE papers SET nearest_paper_ids = '{escaped_json}' WHERE id = {paper_id};\n")

    print(f"  Created batch {batch_num + 1}/{num_batches}: {end_idx - start_idx} updates")

print(f"\n✓ Exported {len(rows)} UPDATE statements to {num_batches} batch files")
PYTHON_SCRIPT

echo -e "\n${GREEN}Step 3: Uploading batches to Cloudflare D1...${NC}"

# Upload each batch
BATCH_FILES=("$TEMP_SQL_DIR"/batch_*.sql)
TOTAL_BATCHES=${#BATCH_FILES[@]}
CURRENT_BATCH=0

for batch_file in "${BATCH_FILES[@]}"; do
    CURRENT_BATCH=$((CURRENT_BATCH + 1))
    BATCH_NAME=$(basename "$batch_file")

    echo -e "${YELLOW}[$CURRENT_BATCH/$TOTAL_BATCHES] Uploading $BATCH_NAME...${NC}"

    if bunx wrangler d1 execute "$D1_DATABASE_NAME" --remote --file="$batch_file"; then
        echo -e "${GREEN}✓ $BATCH_NAME uploaded successfully${NC}"
    else
        echo -e "${RED}✗ Failed to upload $BATCH_NAME${NC}"
        echo -e "${YELLOW}You can retry from batch $CURRENT_BATCH by running:${NC}"
        echo -e "  bunx wrangler d1 execute $D1_DATABASE_NAME --remote --file=$batch_file"
        exit 1
    fi

    # Small delay to avoid rate limiting
    sleep 0.5
done

echo -e "\n${GREEN}Step 4: Verifying upload...${NC}"

# Query D1 to verify
bunx wrangler d1 execute "$D1_DATABASE_NAME" --remote \
    --command="SELECT COUNT(*) as count FROM papers WHERE nearest_paper_ids IS NOT NULL" \
    | grep -A 1 "count" || echo -e "${YELLOW}Could not verify count (query may have succeeded anyway)${NC}"

echo -e "\n${GREEN}Step 5: Cleaning up temporary files...${NC}"
rm -rf "$TEMP_SQL_DIR"

echo -e "\n${GREEN}✓ Successfully uploaded nearest_paper_ids column to D1!${NC}"
echo -e "Database: ${YELLOW}$D1_DATABASE_NAME${NC}"

echo -e "\n${YELLOW}Note: Update the upload_db_to_cloudflare.sh script to include${NC}"
echo -e "${YELLOW}the nearest_paper_ids column in future full database uploads.${NC}"

echo -e "\n${GREEN}Done!${NC}"
