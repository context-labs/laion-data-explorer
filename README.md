# LAION Dataset Explorer

Tooling for visualizing and exploring scientific papers from the LAION dataset using embeddings, dimensionality reduction, and clustering.

## Overview

This project processes scientific paper data through a complete pipeline:

1. **Filtering** - Removes non-scientific content and failed extractions
2. **Embedding** - Generates 768D semantic embeddings using SPECTER2
3. **Dimensionality Reduction** - Uses UMAP to project embeddings to 2D
4. **Clustering** - Applies K-Means clustering with automatic optimization
5. **Label Generation** - Creates descriptive cluster labels using TF-IDF

## Architecture

- **Frontend**: React + TypeScript + Vite with D3.js for interactive visualizations
- **Backend**: Python FastAPI serving data from SQLite (D1 in production)
- **Storage**: SQLite locally, Cloudflare D1 + R2 in production

## Prerequisites

### Backend
```bash
# Install uv for Python dependency management
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install Python dependencies
cd backend
uv sync
```

### Frontend
```bash
# Install Node.js packages
cd frontend
bun install
```

## Quick Start

### 1. Download the Dataset

**[IMPORTANT]:** First, download the LAION dataset with `rclone` and store it in the `data/` directory.

### 2. Generate Database

The easiest way to build the entire database:

```bash
# Use full dataset (default)
./backend/tooling/regenerate_db.sh

# Use first 1000 rows for testing
./backend/tooling/regenerate_db.sh --num-rows 1000

# Use custom output path
./backend/tooling/regenerate_db.sh --output data/custom.sqlite
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

### 3. Run the Application

**Start both frontend and backend:**

```bash
# From the root directory
task dev
```

Or run them separately:

**Backend (Terminal 1):**
```bash
cd backend
task dev
```

**Frontend (Terminal 2):**
```bash
cd frontend
bun run dev
```

The application will be available at:
- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

## Database Pipeline

### Individual Scripts

#### 1. Build Database

Creates the SQLite database from a parquet file, filtering out non-scientific content:

```bash
cd backend
python tooling/build_db.py

# With options
python tooling/build_db.py --num-rows 1000
python tooling/build_db.py --input data/custom.parquet --output data/db.sqlite
```

**What it does:**
- Filters out papers classified as `NON_SCIENTIFIC_TEXT`
- Removes papers that failed to summarize
- Extracts `title`, `publication_year`, `field_subfield`, and `classification` as separate columns
- Retains full `summarization` JSON

#### 2. Generate Embeddings

Generates 768D semantic embeddings using SPECTER2:

```bash
cd backend
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

**Performance Tips:**
- **GPU acceleration**: Use `--device cuda` for 3-5x speedup
- **Batch size**: Increase with `--batch-size 64` on GPU (default: 32 for CPU)
- **Resume interrupted runs**: Use `--resume` to skip already-embedded papers
- **Commit interval**: Adjust with `--commit-interval 500` for faster processing (default: 200)

#### 3. Compute Visualization

Computes 2D coordinates and clusters:

```bash
cd backend
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

#### 4. Apply Claude-Curated Labels

While automated TF-IDF labeling provides data-driven cluster names, human-curated labels offer better interpretability. The `claude_label` column contains manually reviewed labels that are more descriptive and domain-appropriate.

**Apply the curated labels:**

```bash
cd backend
sqlite3 data/db.sqlite < tooling/update_claude_labels.sql
```

**What it does:**
- Updates the `claude_label` column for all clusters
- Replaces generic automated labels with descriptive, domain-specific names
- Examples of improvements:
  - "Mol, Kcal Mol, Kcal" ’ "Computational Chemistry & Quantum Calculations"
  - "Cancer, Mir, Cell" ’ "Cancer Biology & microRNA"
  - "Infection, Covid, Clinical" ’ "COVID-19 Infection & Clinical Management"

**Creating new labels:**

Good cluster labels should:
- Be 3-7 words long
- Use domain-specific terminology
- Combine related concepts with "&" or "and"
- Avoid vague terms like "Studies," "Analysis," "Research"
- Be specific enough to distinguish from other clusters

See `backend/tooling/ClaudeLabels.md` for the complete process of generating human-curated labels.

## Deployment

### Cloudflare Deployment

#### Prerequisites

```bash
# Install Cloudflare Wrangler CLI
bun install -g wrangler

# Authenticate with Cloudflare
wrangler login
```

Get your Account ID from the Cloudflare dashboard and update:
- `frontend/wrangler.toml` (frontend)
- `backend/wrangler.toml` (API)

#### Frontend Deployment

```bash
# Build and deploy to Cloudflare Pages
cd frontend
bun run build
wrangler pages deploy dist --project-name=laion-dataset-explorer
```

Or use the deployment script:
```bash
cd frontend
bun run deploy:frontend
```

#### Backend Deployment

```bash
cd backend
task deploy
```

**Important Notes:**

The production deployment uses:
- **Cloudflare D1** for the database (SQLite doesn't work in Workers)
- **Cloudflare R2** for caching data assets
- **Python Worker** for the FastAPI application

#### R2 Caching (Production)

The API can serve cached data from R2 in production to reduce database load.

**Setting up R2 cache:**

1. **Generate cache files locally:**
   ```bash
   cd backend
   python tooling/cache_data_assets.py
   ```

2. **Upload to R2:**
   ```bash
   cd backend
   ./tooling/update_data_assets.sh -y
   ```

3. **Configure Cloudflare Worker:**
   Add the `R2_ASSETS_URL` environment variable in `backend/wrangler.toml`:
   ```toml
   [env.production.vars]
   R2_ASSETS_URL = "https://laion-data-assets.inference.net"
   ```

**How it works:**
- **With R2_ASSETS_URL set:** The API fetches `/api/papers` and `/api/clusters` from R2 cache
- **Without R2_ASSETS_URL:** The API falls back to querying the D1 database
- Filtered requests (e.g., `?cluster_id=5`) always use the database
- Search and other endpoints continue to use the database

#### Environment Variables

**Frontend:**

The frontend uses the `VITE_API_URL` environment variable to configure the API endpoint.

For **local development**, the default is `/api` which uses the Vite proxy configured in `vite.config.ts`.

For **production deployment**, set `VITE_API_URL` to your API URL:

```bash
# Create .env.production
VITE_API_URL=https://laion-dataset-explorer-api.YOUR_SUBDOMAIN.workers.dev/api
```

**Backend:**

Update `backend/wrangler.toml`:
```toml
[vars]
ENVIRONMENT = "production"
R2_ASSETS_URL = "https://your-r2-bucket-url.com"
```

## Project Structure

```
.
   frontend/              # React + Vite frontend
      src/
         components/   # React components
         types/        # TypeScript types
         LaionApp.tsx  # Main app component
      wrangler.toml     # Cloudflare Pages config

   backend/              # Python FastAPI backend
      api/             # API application
         main.py      # FastAPI routes
         models.py    # Data models
      tooling/         # Database pipeline scripts
         build_db.py
         embed.py
         compute_visualization.py
         regenerate_db.sh
         ClaudeLabels.md
      wrangler.toml    # Python Worker config

   data/                # Data directory (not in git)
      full.parquet     # LAION dataset
      db.sqlite        # Generated database

   Taskfile.yml         # Task runner configuration
```

## Development Tasks

This project uses [Task](https://taskfile.dev/) for common development tasks:

```bash
# Run frontend and backend together
task dev

# Deploy to Cloudflare
task deploy

# Run frontend only
cd frontend && bun run dev

# Run backend only
cd backend && task dev
```

## Links

- **Production**: [Your deployed URL]
- **API Documentation**: `http://localhost:8000/docs` (local)
- **Cloudflare Dashboard**: https://dash.cloudflare.com/

## License

[Your License Here]
