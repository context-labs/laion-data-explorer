#!/usr/bin/env python3
"""Cache data assets from the LAION API for R2 distribution.

This script fetches data from the locally running API and saves compressed
versions to disk for uploading to R2. The cached files can be served directly
to the frontend, bypassing the API.
"""

import gzip
import sys
from pathlib import Path

import requests

# Configuration
API_BASE_URL = "http://localhost:8787"
DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT_FILES = {
    "papers": DATA_DIR / "cache-papers.gz",
    "clusters": DATA_DIR / "cache-clusters.gz",
}


def cache_papers() -> bool:
    """Fetch and cache the papers dataset.

    The /api/papers endpoint already returns gzipped content, so we save it directly.

    Returns:
        bool: True if successful, False otherwise.
    """
    url = f"{API_BASE_URL}/api/papers"
    print(f"Fetching papers from {url}...")

    try:
        response = requests.get(url, timeout=300)  # 5 minute timeout for large dataset
        response.raise_for_status()

        # The response is already gzipped (application/octet-stream)
        compressed_content = response.content
        compressed_size = len(compressed_content)

        # Save directly to file
        output_path = OUTPUT_FILES["papers"]
        output_path.write_bytes(compressed_content)

        print(f"✓ Saved {compressed_size:,} bytes to {output_path}")
        print("  (Data is already compressed by the API)")

        return True

    except requests.exceptions.RequestException as e:
        print(f"✗ Error fetching papers: {e}", file=sys.stderr)
        return False
    except OSError as e:
        print(f"✗ Error writing papers cache: {e}", file=sys.stderr)
        return False


def cache_clusters() -> bool:
    """Fetch and cache the clusters dataset.

    The /api/clusters endpoint returns JSON, which we compress before saving.

    Returns:
        bool: True if successful, False otherwise.
    """
    url = f"{API_BASE_URL}/api/clusters"
    print(f"\nFetching clusters from {url}...")

    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()

        # Get JSON content
        json_content = response.text
        uncompressed_size = len(json_content.encode("utf-8"))

        # Compress the JSON
        compressed_content = gzip.compress(json_content.encode("utf-8"), compresslevel=6)
        compressed_size = len(compressed_content)
        compression_ratio = (compressed_size / uncompressed_size) * 100

        # Save to file
        output_path = OUTPUT_FILES["clusters"]
        output_path.write_bytes(compressed_content)

        print(f"✓ Saved {compressed_size:,} bytes to {output_path}")
        print(f"  Original: {uncompressed_size:,} bytes → Compressed: {compressed_size:,} bytes ({compression_ratio:.1f}%)")

        return True

    except requests.exceptions.RequestException as e:
        print(f"✗ Error fetching clusters: {e}", file=sys.stderr)
        return False
    except OSError as e:
        print(f"✗ Error writing clusters cache: {e}", file=sys.stderr)
        return False


def main():
    """Main entry point for the caching script."""
    print("=" * 60)
    print("LAION API Data Asset Caching")
    print("=" * 60)
    print()

    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Output directory: {DATA_DIR}\n")

    # Cache both endpoints
    success_papers = cache_papers()
    success_clusters = cache_clusters()

    # Summary
    print("\n" + "=" * 60)
    if success_papers and success_clusters:
        print("✓ All cache files generated successfully!")
        print("\nGenerated files:")
        for _key, path in OUTPUT_FILES.items():
            if path.exists():
                size = path.stat().st_size
                print(f"  - {path.name}: {size:,} bytes")
        print("\nThese files are ready to be uploaded to R2.")
        return 0
    else:
        print("✗ Some cache files failed to generate.")
        print("Please check the errors above and ensure the API server is running.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
