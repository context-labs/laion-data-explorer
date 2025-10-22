"""FastAPI server for paper visualization."""

import gzip
import json
import logging
import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from workers import WorkerEntrypoint

from models import (
    ClusterInfo,
    ClustersResponse,
    ClusterTemporalData,
    PaperDetail,
    PaperSummary,
    PapersResponse,
    TemporalDataPoint,
    TemporalDataResponse,
)

# Configure logging
# Note: In Cloudflare Workers, all logs go to stderr and show as errors in wrangler
# Set to WARNING to reduce log noise, or INFO for detailed performance metrics
logging.basicConfig(
    level=logging.INFO,  # Changed to INFO for debugging database connection
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LAION Paper Visualizer API",
    description="API for exploring scientific papers with embeddings and clusters",
    version="1.0.0",
)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now
    allow_credentials=False,  # Must be False when using wildcard
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database path - try multiple locations for robustness
# First, check if we're in local dev mode using an environment variable
DB_PATH = None
local_db_path = os.environ.get("LOCAL_DB_PATH")

if local_db_path:
    # Use explicitly configured path for local development
    DB_PATH = Path(local_db_path)
    logger.info(f"Using LOCAL_DB_PATH: {DB_PATH.resolve()}")
else:
    # Try relative to the worker file
    DB_PATH = Path(__file__).parent.parent / "data" / "db.sqlite"
    if not DB_PATH.exists():
        logger.warning(
            f"DB not found at {DB_PATH.resolve()}, trying backend/data/db.sqlite"
        )
        # Try relative to current working directory
        DB_PATH = Path("backend/data/db.sqlite")
    if not DB_PATH.exists():
        logger.warning(f"DB not found at {DB_PATH.resolve()}, trying data/db.sqlite")
        # Try just data/db.sqlite (when cwd is backend/)
        DB_PATH = Path("data/db.sqlite")

logger.info(f"Using database at: {DB_PATH.resolve()} (exists: {DB_PATH.exists()})")
CACHE_TTL_SECONDS = 5


@app.middleware("http")
async def apply_cache_headers(request: Request, call_next):
    """Apply short-lived caching so browsers and Cloudflare cache responses."""
    response = await call_next(request)
    cache_control_value = f"public, max-age={CACHE_TTL_SECONDS}"
    response.headers["Cache-Control"] = cache_control_value
    response.headers["CDN-Cache-Control"] = cache_control_value
    response.headers["Surrogate-Control"] = cache_control_value

    # Ensure compressed responses vary correctly for downstream caches.
    if "Vary" in response.headers:
        if "accept-encoding" not in response.headers["Vary"].lower():
            response.headers["Vary"] = f"{response.headers['Vary']}, Accept-Encoding"
    else:
        response.headers["Vary"] = "Accept-Encoding"

    return response


@app.exception_handler(Exception)
async def handle_uncaught_exceptions(request: Request, exc: Exception) -> JSONResponse:
    """Log uncaught exceptions and return a generic error response."""
    import asyncio

    if isinstance(exc, HTTPException):
        headers = getattr(exc, "headers", None)
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=headers if headers is not None else None,
        )

    # Suppress InvalidStateError - it's a harmless ASGI adapter issue
    # that occurs after responses are already sent successfully
    if isinstance(exc, asyncio.InvalidStateError):
        return JSONResponse(
            status_code=200,
            content={"detail": "OK"},
        )

    logger.exception(
        "Unhandled error during request %s %s", request.method, request.url
    )

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )


def _normalize_params(params: Optional[Sequence[Any]]) -> Sequence[Any]:
    """Ensure query parameters are always a tuple."""
    if params is None:
        return ()
    if isinstance(params, tuple):
        return params
    if isinstance(params, list):
        return tuple(params)
    return (params,)


class BaseDatabase:
    async def fetch_all(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError

    async def fetch_one(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> Optional[Dict[str, Any]]:
        raise NotImplementedError


class SqliteDatabase(BaseDatabase):
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        logger.info(f"SqliteDatabase initialized with path: {self.db_path.resolve()}")
        logger.info(f"Database file exists: {self.db_path.exists()}")

    async def fetch_all(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> List[Dict[str, Any]]:
        params = _normalize_params(params)
        try:
            with sqlite3.connect(str(self.db_path)) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute(query, params)
                rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.OperationalError as e:
            logger.error(
                f"SQLite error with db_path={self.db_path.resolve()}, exists={self.db_path.exists()}: {e}"
            )
            raise

    async def fetch_one(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> Optional[Dict[str, Any]]:
        params = _normalize_params(params)
        try:
            with sqlite3.connect(str(self.db_path)) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute(query, params)
                row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.OperationalError as e:
            logger.error(
                f"SQLite error with db_path={self.db_path.resolve()}, exists={self.db_path.exists()}: {e}"
            )
            raise


class D1Database(BaseDatabase):
    def __init__(self, binding: Any) -> None:
        self.binding = binding

    def _convert_row(self, row: Any) -> Dict[str, Any]:
        """Convert a D1 row (JsProxy) to a Python dict, handling null values."""
        result = {}
        for key, value in row.object_entries():
            # Convert JavaScript null to Python None
            # Check type name as JsNull doesn't work well with isinstance
            type_name = type(value).__name__
            if value is None or type_name == "JsNull":
                result[key] = None
            else:
                result[key] = value
        return result

    async def fetch_all(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> List[Dict[str, Any]]:
        params = _normalize_params(params)
        statement = self.binding.prepare(query)
        if params:
            statement = statement.bind(*params)
        result = await statement.all()
        # Convert JsProxy objects to Python dicts
        return [self._convert_row(row) for row in result.results]

    async def fetch_one(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> Optional[Dict[str, Any]]:
        params = _normalize_params(params)
        statement = self.binding.prepare(query)
        if params:
            statement = statement.bind(*params)
        result = await statement.first()
        # Convert JsProxy object to Python dict
        if result is None:
            return None
        return self._convert_row(result)


def get_database(request: Optional[Request] = None) -> BaseDatabase:
    """Return an appropriate database client for the current environment."""
    if request is not None:
        env = request.scope.get("env")
        if env is not None:
            binding = getattr(env, "LAION_DB", None) or getattr(env, "DB", None)
            if binding is not None:
                logger.info("Using D1 database binding")
                return D1Database(binding)
    logger.info(f"Using SQLite database at: {DB_PATH.resolve()}")
    return SqliteDatabase(DB_PATH)


# Predefined color palette for clusters (pastel theme)
CLUSTER_COLORS = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
    "#aec7e8",
    "#ffbb78",
    "#98df8a",
    "#ff9896",
    "#c5b0d5",
    "#c49c94",
    "#f7b6d2",
    "#c7c7c7",
    "#dbdb8d",
    "#9edae5",
    "#393b79",
    "#637939",
    "#8c6d31",
    "#843c39",
    "#7b4173",
    "#5254a3",
    "#8ca252",
    "#bd9e39",
    "#ad494a",
    "#a55194",
]


def get_cluster_color(cluster_id: int) -> str:
    """Get consistent color for a cluster."""
    if cluster_id < 0:
        return "#E8E8E8"  # Light gray pastel for unclustered
    return CLUSTER_COLORS[cluster_id % len(CLUSTER_COLORS)]


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "LAION Paper Visualizer API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/api/papers")
async def get_papers(
    request: Request,
    cluster_id: Optional[int] = Query(None, description="Filter by cluster ID"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
    sample_size: Optional[int] = Query(
        None, description="Sample N most recent papers per cluster"
    ),
):
    """Get all papers with coordinates and cluster information (gzip compressed)."""
    start_time = time.time()

    # Check if R2 cache is available (production mode)
    # Only use R2 cache if no filters are applied (full dataset request)
    env = request.scope.get("env")
    r2_assets_url = getattr(env, "R2_ASSETS_URL", None) if env else None

    if r2_assets_url and cluster_id is None and limit is None and sample_size is None:
        # Fetch from R2 cache using native Workers fetch API
        logger.info(f"Fetching papers from R2: {r2_assets_url}")
        try:
            from js import fetch as js_fetch

            r2_url = f"{r2_assets_url}/cache-papers.gz"
            response = await js_fetch(r2_url)

            if not response.ok:
                raise Exception(f"R2 fetch failed with status {response.status}")

            # Get the response as bytes (arrayBuffer)
            array_buffer = await response.arrayBuffer()
            # Convert JavaScript ArrayBuffer to Python bytes
            content = bytes(array_buffer.to_py())

            # Return the gzipped content directly
            return Response(
                content=content,
                media_type="application/octet-stream",
                headers={"X-Content-Compressed": "gzip"},
            )
        except Exception as e:
            logger.warning(f"Failed to fetch from R2, falling back to database: {e}")
            # Fall through to database query

    db = get_database(request)

    # Query papers table directly
    # If sample_size is specified, use a subquery approach with GROUP BY and random sampling
    if sample_size is not None and cluster_id is None:
        query_start = time.time()

        # Use a simpler approach: get papers ordered by cluster and year,
        # then limit in Python (more efficient than N queries)
        # But ONLY fetch what we need with LIMIT
        max_clusters = 100
        max_fetch = sample_size * max_clusters  # Fetch at most this many total

        all_rows = await db.fetch_all(
            """
            SELECT id, title, x, y, z, cluster_id,
                   COALESCE(claude_label, cluster_label) as cluster_label,
                   field_subfield, publication_year, classification
            FROM papers
            WHERE x IS NOT NULL AND y IS NOT NULL AND cluster_id IS NOT NULL
            ORDER BY cluster_id, publication_year DESC, id DESC
            LIMIT ?
            """,
            (max_fetch,),
        )

        # Sample N papers per cluster in Python (fast since data is pre-sorted)
        cluster_samples = {}
        for row in all_rows:
            cid = row["cluster_id"]
            if cid not in cluster_samples:
                cluster_samples[cid] = []
            if len(cluster_samples[cid]) < sample_size:
                cluster_samples[cid].append(row)

        # Flatten back to a list
        rows = []
        for cid in sorted(cluster_samples.keys()):
            rows.extend(cluster_samples[cid])

        query_time = time.time() - query_start
        logger.info(
            f"DB Query (sample_size={sample_size}): {query_time:.3f}s, "
            f"fetched {len(all_rows)} rows, sampled {len(rows)} papers from {len(cluster_samples)} clusters"
        )
    else:
        # Original query for full data or single cluster
        query = """
            SELECT id, title, x, y, z, cluster_id,
                   COALESCE(claude_label, cluster_label) as cluster_label,
                   field_subfield, publication_year, classification
            FROM papers
            WHERE x IS NOT NULL AND y IS NOT NULL
        """
        params: List[Any] = []

        if cluster_id is not None:
            query += " AND cluster_id = ?"
            params.append(cluster_id)

        query += " ORDER BY id"

        if limit is not None:
            query += " LIMIT ?"
            params.append(limit)

        query_start = time.time()
        rows = await db.fetch_all(query, params)
        query_time = time.time() - query_start

        logger.info(
            f"DB Query (cluster_id={cluster_id}, limit={limit}): {query_time:.3f}s, "
            f"returned {len(rows)} papers"
        )

    papers = [
        PaperSummary(
            id=row["id"],
            title=row["title"],
            x=row["x"],
            y=row["y"],
            z=row["z"],
            cluster_id=row["cluster_id"],
            cluster_label=row["cluster_label"],
            field_subfield=row["field_subfield"],
            publication_year=row["publication_year"],
            classification=row["classification"],
        )
        for row in rows
    ]

    response_data = PapersResponse(papers=papers)

    # Compress the JSON response
    serialization_start = time.time()
    json_str = json.dumps(response_data.model_dump())
    serialization_time = time.time() - serialization_start

    compression_start = time.time()
    compressed_content = gzip.compress(json_str.encode("utf-8"), compresslevel=6)
    compression_time = time.time() - compression_start

    total_time = time.time() - start_time

    uncompressed_size = len(json_str.encode("utf-8"))
    compressed_size = len(compressed_content)
    compression_ratio = (compressed_size / uncompressed_size) * 100

    logger.info(
        f"Serialization: {serialization_time:.3f}s, "
        f"Compression: {compression_time:.3f}s, "
        f"Total: {total_time:.3f}s"
    )
    logger.info(
        f"Size: {uncompressed_size:,} -> {compressed_size:,} bytes "
        f"({compression_ratio:.1f}% compression)"
    )

    return Response(
        content=compressed_content,
        media_type="application/octet-stream",
        headers={"X-Content-Compressed": "gzip"},
    )


@app.get("/api/papers/{paper_id}", response_model=PaperDetail)
async def get_paper(paper_id: int, request: Request):
    """Get detailed information for a specific paper."""
    db = get_database(request)

    # Note: 'sample' column excluded from query (not available in D1)
    row = await db.fetch_one(
        """
        SELECT id, title, summarization, x, y, z, cluster_id,
               COALESCE(claude_label, cluster_label) as cluster_label,
               field_subfield, publication_year, classification
        FROM papers
        WHERE id = ?
    """,
        (paper_id,),
    )

    if not row:
        raise HTTPException(status_code=404, detail="Paper not found")

    return PaperDetail(
        id=row["id"],
        title=row["title"],
        sample=None,  # Excluded from query (not in D1)
        summarization=row["summarization"],
        x=row["x"],
        y=row["y"],
        z=row["z"],
        cluster_id=row["cluster_id"],
        cluster_label=row["cluster_label"],
        field_subfield=row["field_subfield"],
        publication_year=row["publication_year"],
        classification=row["classification"],
    )


@app.get("/api/clusters", response_model=ClustersResponse)
async def get_clusters(request: Request):
    """Get cluster statistics and colors."""
    start_time = time.time()

    # Check if R2 cache is available (production mode)
    env = request.scope.get("env")
    r2_assets_url = getattr(env, "R2_ASSETS_URL", None) if env else None

    if r2_assets_url:
        # Fetch from R2 cache using native Workers fetch API
        logger.info(f"Fetching clusters from R2: {r2_assets_url}")
        try:
            from js import fetch as js_fetch

            r2_url = f"{r2_assets_url}/cache-clusters.gz"
            response = await js_fetch(r2_url)

            if not response.ok:
                raise Exception(f"R2 fetch failed with status {response.status}")

            # Get the response as bytes (arrayBuffer)
            array_buffer = await response.arrayBuffer()
            # Convert JavaScript ArrayBuffer to Python bytes
            content = bytes(array_buffer.to_py())

            # Decompress and return as JSON
            decompressed = gzip.decompress(content)
            return JSONResponse(content=json.loads(decompressed))
        except Exception as e:
            logger.warning(f"Failed to fetch from R2, falling back to database: {e}")
            # Fall through to database query

    db = get_database(request)

    # Query papers table directly
    rows = await db.fetch_all(
        """
        SELECT cluster_id,
               COALESCE(claude_label, cluster_label) as cluster_label,
               COUNT(*) as count
        FROM papers
        WHERE cluster_id IS NOT NULL AND x IS NOT NULL
        GROUP BY cluster_id, COALESCE(claude_label, cluster_label)
        ORDER BY cluster_id
    """
    )

    clusters = [
        ClusterInfo(
            cluster_id=row["cluster_id"],
            cluster_label=row["cluster_label"],
            count=row["count"],
            color=get_cluster_color(row["cluster_id"]),
        )
        for row in rows
    ]

    total_time = time.time() - start_time
    logger.info(f"Generated clusters response in {total_time:.3f}s")

    return ClustersResponse(clusters=clusters)


@app.get("/api/search")
async def search_papers(
    request: Request,
    q: str = Query(..., description="Search query for title or field"),
    limit: int = Query(100, description="Maximum number of results"),
):
    """Search papers by title or field (gzip compressed)."""
    db = get_database(request)

    query = """
        SELECT id, title, x, y, z, cluster_id,
               COALESCE(claude_label, cluster_label) as cluster_label,
               field_subfield, publication_year, classification
        FROM papers
        WHERE x IS NOT NULL AND y IS NOT NULL
            AND (title LIKE ? OR field_subfield LIKE ?)
        ORDER BY id
        LIMIT ?
    """
    search_pattern = f"%{q}%"
    rows = await db.fetch_all(query, (search_pattern, search_pattern, limit))

    papers = [
        PaperSummary(
            id=row["id"],
            title=row["title"],
            x=row["x"],
            y=row["y"],
            z=row["z"],
            cluster_id=row["cluster_id"],
            cluster_label=row["cluster_label"],
            field_subfield=row["field_subfield"],
            publication_year=row["publication_year"],
            classification=row["classification"],
        )
        for row in rows
    ]

    response_data = PapersResponse(papers=papers)

    # Compress the JSON response
    json_str = json.dumps(response_data.model_dump())
    compressed_content = gzip.compress(json_str.encode("utf-8"), compresslevel=6)

    return Response(
        content=compressed_content,
        media_type="application/octet-stream",
        headers={"X-Content-Compressed": "gzip"},
    )


@app.get("/api/papers/{paper_id}/nearest", response_model=PapersResponse)
async def get_nearest_papers(
    request: Request,
    paper_id: int,
    limit: int = Query(15, description="Number of nearest papers to return"),
):
    """Get the nearest papers to a given paper based on Euclidean distance in embedding space."""
    db = get_database(request)

    # First get the target paper's coordinates
    target = await db.fetch_one(
        """
        SELECT x, y, z
        FROM papers
        WHERE id = ? AND x IS NOT NULL AND y IS NOT NULL
    """,
        (paper_id,),
    )

    if not target:
        raise HTTPException(
            status_code=404, detail="Paper not found or has no coordinates"
        )

    target_x, target_y, target_z = target["x"], target["y"], target["z"]
    target_z = target_z if target_z is not None else 0.0

    # Find nearest papers using Euclidean distance. SQLite doesn't include sqrt, so we sort on squared distance.
    rows = await db.fetch_all(
        """
        SELECT id, title, x, y, z, cluster_id,
               COALESCE(claude_label, cluster_label) as cluster_label,
               field_subfield, publication_year, classification,
               ((x - ?) * (x - ?) + (y - ?) * (y - ?) +
                (COALESCE(z, 0) - ?) * (COALESCE(z, 0) - ?)) as distance_sq
        FROM papers
        WHERE x IS NOT NULL AND y IS NOT NULL AND id != ?
        ORDER BY distance_sq
        LIMIT ?
    """,
        (
            target_x,
            target_x,
            target_y,
            target_y,
            target_z,
            target_z,
            paper_id,
            limit,
        ),
    )

    papers = [
        PaperSummary(
            id=row["id"],
            title=row["title"],
            x=row["x"],
            y=row["y"],
            z=row["z"],
            cluster_id=row["cluster_id"],
            cluster_label=row["cluster_label"],
            field_subfield=row["field_subfield"],
            publication_year=row["publication_year"],
            classification=row["classification"],
        )
        for row in rows
    ]

    return PapersResponse(papers=papers)


@app.get("/api/stats")
async def get_stats(request: Request):
    """Get overall statistics."""
    db = get_database(request)

    total_row = await db.fetch_one("SELECT COUNT(*) as total FROM papers")
    total = total_row["total"] if total_row else 0

    with_coords_row = await db.fetch_one(
        "SELECT COUNT(*) as with_coords FROM papers WHERE x IS NOT NULL"
    )
    with_coords = with_coords_row["with_coords"] if with_coords_row else 0

    num_clusters_row = await db.fetch_one(
        "SELECT COUNT(DISTINCT cluster_id) as num_clusters FROM papers WHERE cluster_id IS NOT NULL"
    )
    num_clusters = num_clusters_row["num_clusters"] if num_clusters_row else 0

    return {
        "total_papers": total,
        "papers_with_coordinates": with_coords,
        "num_clusters": num_clusters,
    }


@app.get("/api/temporal-data", response_model=TemporalDataResponse)
async def get_temporal_data(
    request: Request,
    min_year: int = Query(1990, description="Minimum publication year"),
    max_year: int = Query(2025, description="Maximum publication year"),
):
    """Get temporal evolution data showing paper counts per cluster per year."""
    db = get_database(request)

    rows = await db.fetch_all(
        """
        SELECT
            cluster_id,
            COALESCE(claude_label, cluster_label) as cluster_label,
            publication_year,
            COUNT(*) as count
        FROM papers
        WHERE cluster_id IS NOT NULL
            AND publication_year IS NOT NULL
            AND publication_year >= ?
            AND publication_year <= ?
        GROUP BY cluster_id, cluster_label, publication_year
        ORDER BY cluster_id, publication_year
    """,
        (min_year, max_year),
    )

    # Organize data by cluster
    cluster_data_map: Dict[int, Dict[str, Any]] = {}
    for row in rows:
        cluster_id = row["cluster_id"]
        cluster_label = row["cluster_label"]
        year = row["publication_year"]
        count = row["count"]

        if cluster_id not in cluster_data_map:
            cluster_data_map[cluster_id] = {
                "cluster_id": cluster_id,
                "cluster_label": cluster_label,
                "color": get_cluster_color(cluster_id),
                "temporal_data": [],
            }

        cluster_data_map[cluster_id]["temporal_data"].append(
            {"year": int(year), "count": count}
        )

    # Convert to list and create response objects
    clusters = [
        ClusterTemporalData(
            cluster_id=data["cluster_id"],
            cluster_label=data["cluster_label"],
            color=data["color"],
            temporal_data=[
                TemporalDataPoint(year=point["year"], count=point["count"])
                for point in data["temporal_data"]
            ],
        )
        for data in cluster_data_map.values()
    ]

    return TemporalDataResponse(clusters=clusters)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        import asgi

        return await asgi.fetch(app, request.js_object, self.env)
