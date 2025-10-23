#!/bin/bash
set -e

# Download database from R2
R2_URL="https://laion-data-assets.inference.net/db.sqlite"
DB_PATH="data/db.sqlite"

echo "==> Downloading database from R2..."
echo "    Source: ${R2_URL}"
echo "    Target: ${DB_PATH}"

# Create data directory if it doesn't exist
mkdir -p data

# Download the database
curl -L -o "${DB_PATH}" "${R2_URL}"

echo "==> Database downloaded successfully!"
echo "    Location: ${DB_PATH}"
