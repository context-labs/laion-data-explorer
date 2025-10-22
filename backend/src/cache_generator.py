"""Generate and cache compressed API responses in SQLite tables."""

import json
import sqlite3
import time
from pathlib import Path

from models import ClusterInfo, ClustersResponse

# Paths
DB_PATH = Path(__file__).parent.parent / "data" / "db.sqlite"


def get_db():
    """Get database connection."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def initialize_cache_tables():
    """Create cache table if it doesn't exist."""
    print("Initializing cache table...")
    conn = get_db()
    cursor = conn.cursor()

    # Table for clusters cache (JSON format, small so no compression needed)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cache_clusters (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()
    print("  Cache table ready")


def get_cluster_color(cluster_id: int) -> str:
    """Get consistent color for a cluster (copied from main.py)."""
    cluster_colors = [
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
    if cluster_id < 0:
        return "#E8E8E8"  # Light gray pastel for unclustered
    return cluster_colors[cluster_id % len(cluster_colors)]


def generate_clusters_cache():
    """Generate cached response for clusters query and store in SQLite."""
    print("Generating cache for clusters...")
    start_time = time.time()

    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT cluster_id,
               COALESCE(claude_label, cluster_label) as cluster_label,
               COUNT(*) as count
        FROM papers
        WHERE cluster_id IS NOT NULL AND x IS NOT NULL
        GROUP BY cluster_id, COALESCE(claude_label, cluster_label)
        ORDER BY cluster_id
    """

    query_start = time.time()
    cursor.execute(query)
    rows = cursor.fetchall()
    query_time = time.time() - query_start
    print(f"  DB Query: {query_time:.3f}s, {len(rows)} clusters")

    clusters = [
        ClusterInfo(
            cluster_id=row["cluster_id"],
            cluster_label=row["cluster_label"],
            count=row["count"],
            color=get_cluster_color(row["cluster_id"]),
        )
        for row in rows
    ]

    response_data = ClustersResponse(clusters=clusters)

    # Serialize to JSON (no compression needed for small payload)
    serialization_start = time.time()
    json_str = json.dumps(response_data.model_dump())
    serialization_time = time.time() - serialization_start
    print(f"  Serialization: {serialization_time:.3f}s")

    # Save to SQLite cache table
    save_start = time.time()
    cursor.execute(
        "INSERT OR REPLACE INTO cache_clusters (id, data, created_at) VALUES (1, ?, CURRENT_TIMESTAMP)",
        (json_str,),
    )
    conn.commit()
    save_time = time.time() - save_start
    print(f"  DB Write: {save_time:.3f}s")

    total_time = time.time() - start_time
    size = len(json_str.encode("utf-8"))

    print(f"  Total: {total_time:.3f}s")
    print(f"  Size: {size:,} bytes")
    print("  Saved to: cache_clusters table")

    conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("API Response Cache Generator")
    print("=" * 60)
    print()

    # Initialize cache table
    initialize_cache_tables()
    print()

    # Generate clusters cache
    generate_clusters_cache()
    print()

    print("✓ Cache generation complete!")
    print("✓ Cluster data stored in SQLite cache table")
