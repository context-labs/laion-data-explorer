# Cloudflare Deployment Guide

This guide covers deploying the LAION frontend and Python API to Cloudflare Workers.

## Prerequisites

1. Install dependencies:

```bash
# Install Node.js packages
bun install

# Install Cloudflare Wrangler CLI
bun install -g wrangler

# Install uv for Python (required for Python Workers)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install pywrangler
cd api
uv tool install workers-py
```

2. Authenticate with Cloudflare:

```bash
wrangler login
```

3. Get your Account ID from the Cloudflare dashboard and update:
   - `wrangler.toml` (frontend)
   - `api/wrangler.toml` (API)

## Frontend Deployment

The frontend is a static Vite app that will be deployed to Cloudflare Pages/Workers.

### Option 1: Cloudflare Pages (Recommended)

```bash
# Build the frontend
bun run build

# Deploy to Pages
wrangler pages deploy dist --project-name=laion-dataset-explorer
```

### Option 2: Workers Sites

```bash
# Build and deploy
bun run build
wrangler deploy
```

### Configuration

Update `wrangler.toml` with:

- Your `account_id`
- API URL in vars section (once API is deployed)

## API Deployment (Python Worker)

The Python API requires some modifications to work with Cloudflare Workers:

### Important Notes

⚠️ **The current FastAPI app needs significant modifications to work on Cloudflare Workers:**

1. **Database**: Replace SQLite with Cloudflare D1

   - SQLite files don't work in Workers
   - Migrate to D1 (Cloudflare's serverless SQLite)
   - See: https://developers.cloudflare.com/d1/

2. **File Storage**: Replace local cache files with R2

   - Workers don't have persistent filesystem
   - Use Cloudflare R2 for storing cache files
   - See: https://developers.cloudflare.com/r2/

3. **FastAPI Integration**: The current ASGI app needs adaptation
   - Workers use a fetch handler, not ASGI
   - You may need to rewrite endpoints or use an adapter

### Setup Steps

```bash
cd api

# Initialize uv and install dependencies
uv init
uv tool install workers-py
uv sync

# Initialize Python Worker config (if needed)
uv run pywrangler init
```

### Create D1 Database

```bash
# Create D1 database
wrangler d1 create laion-db

# Update api/wrangler.toml with the database ID
# Then migrate your schema:
wrangler d1 execute laion-db --file=./schema.sql
```

### Create R2 Bucket

```bash
# Create R2 bucket for data storage
wrangler r2 bucket create laion-data

# Upload your database and cache files
wrangler r2 object put laion-data/db.sqlite --file=../data/db.sqlite
```

### Create KV Namespace (Optional)

```bash
# For caching API responses
wrangler kv:namespace create "CACHE_KV"

# Update api/wrangler.toml with the namespace ID
```

### Deploy

```bash
# Development
cd api
uv run pywrangler dev

# Production
uv run pywrangler deploy
```

## Environment Variables

### Frontend

The frontend uses the `VITE_API_URL` environment variable to configure the API endpoint.

For **local development**, the default is `/api` which uses the Vite proxy configured in `vite.config.ts`.

For **production deployment**, set `VITE_API_URL` to your API URL. You can do this by:

1. Creating a `.env.production` file:

```bash
VITE_API_URL=https://laion-dataset-explorer-api.YOUR_SUBDOMAIN.workers.dev/api
```

2. Or pass it during build:

```bash
VITE_API_URL=https://your-api-url.com/api bun run build
```

The build process will inline this value during compilation.

### API

Update `api/wrangler.toml`:

```toml
[vars]
# Add any environment variables your API needs
ENVIRONMENT = "production"
```

## Testing Deployment

### Frontend

```bash
# Local preview
bun run build
wrangler pages dev dist

# Visit http://localhost:8788
```

### Building

1. Run `bun run tsc` **in the root of the repository** to build the TypeScript code.
2. Run `bun run build` in this directory to build the frontend.

### Deploying frontend to cloudflare

Run `bun run deploy:frontend` to deploy the frontend to Cloudflare Pages.
