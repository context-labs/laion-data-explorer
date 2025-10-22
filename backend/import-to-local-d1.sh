#!/bin/bash
# Script to set up local D1 database for development
# This copies your existing SQLite database to where Wrangler expects it

set -e

echo "Setting up local D1 database for development..."
echo ""

# Find the D1 database path (Wrangler stores it in .wrangler/state/v3/d1/miniflare-D1DatabaseObject/)
D1_DIR=".wrangler/state/v3/d1/miniflare-D1DatabaseObject"

if [ ! -d "$D1_DIR" ]; then
    echo "Error: D1 directory not found at $D1_DIR"
    echo "Please run 'task dev' first to initialize the D1 database, then run this script."
    exit 1
fi

# Find the actual .sqlite file in the directory
D1_DB_FILE=$(find "$D1_DIR" -name "*.sqlite" -type f | head -n 1)

if [ -z "$D1_DB_FILE" ]; then
    echo "Error: No .sqlite file found in $D1_DIR"
    echo "Please run 'task dev' first to initialize the D1 database, then run this script."
    exit 1
fi

echo "Found local D1 database at: $D1_DB_FILE"
echo "Copying data/db.sqlite to replace it..."
echo ""

# Backup the existing database first
if [ -f "$D1_DB_FILE" ]; then
    echo "Creating backup: ${D1_DB_FILE}.backup"
    cp "$D1_DB_FILE" "${D1_DB_FILE}.backup"
fi

# Copy our database
cp data/db.sqlite "$D1_DB_FILE"

echo ""
echo "✓ Database copied successfully!"
echo ""
echo "You can now run: task dev"
echo ""
echo "Note: The local D1 database is stored at: $D1_DB_FILE"
echo "If you need to reset it, just delete that file and run 'task dev' again to recreate it."
