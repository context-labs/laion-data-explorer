#!/bin/bash
#
# Regenerate the database from scratch
#
# This script:
# 1. Deletes the existing database
# 2. Builds a new database from the parquet file
# 3. Generates embeddings for all papers
# 4. Computes UMAP coordinates and clusters
#
# Usage:
#   ./tooling/regenerate_db.sh [--num-rows NUM_ROWS] [--input INPUT_PARQUET] [--output OUTPUT_DB]
#
# Default input: data/full.parquet
# Default output: data/db.sqlite
#

set -e  # Exit on error

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
INPUT_PARQUET="${PROJECT_ROOT}/data/full.parquet"
OUTPUT_DB="${PROJECT_ROOT}/data/db.sqlite"
NUM_ROWS=""
BUILD_ARGS=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --num-rows)
            NUM_ROWS="$2"
            shift 2
            ;;
        --input)
            INPUT_PARQUET="$2"
            shift 2
            ;;
        --output)
            OUTPUT_DB="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --num-rows Number of rows to read from parquet (default: read all)"
            echo "  --input    Path to input parquet file (default: data/full.parquet)"
            echo "  --output   Path to output database (default: data/db.sqlite)"
            echo "  --help     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                 # Use full dataset"
            echo "  $0 --num-rows 1000                 # Use first 1000 rows"
            echo "  $0 --input custom.parquet          # Use custom file"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Build arguments for build_db.py
BUILD_ARGS="--input $INPUT_PARQUET --output $OUTPUT_DB"
if [[ -n "$NUM_ROWS" ]]; then
    BUILD_ARGS="$BUILD_ARGS --num-rows $NUM_ROWS"
fi

echo "=========================================="
echo "Database Regeneration Script"
echo "=========================================="
echo "Input:  $INPUT_PARQUET"
echo "Output: $OUTPUT_DB"
if [[ -n "$NUM_ROWS" ]]; then
    echo "Rows:   $NUM_ROWS (limited)"
else
    echo "Rows:   All"
fi
echo ""

# Step 1: Delete existing database
if [ -f "$OUTPUT_DB" ]; then
    echo "[Step 1/4] Deleting existing database..."
    rm "$OUTPUT_DB"
    echo "  ✓ Deleted: $OUTPUT_DB"
else
    echo "[Step 1/4] No existing database to delete"
fi
echo ""

# Step 2: Build database from parquet
echo "[Step 2/4] Building database from parquet..."
python3 "$SCRIPT_DIR/build_db.py" $BUILD_ARGS
if [ $? -ne 0 ]; then
    echo "  ✗ Error: Failed to build database"
    exit 1
fi
echo "  ✓ Database built successfully"
echo ""

# Step 3: Generate embeddings
echo "[Step 3/4] Generating embeddings..."
python3 "$SCRIPT_DIR/embed.py" --db "$OUTPUT_DB"
if [ $? -ne 0 ]; then
    echo "  ✗ Error: Failed to generate embeddings"
    exit 1
fi
echo "  ✓ Embeddings generated successfully"
echo ""

# Step 4: Compute visualization coordinates and clusters
echo "[Step 4/4] Computing visualization data (UMAP + K-Means clustering)..."
python3 "$SCRIPT_DIR/compute_visualization.py" --db "$OUTPUT_DB"
if [ $? -ne 0 ]; then
    echo "  ✗ Error: Failed to compute visualization data"
    exit 1
fi
echo "  ✓ Visualization data computed successfully"
echo ""

# Summary
echo "=========================================="
echo "Database regeneration complete!"
echo "=========================================="
echo ""
echo "Database ready at: $OUTPUT_DB"
echo ""
echo "Next steps:"
echo "  - Run the API server to visualize the data"
echo "  - Query the database directly with sqlite3"
echo ""
