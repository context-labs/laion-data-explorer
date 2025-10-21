#!/bin/bash

# Script to upload cached data assets to Cloudflare R2
# This script uploads the pre-generated cache files to R2 for public distribution
#
# Prerequisites:
# - Run tooling/cache_data_assets.py first to generate the cache files
# - rclone must be installed (https://rclone.org/)
# - rclone.conf must be configured with R2 credentials
#
# Note: Cache-Control and Content-Type headers should be configured at the
# R2 bucket level via Cloudflare dashboard settings, not via upload headers

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$PROJECT_DIR/data"
RCLONE_CONFIG="$PROJECT_DIR/rclone.conf"

# R2 Configuration
R2_REMOTE="r2"
R2_BUCKET="laion-data-assets"

# Files to upload
CACHE_FILES=(
    "cache-papers.gz"
    "cache-clusters.gz"
)

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}LAION Data Assets R2 Upload${NC}"
echo -e "${GREEN}================================================${NC}\n"

# Check if rclone is installed
if ! command -v rclone &> /dev/null; then
    echo -e "${RED}Error: rclone is not installed!${NC}"
    echo -e "${YELLOW}Install rclone from: https://rclone.org/install/${NC}"
    echo -e "${YELLOW}Or on macOS: brew install rclone${NC}"
    exit 1
fi

echo -e "${BLUE}✓ rclone found: $(rclone version | head -1)${NC}\n"

# Check if rclone.conf exists
if [ ! -f "$RCLONE_CONFIG" ]; then
    echo -e "${RED}Error: rclone.conf not found at: $RCLONE_CONFIG${NC}"
    echo -e "${YELLOW}Please ensure rclone.conf is in the project root directory${NC}"
    exit 1
fi

echo -e "${BLUE}✓ Config found: $RCLONE_CONFIG${NC}\n"

# Check if all cache files exist
echo -e "${YELLOW}Checking cache files...${NC}"
MISSING_FILES=()

for file in "${CACHE_FILES[@]}"; do
    file_path="$DATA_DIR/$file"
    if [ ! -f "$file_path" ]; then
        MISSING_FILES+=("$file")
        echo -e "${RED}  ✗ Missing: $file${NC}"
    else
        file_size=$(du -h "$file_path" | cut -f1)
        echo -e "${GREEN}  ✓ Found: $file ($file_size)${NC}"
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo -e "\n${RED}Error: Missing cache files!${NC}"
    echo -e "${YELLOW}Run the caching script first:${NC}"
    echo -e "  python tooling/cache_data_assets.py"
    exit 1
fi

echo -e "\n${GREEN}All cache files found!${NC}\n"

# Ask for confirmation (unless --yes flag is provided)
AUTO_APPROVE=false
if [[ "$1" == "-y" ]] || [[ "$1" == "--yes" ]]; then
    AUTO_APPROVE=true
    echo -e "${GREEN}Auto-approve mode enabled${NC}\n"
fi

if [[ "$AUTO_APPROVE" == false ]]; then
    echo -e "${YELLOW}Upload ${#CACHE_FILES[@]} files to R2 bucket '${R2_BUCKET}'? (y/n)${NC}"
    read -r CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Upload cancelled.${NC}"
        exit 0
    fi
    echo ""
fi

# Upload each file to R2
echo -e "${GREEN}Uploading to R2...${NC}\n"

UPLOAD_COUNT=0
FAILED_UPLOADS=()

for file in "${CACHE_FILES[@]}"; do
    file_path="$DATA_DIR/$file"
    dest_path="$R2_REMOTE:$R2_BUCKET/$file"

    echo -e "${YELLOW}Uploading: $file${NC}"

    if rclone copy \
        --config "$RCLONE_CONFIG" \
        --progress \
        "$file_path" \
        "$R2_REMOTE:$R2_BUCKET/"; then

        echo -e "${GREEN}  ✓ Uploaded successfully${NC}\n"
        UPLOAD_COUNT=$((UPLOAD_COUNT + 1))
    else
        echo -e "${RED}  ✗ Upload failed${NC}\n"
        FAILED_UPLOADS+=("$file")
    fi
done

# Summary
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Upload Summary${NC}"
echo -e "${GREEN}================================================${NC}"
echo -e "Successful: ${GREEN}${UPLOAD_COUNT}/${#CACHE_FILES[@]}${NC}"

if [ ${#FAILED_UPLOADS[@]} -gt 0 ]; then
    echo -e "Failed: ${RED}${#FAILED_UPLOADS[@]}${NC}"
    echo -e "\n${RED}Failed files:${NC}"
    for file in "${FAILED_UPLOADS[@]}"; do
        echo -e "  - $file"
    done
    exit 1
else
    echo -e "\n${GREEN}✓ All files uploaded successfully!${NC}"
    echo -e "\n${BLUE}Files are now available at:${NC}"
    for file in "${CACHE_FILES[@]}"; do
        echo -e "  https://laion-data-assets.your-domain.com/$file"
    done
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo -e "${YELLOW}1. Configure R2 bucket public access and custom domain${NC}"
    echo -e "${YELLOW}2. Set Cache-Control headers in R2 bucket settings${NC}"
    echo -e "${YELLOW}   (e.g., public, max-age=3600 for 1 hour caching)${NC}"
fi

echo -e "\n${GREEN}Done!${NC}"
