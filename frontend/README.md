# LAION Dataset Explorer

Tooling for visualizing and exploring scientific papers from the LAION dataset using embeddings, dimensionality reduction, and clustering.

## Overview

This project processes scientific paper data through a complete pipeline:

1. **Filtering** - Removes non-scientific content and failed extractions
2. **Embedding** - Generates 768D semantic embeddings using SPECTER2
3. **Dimensionality Reduction** - Uses UMAP to project embeddings to 2D
4. **Clustering** - Applies K-Means clustering with automatic optimization
5. **Label Generation** - Creates descriptive cluster labels using TF-IDF

## Requirements

Install dependencies:

```bash
pip install -r requirements.txt
```

## Quick Start

**[IMPORTANT]:** First, you need to download the LAION dataset with `rclone` and store it in the `data/` directory.

### Regenerate Database from Scratch

The easiest way to rebuild the entire database:

```bash
# Use full dataset (default)
./tooling/regenerate_db.sh

# Use first 1000 rows for testing
./tooling/regenerate_db.sh --num-rows 1000

# Use custom output path
./tooling/regenerate_db.sh --output data/custom.sqlite
```

This script will:

1. Delete the existing database
2. Build a new database from the parquet file
3. Generate embeddings for all papers
4. Compute UMAP coordinates and K-Means clusters

**Options:**

- `--num-rows N` - Limit to first N rows from parquet (useful for testing)
- `--input PATH` - Use custom parquet file (default: `data/full.parquet`)
- `--output PATH` - Custom output database path (default: `data/db.sqlite`)

### Examples

```bash
# Quick test with 500 papers
./tooling/regenerate_db.sh --num-rows 500

# Full dataset with custom paths
./tooling/regenerate_db.sh --input data/custom.parquet --output data/custom.sqlite
```

## Web Application

Interactive visualization tool for exploring paper clusters with a React frontend and FastAPI backend.

### Running the Web App

**1. Start the API server:**

```bash
bun run python:install
bun run api
```

The API will be available at `http://localhost:8000`. View auto-generated docs at `http://localhost:8000/docs`.

**2. Start the frontend (in a new terminal):**

```bash
bun run dev
```

The app will be available at `http://localhost:5173`.

## Individual Scripts

### 1. Build Database

Creates the SQLite database from a parquet file, filtering out non-scientific content:

```bash
# Use full dataset (default)
python tooling/build_db.py

# Use first 1000 rows for testing
python tooling/build_db.py --num-rows 1000

# Use custom parquet file
python tooling/build_db.py --input data/custom.parquet --output data/db.sqlite
```

**What it does:**

- Filters out papers classified as `NON_SCIENTIFIC_TEXT`
- Removes papers that failed to summarize
- Extracts `title`, `publication_year`, `field_subfield`, and `classification` as separate columns
- Retains full `summarization` JSON

**Options:**

- `--input PATH` - Input parquet file (default: `data/full.parquet`)
- `--output PATH` - Output database path (default: `data/db.sqlite`)
- `--num-rows N` - Limit to first N rows (default: read all)

### 2. Generate Embeddings

Generates 768D semantic embeddings using SPECTER2:

```bash
# Basic usage
python tooling/embed.py --db data/db.sqlite

# Resume from interrupted run
python tooling/embed.py --db data/db.sqlite --resume

# Use GPU with larger batch size
python tooling/embed.py --db data/db.sqlite --batch-size 64 --device cuda
```

**What it does:**

- Uses the SPECTER2 model (`allenai/specter2_base`)
- Processes papers in batches (default: 32)
- Stores embeddings as binary blobs in the database
- Automatically detects and uses GPU if available
- Supports resuming from interrupted runs with `--resume`

**Performance Tips:**

- **GPU acceleration**: Use `--device cuda` for 3-5x speedup
- **Batch size**: Increase with `--batch-size 64` on GPU (default: 32 for CPU)
- **Resume interrupted runs**: Use `--resume` to skip already-embedded papers
- **Commit interval**: Adjust with `--commit-interval 500` for faster processing (default: 200)

### 3. Compute Visualization

Computes 2D coordinates and clusters:

```bash
python tooling/compute_visualization.py --db data/db.sqlite
```

**What it does:**

- **UMAP**: Reduces 768D embeddings to 2D using cosine distance
- **K-Means**: Automatically finds optimal cluster count (20-60) using silhouette scores
- **Labeling**: Generates cluster labels using TF-IDF on paper titles and fields
- Stores `x`, `y`, `cluster_id`, and `cluster_label` in the database

**Options:**

```bash
# Use a different clustering method
python tooling/compute_visualization.py --method dbscan

# Specify number of clusters manually
python tooling/compute_visualization.py --method kmeans --n-clusters 30

# Adjust UMAP parameters
python tooling/compute_visualization.py --n-neighbors 20 --min-dist 0.2
```

Available clustering methods:

- `kmeans` (default) - Fast, auto-optimizes cluster count
- `agglomerative` - Hierarchical clustering
- `dbscan` - Density-based clustering

### 4. Apply Claude-Curated Labels

While automated TF-IDF labeling provides data-driven cluster names, human-curated labels offer better interpretability. The `claude_label` column contains manually reviewed labels that are more descriptive and domain-appropriate.

> To generate these, run `claude` and instruct it to generate the labels for each cluster.

**Apply the curated labels:**

```bash
sqlite3 data/db.sqlite < tooling/update_claude_labels.sql
```

**What it does:**

- Updates the `claude_label` column for all 100 clusters
- Replaces generic automated labels with descriptive, domain-specific names
- Examples of improvements:
  - "Mol, Kcal Mol, Kcal" → "Computational Chemistry & Quantum Calculations"
  - "Cancer, Mir, Cell" → "Cancer Biology & microRNA"
  - "Infection, Covid, Clinical" → "COVID-19 Infection & Clinical Management"

**Creating new labels:**

See `tooling/ClaudeLabels.md` for the complete process of generating human-curated labels:

1. Sample papers from each cluster
2. Analyze common themes and terminology
3. Create descriptive 3-7 word labels using domain-specific terms
4. Update `tooling/update_claude_labels.sql` with new labels
5. Apply changes to the database

The frontend will automatically prefer `claude_label` over `cluster_label` when available.
