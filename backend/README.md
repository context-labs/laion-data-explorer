## Running locally

```bash
task dev
```

## Deploying

```bash
task deploy
```

## R2 Caching (Production)

The API can serve cached data from R2 in production to reduce database load. This is particularly useful for the full dataset endpoints (`/api/papers` and `/api/clusters`).

### Setting up R2 cache

1. **Generate cache files locally:**

   ```bash
   # Make sure your local API is running (task dev)
   python tooling/cache_data_assets.py
   ```

2. **Upload to R2:**

   ```bash
   ./tooling/update_data_assets.sh -y
   ```

3. **Configure Cloudflare Worker:**
   Add the `R2_ASSETS_URL` environment variable in your `wrangler.toml`:

   ```toml
   [env.production.vars]
   R2_ASSETS_URL = "https://laion-data-assets.inference.net"
   ```

   Or set it via Cloudflare Dashboard:

   - Go to Workers & Pages > Your Worker > Settings > Variables
   - Add environment variable: `R2_ASSETS_URL` = `https://your-r2-bucket-url.com`

4. **Configure R2 bucket:**
   - Enable public access on your R2 bucket
   - Set up a custom domain for the bucket
   - Configure CORS if needed

### How it works

- **With R2_ASSETS_URL set:** The API fetches `/api/papers` and `/api/clusters` from R2 cache using the native Workers fetch API
- **Without R2_ASSETS_URL:** The API falls back to querying the D1 database
- Filtered requests (e.g., `?cluster_id=5`) always use the database
- Search and other endpoints continue to use the database
- The implementation uses Cloudflare Workers' native JavaScript `fetch` API via Pyodide's `js` module for maximum compatibility

This provides fast response times for the full dataset while maintaining flexibility for filtered queries.

## Cloudflare Links

- Logs: https://dash.cloudflare.com/b0c6d69f10b59b4d5b3a1a6d882d95ba/workers/services/view/laion-api/production/observability/logs?workers-observability-view=events
