# LAION Science Dataset Explorer

Interactive visualization and exploration of scientific papers from the LAION open science dataset.

This project is a collaboration between [Inference.net](https://inference.net) and [LAION](https://laion.ai). LAION curated the original dataset which is about ~100m scrapped scientific and research articles and Inference.net fine-tuned a custom model to extract structured summaries from the articles. This repo contains a visual explorer for a small subset of the extracted dataset.

View the live explorer at [https://laion.inference.net](https://laion.inference.net).

## Overview

A web application for exploring scientific papers with semantic embeddings, dimensionality reduction, and clustering visualizations.

## Architecture

- **Frontend**: React + TypeScript + Vite with D3.js for interactive visualizations
- **Backend**: Python FastAPI serving data from SQLite (D1 in production)
- **Storage**: SQLite locally, Cloudflare D1 + R2 in production

## Prerequisites

You'll need the following tools installed:

- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **uv** - Python dependency management - [Install](https://docs.astral.sh/uv/getting-started/installation/)
- **bun** - JavaScript runtime - [Install](https://bun.sh/)
- **Task** - Task runner - [Install](https://taskfile.dev/installation/)

## Setup

Install all dependencies:

```bash
task setup
```

This will install both backend and frontend dependencies.

## Quick Start

### 1. Get the Database

Download the database from R2:

```bash
task db:setup
```

This will download the SQLite database to `backend/data/db.sqlite`.

### 2. Run the Application

Run the backend and frontend in separate terminals:

**Backend (Terminal 1):**

```bash
task backend:dev
```

**Frontend (Terminal 2):**

```bash
task frontend:dev
```

The application will be available at:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`
- API Docs: `http://localhost:8787/docs`

## Data Pipeline

> The code for the data pipeline that we used to construct this dataset is not yet open source, mostly because it was setup for a one-time process and not production-ready.

However, the general process was:

1. Initial data extraction and filtering

- Ran a pipeline to generate the summaries
- Excluded specific non-scientific content and failed summaries
- Compiled results for further processing

2. Semantic Embedding

- Generates 768-dimensional embeddings using SPECTER2 (allenai/specter2_base)
- Processes papers in batches with GPU acceleration support
- Stores embeddings as binary blobs for similarity search

3. Visualization & Clustering

- Reduces embeddings to 2D coordinates using UMAP with cosine distance
- Applies K-Means clustering with automatic optimization (20-60 clusters via silhouette scores)
- Generates initial cluster labels using TF-IDF analysis of titles and fields

4. LLM-Curated Labels

- Applies manually reviewed, domain-specific cluster labels
- Improves interpretability over automated TF-IDF labels

## Deployment

Deploy to Cloudflare:

```bash
task deploy
```

This will prompt you to deploy the backend API and/or frontend.

## Contributing

We welcome contributions to this project! Here's what you should know:

**Bug Fixes & Minor Improvements**

- Bug fixes are always welcome! Please submit a PR with a clear description of the issue and fix.
- Minor improvements to documentation, code quality, or performance are appreciated.

**New Features**

- This project is intentionally scoped as a one-time preview of this dataset.
- We are generally not planning to greatly expand the functionality beyond its current scope.
- If you want to add significant new features, we encourage you to fork the project and build on it!

**Before Submitting a PR**

- Ensure your code passes linting and formatting checks:
  ```bash
  task check
  ```
- Keep changes focused and well-documented.
- Test your changes with sample data when applicable.

## License

MIT License - see [LICENSE](LICENSE) file for details.
