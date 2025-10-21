#!/bin/bash

# Script to prepare and upload LAION database to Cloudflare D1
# This script:
# 1. Creates a copy of db.sqlite without the 'sample' and 'embedding' columns
# 2. Exports to SQL format compatible with Cloudflare D1
# 3. Applies D1 compatibility fixes:
#    - Removes BEGIN TRANSACTION, COMMIT, SAVEPOINT, RELEASE SAVEPOINT
#    - Removes _cf_KV reserved table references
#    - Converts unsupported SQLite functions (unistr) to compatible format
#    - Splits large INSERT statements into batches of 100 rows
# 4. Splits SQL into chunks of 5000 statements to avoid memory limits
# 5. Uploads chunks sequentially to Cloudflare D1
#
# Based on Cloudflare D1 documentation:
# https://developers.cloudflare.com/d1/build-with-d1/import-and-export-data/

set -e  # Exit on error

# Configuration
# Get the script directory and go up one level to data/
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/data"

SOURCE_DB="$DATA_DIR/db.sqlite"
TARGET_DB="$DATA_DIR/db_cloudflare.sqlite"
D1_DATABASE_NAME="laion-data-exploration"
D1_DATABASE_ID="48ad4777-ba9c-418b-be05-904dca96a7bf"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Cloudflare D1 deployment process...${NC}\n"

# Check if source database exists
if [ ! -f "$SOURCE_DB" ]; then
    echo -e "${RED}Error: Source database '$SOURCE_DB' not found!${NC}"
    exit 1
fi

# Get source database size
SOURCE_SIZE=$(du -h "$SOURCE_DB" | cut -f1)
echo -e "Source database size: ${YELLOW}$SOURCE_SIZE${NC}"

# Remove old target database if it exists
if [ -f "$TARGET_DB" ]; then
    echo -e "${YELLOW}Removing existing target database...${NC}"
    rm "$TARGET_DB"
fi

echo -e "${GREEN}Creating optimized database schema...${NC}"

# Create new database with schema (excluding sample and embedding columns)
sqlite3 "$TARGET_DB" << 'EOF'
-- Create papers table without sample and embedding columns
CREATE TABLE IF NOT EXISTS papers (
  id INTEGER,
  summarization TEXT,
  title TEXT,
  publication_year REAL,
  field_subfield TEXT,
  classification TEXT,
  x REAL,
  y REAL,
  z REAL,
  cluster_id INTEGER,
  cluster_label TEXT,
  claude_label TEXT
);

-- Create index
CREATE INDEX ix_papers_id ON papers (id);
EOF

echo -e "${GREEN}Copying data (excluding sample and embedding columns)...${NC}"

# Copy data without sample and embedding columns
sqlite3 "$SOURCE_DB" << EOF
ATTACH DATABASE '$TARGET_DB' AS target;

INSERT INTO target.papers (
  id,
  summarization,
  title,
  publication_year,
  field_subfield,
  classification,
  x,
  y,
  z,
  cluster_id,
  cluster_label,
  claude_label
)
SELECT
  id,
  summarization,
  title,
  publication_year,
  field_subfield,
  classification,
  x,
  y,
  z,
  cluster_id,
  cluster_label,
  claude_label
FROM papers;

DETACH DATABASE target;
EOF

echo -e "${GREEN}Skipping cache tables (no longer used)...${NC}"
# Cache tables removed - API now queries papers table directly

echo -e "${GREEN}Vacuuming database to reclaim space...${NC}"
sqlite3 "$TARGET_DB" "VACUUM;"

# Get target database size
TARGET_SIZE=$(du -h "$TARGET_DB" | cut -f1)
echo -e "${GREEN}Optimized database created: ${YELLOW}$TARGET_DB${NC} (${YELLOW}$TARGET_SIZE${NC})"

# Verify row counts
echo -e "\n${GREEN}Verifying data integrity...${NC}"
PAPER_COUNT=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM papers;")
echo -e "Papers: ${YELLOW}$PAPER_COUNT${NC}"

# Check if database is under 5GB
TARGET_SIZE_BYTES=$(stat -f%z "$TARGET_DB" 2>/dev/null || stat -c%s "$TARGET_DB" 2>/dev/null)
TARGET_SIZE_GB=$(echo "scale=2; $TARGET_SIZE_BYTES / 1073741824" | bc)

echo -e "Database size: ${YELLOW}${TARGET_SIZE_GB}GB${NC}"

if (( $(echo "$TARGET_SIZE_GB > 5.0" | bc -l) )); then
    echo -e "${RED}Warning: Database is larger than 5GB Cloudflare D1 limit!${NC}"
    echo -e "${YELLOW}You may need to split the database or exclude additional columns.${NC}"
    exit 1
fi

echo -e "\n${GREEN}Database is ready for upload!${NC}"

# Check if bunx/wrangler is available
if ! command -v bunx &> /dev/null; then
    echo -e "${YELLOW}bunx/wrangler not found. Skipping upload.${NC}"
    echo -e "${YELLOW}Install Node.js and wrangler, or use bun from: https://bun.sh${NC}"
    echo -e "${YELLOW}After installing, run this script again:${NC}"
    echo -e "  ./tooling/upload_db_to_cloudflare.sh"
    exit 0
fi

# Check for -y flag for auto-approval
AUTO_APPROVE=false
if [[ "$1" == "-y" ]] || [[ "$1" == "--yes" ]]; then
    AUTO_APPROVE=true
    echo -e "${GREEN}Auto-approve mode enabled${NC}"
fi

# Ask user if they want to upload (unless auto-approve)
if [[ "$AUTO_APPROVE" == true ]]; then
    UPLOAD_CONFIRM="y"
else
    echo -e "\n${YELLOW}Do you want to upload to Cloudflare D1 now? (y/n)${NC}"
    read -r UPLOAD_CONFIRM
fi

if [[ "$UPLOAD_CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "\n${GREEN}Uploading to Cloudflare D1...${NC}"

    # Note: D1 doesn't support direct SQLite file uploads
    # We need to use SQL imports instead
    echo -e "${YELLOW}Exporting to SQL format (this may take a few minutes)...${NC}"
    SQL_FILE="$DATA_DIR/db_cloudflare.sql"
    SQL_FILE_TEMP="$DATA_DIR/db_cloudflare_temp.sql"

    sqlite3 "$TARGET_DB" .dump > "$SQL_FILE_TEMP"

    # Remove transaction statements and reserved tables that D1 doesn't support
    # Per Cloudflare docs: Remove BEGIN TRANSACTION, COMMIT, and _cf_KV table
    # Also convert CREATE TABLE to CREATE TABLE IF NOT EXISTS
    echo -e "${YELLOW}Cleaning SQL file for Cloudflare D1 compatibility...${NC}"
    grep -v "^BEGIN TRANSACTION;" "$SQL_FILE_TEMP" | \
    grep -v "^COMMIT;" | \
    grep -v "^SAVEPOINT" | \
    grep -v "^RELEASE SAVEPOINT" | \
    grep -v "_cf_KV" | \
    sed 's/CREATE TABLE /CREATE TABLE IF NOT EXISTS /g' | \
    sed 's/CREATE INDEX /CREATE INDEX IF NOT EXISTS /g' > "$SQL_FILE"

    rm "$SQL_FILE_TEMP"

    # Handle unsupported functions like unistr() that D1 doesn't support
    echo -e "${YELLOW}Removing unsupported SQLite functions (unistr, etc.)...${NC}"

    # First, check if unistr exists in the file
    if grep -q "unistr(" "$SQL_FILE"; then
        echo -e "${YELLOW}Found unistr() calls, converting to Unicode characters...${NC}"

        # Export SQL_FILE for Python script
        export SQL_FILE

        # Create a Python script to process the file
        python3 << 'PYTHON_SCRIPT'
import re
import os

sql_file = os.environ.get('SQL_FILE')

with open(sql_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Count occurrences before
before_count = len(re.findall(r"unistr\(", content))
print(f"Found {before_count} unistr() calls")

# Replace unistr() function calls with the actual unicode characters
# The unistr() calls contain JSON-like \uXXXX sequences
def replace_unistr(match):
    unicode_str = match.group(1)

    # The string inside unistr() uses JSON-style \uXXXX escapes
    # We need to decode these unicode escapes
    # Use Python's unicode-escape codec but be careful with the format
    try:
        # Replace \u with proper unicode escape format for Python
        # The SQL has single backslash \u, we need to decode it
        decoded = unicode_str.encode('utf-8').decode('unicode-escape')
        # Escape single quotes for SQL by doubling them
        decoded = decoded.replace("'", "''")
        return "'" + decoded + "'"
    except Exception as e:
        print(f"Warning: Could not decode unistr content: {e}")
        print(f"  Content preview: {unicode_str[:100]}...")
        # Return original as fallback
        return match.group(0)

# Find and replace unistr() calls
# Match unistr('...') where the content may span multiple lines
content = re.sub(r"unistr\('((?:[^']|'')*?)'\)", replace_unistr, content, flags=re.DOTALL)

# Count occurrences after
after_count = len(re.findall(r"unistr\(", content))
print(f"Remaining unistr() calls: {after_count}")
print(f"Converted {before_count - after_count} unistr() calls")

with open(sql_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully processed SQL file")
PYTHON_SCRIPT
    else
        echo -e "${GREEN}No unistr() calls found, skipping...${NC}"
    fi

    # Split large INSERT statements to avoid "Statement too long" errors
    # D1 has limits on statement size, so we'll split into smaller batches
    echo -e "${YELLOW}Optimizing INSERT statements for D1...${NC}"
    python3 - "$SQL_FILE" << 'PYTHON_SCRIPT'
import sys
import re

sql_file = sys.argv[1]
output_file = sql_file + ".optimized"

with open(sql_file, 'r') as f:
    content = f.read()

# Find all INSERT statements with multiple VALUES
insert_pattern = r'INSERT INTO (\w+) \([^)]+\) VALUES\s+((?:\([^)]+\)(?:,\s*)?)+);'

def split_insert(match):
    table_and_cols = match.group(0).split(' VALUES ')[0]
    values = re.findall(r'\([^)]+\)', match.group(2))

    # Split into batches of 10 rows to avoid statement length issues
    # Some rows have very large JSON fields, so we use a small batch size
    batch_size = 10
    result = []

    for i in range(0, len(values), batch_size):
        batch = values[i:i + batch_size]
        result.append(table_and_cols + ' VALUES ' + ',\n  '.join(batch) + ';')

    return '\n'.join(result)

# Replace large INSERT statements with split versions
optimized_content = re.sub(insert_pattern, split_insert, content, flags=re.MULTILINE | re.DOTALL)

with open(output_file, 'w') as f:
    f.write(optimized_content)

print(f"Optimized SQL written to {output_file}")
PYTHON_SCRIPT

    # Replace original with optimized version
    if [ -f "$SQL_FILE.optimized" ]; then
        mv "$SQL_FILE.optimized" "$SQL_FILE"
        echo -e "${GREEN}SQL file optimized for D1 compatibility${NC}"
    fi

    # Check SQL file size
    SQL_SIZE=$(du -h "$SQL_FILE" | cut -f1)
    SQL_SIZE_BYTES=$(stat -f%z "$SQL_FILE" 2>/dev/null || stat -c%s "$SQL_FILE" 2>/dev/null)
    SQL_SIZE_MB=$(echo "scale=2; $SQL_SIZE_BYTES / 1048576" | bc)

    echo -e "SQL file size: ${YELLOW}${SQL_SIZE}${NC} (${SQL_SIZE_MB}MB)"

    # Warn if file is very large
    if (( $(echo "$SQL_SIZE_MB > 500" | bc -l) )); then
        echo -e "${YELLOW}Warning: SQL file is quite large (${SQL_SIZE_MB}MB).${NC}"
        echo -e "${YELLOW}Cloudflare D1 API may have size limits that could cause upload failures.${NC}"
        echo -e "${YELLOW}If upload fails, you may need to use Cloudflare's dashboard import or API.${NC}"

        if [[ "$AUTO_APPROVE" == false ]]; then
            echo -e "\n${YELLOW}Do you want to continue? (y/n)${NC}"
            read -r CONTINUE_CONFIRM
            if [[ ! "$CONTINUE_CONFIRM" =~ ^[Yy]$ ]]; then
                echo -e "${YELLOW}Upload cancelled. SQL file saved to: $SQL_FILE${NC}"
                exit 0
            fi
        else
            echo -e "${GREEN}Auto-approve enabled, continuing...${NC}"
        fi
    fi

    echo -e "${GREEN}Uploading to Cloudflare D1 (this may take a while)...${NC}"

    # Split the SQL file into chunks to avoid memory limits
    # D1 can handle ~5000-10000 queries per upload safely
    echo -e "${YELLOW}Splitting SQL file into uploadable chunks...${NC}"

    CHUNK_DIR="$DATA_DIR/db_chunks"
    rm -rf "$CHUNK_DIR"
    mkdir -p "$CHUNK_DIR"

    # Export variables for Python script
    export SQL_FILE
    export CHUNK_DIR

    # Split the SQL file - separate schema from data
    python3 << 'PYTHON_SPLIT'
import os
import re

sql_file = os.environ.get('SQL_FILE')
chunk_dir = os.environ.get('CHUNK_DIR')

with open(sql_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Split by semicolons to get individual SQL statements
# This handles multi-line statements properly
statements = []
current_statement = []

for line in content.split('\n'):
    # Skip empty lines and comments
    if line.strip() == '' or line.strip().startswith('--'):
        continue

    current_statement.append(line)

    # Check if this line ends with a semicolon (end of statement)
    if line.rstrip().endswith(';'):
        statements.append('\n'.join(current_statement) + '\n')
        current_statement = []

# Add any remaining statement
if current_statement:
    statements.append('\n'.join(current_statement) + '\n')

# Separate CREATE statements from INSERT statements
create_statements = [s for s in statements if s.strip().startswith('CREATE')]
insert_statements = [s for s in statements if s.strip().startswith('INSERT')]

print(f"Found {len(create_statements)} CREATE statements")
print(f"Found {len(insert_statements)} INSERT statements")

# Write schema file (CREATE statements)
if create_statements:
    with open(os.path.join(chunk_dir, '00_schema.sql'), 'w', encoding='utf-8') as f:
        for stmt in create_statements:
            f.write(stmt)
    print(f"Created schema file: 00_schema.sql ({len(create_statements)} statements)")

# Split INSERT statements into chunks of 5000
chunk_size = 5000
num_chunks = (len(insert_statements) + chunk_size - 1) // chunk_size

for i in range(num_chunks):
    start = i * chunk_size
    end = min((i + 1) * chunk_size, len(insert_statements))
    chunk_file = os.path.join(chunk_dir, f'{i+1:02d}_data.sql')

    with open(chunk_file, 'w', encoding='utf-8') as f:
        for stmt in insert_statements[start:end]:
            f.write(stmt)

    print(f"Created chunk {i+1}/{num_chunks}: {os.path.basename(chunk_file)} ({end - start} statements)")

print(f"Total chunks created: {num_chunks + 1}")
PYTHON_SPLIT

    # Upload chunks sequentially
    cd "$SCRIPT_DIR/.."

    CHUNK_FILES=("$CHUNK_DIR"/*.sql)
    TOTAL_CHUNKS=${#CHUNK_FILES[@]}
    CURRENT_CHUNK=0

    echo -e "\n${GREEN}Uploading ${TOTAL_CHUNKS} chunks to Cloudflare D1...${NC}"

    for chunk_file in "${CHUNK_FILES[@]}"; do
        CURRENT_CHUNK=$((CURRENT_CHUNK + 1))
        CHUNK_NAME=$(basename "$chunk_file")

        echo -e "\n${YELLOW}[$CURRENT_CHUNK/$TOTAL_CHUNKS] Uploading $CHUNK_NAME...${NC}"

        if bunx wrangler d1 execute "$D1_DATABASE_NAME" --remote --file="$chunk_file"; then
            echo -e "${GREEN}✓ $CHUNK_NAME uploaded successfully${NC}"
        else
            echo -e "${RED}✗ Failed to upload $CHUNK_NAME${NC}"
            echo -e "${YELLOW}Chunks saved in: $CHUNK_DIR${NC}"
            echo -e "${YELLOW}You can retry from chunk $CURRENT_CHUNK by running:${NC}"
            echo -e "  bunx wrangler d1 execute $D1_DATABASE_NAME --remote --file=$chunk_file"
            exit 1
        fi

        # Small delay between uploads to avoid rate limiting
        sleep 1
    done

    echo -e "\n${GREEN}Successfully uploaded all chunks to Cloudflare D1!${NC}"
    echo -e "Database: ${YELLOW}$D1_DATABASE_NAME${NC}"
    echo -e "Database ID: ${YELLOW}$D1_DATABASE_ID${NC}"

    # Clean up
    echo -e "${YELLOW}Cleaning up temporary files...${NC}"
    rm -rf "$CHUNK_DIR"
    rm "$SQL_FILE"

    echo -e "${GREEN}Upload complete!${NC}"
else
    echo -e "${YELLOW}Skipping upload. To upload later, run:${NC}"
    echo -e "  ./tooling/upload_db_to_cloudflare.sh -y    # Auto-approve all prompts"
    echo -e "  ./tooling/upload_db_to_cloudflare.sh       # Interactive mode"
fi

echo -e "\n${GREEN}Done!${NC}"
