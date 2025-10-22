#!/usr/bin/env python3
"""
Pre-compute nearest neighbors for all papers based on their coordinates.

This script:
1. Loads all papers with coordinates (x, y, z) from the database
2. Computes Euclidean distances between all papers using vectorized numpy operations
3. For each paper, stores the IDs of the 15 nearest neighbors as a JSON array
4. Updates the `nearest_paper_ids` column in the papers table

This dramatically speeds up the /api/papers/{id}/nearest endpoint by avoiding
real-time distance calculations across ~89k papers.

Usage:
    python tooling/precompute_nearest.py [--db DB_PATH] [--num-nearest NUM]
"""

import argparse
import json
import sqlite3
from pathlib import Path

import numpy as np
from tqdm import tqdm


def load_paper_coordinates(db_path: str) -> tuple[list[int], np.ndarray]:
    """
    Load paper IDs and coordinates from database.

    Args:
        db_path: Path to SQLite database

    Returns:
        Tuple of (paper_ids, coordinates_matrix) where coordinates_matrix is Nx3
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Loading paper coordinates from database...")
    cursor.execute("""
        SELECT id, x, y, COALESCE(z, 0.0) as z
        FROM papers
        WHERE x IS NOT NULL AND y IS NOT NULL
        ORDER BY id
    """)

    rows = cursor.fetchall()
    conn.close()

    paper_ids = [row[0] for row in rows]
    coordinates = np.array([[row[1], row[2], row[3]] for row in rows], dtype=np.float32)

    print(f"Loaded {len(paper_ids)} papers with coordinates")
    return paper_ids, coordinates


def compute_nearest_neighbors_batched(
    paper_ids: list[int],
    coordinates: np.ndarray,
    num_nearest: int = 15,
    batch_size: int = 1000,
) -> dict[int, list[int]]:
    """
    Compute nearest neighbors for all papers using batched processing.

    Args:
        paper_ids: List of paper IDs
        coordinates: Nx3 numpy array of (x, y, z) coordinates
        num_nearest: Number of nearest neighbors to find
        batch_size: Number of papers to process at once

    Returns:
        Dictionary mapping paper_id to list of nearest paper IDs
    """
    n_papers = len(paper_ids)
    nearest_map = {}

    print(f"\nComputing nearest neighbors (k={num_nearest}) for {n_papers} papers...")
    print(f"Using batch size: {batch_size}")

    # Process in batches to manage memory
    for batch_start in tqdm(range(0, n_papers, batch_size), desc="Processing batches"):
        batch_end = min(batch_start + batch_size, n_papers)
        batch_coords = coordinates[batch_start:batch_end]  # Shape: (batch_size, 3)

        # Compute distances from batch to all papers using broadcasting
        # batch_coords[:, None, :] has shape (batch_size, 1, 3)
        # coordinates[None, :, :] has shape (1, n_papers, 3)
        # Subtraction broadcasts to (batch_size, n_papers, 3)
        diff = batch_coords[:, None, :] - coordinates[None, :, :]  # (batch_size, n_papers, 3)
        distances_sq = np.sum(diff**2, axis=2)  # (batch_size, n_papers)

        # For each paper in batch, find nearest neighbors
        for i, global_idx in enumerate(range(batch_start, batch_end)):
            paper_id = paper_ids[global_idx]
            dists = distances_sq[i]

            # Get indices of nearest papers (excluding self)
            # argsort is stable, so papers at same distance maintain order
            nearest_indices = np.argsort(dists)

            # Filter out self and take top k
            nearest_indices = nearest_indices[nearest_indices != global_idx][:num_nearest]
            nearest_ids = [paper_ids[idx] for idx in nearest_indices]

            nearest_map[paper_id] = nearest_ids

    return nearest_map


def update_database(db_path: str, nearest_map: dict[int, list[int]]) -> None:
    """
    Update the database with pre-computed nearest neighbors.

    Args:
        db_path: Path to SQLite database
        nearest_map: Dictionary mapping paper_id to list of nearest paper IDs
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print(f"\nUpdating database with nearest neighbors for {len(nearest_map)} papers...")

    # Update in batches for better performance
    batch = []
    for paper_id, nearest_ids in tqdm(nearest_map.items(), desc="Updating database"):
        nearest_json = json.dumps(nearest_ids)
        batch.append((nearest_json, paper_id))

        # Commit every 1000 rows
        if len(batch) >= 1000:
            cursor.executemany("UPDATE papers SET nearest_paper_ids = ? WHERE id = ?", batch)
            conn.commit()
            batch = []

    # Commit remaining
    if batch:
        cursor.executemany("UPDATE papers SET nearest_paper_ids = ? WHERE id = ?", batch)
        conn.commit()

    conn.close()
    print("Database updated successfully!")


def create_index(db_path: str) -> None:
    """Create an index on nearest_paper_ids for faster lookups."""
    print("\nCreating index on nearest_paper_ids...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Drop index if it exists
    cursor.execute("DROP INDEX IF EXISTS idx_papers_nearest")

    # Create index (partial index for rows with data)
    cursor.execute("""
        CREATE INDEX idx_papers_nearest
        ON papers(id)
        WHERE nearest_paper_ids IS NOT NULL
    """)

    conn.commit()
    conn.close()
    print("Index created successfully!")


def main():
    parser = argparse.ArgumentParser(description="Pre-compute nearest neighbors for papers")
    parser.add_argument(
        "--db",
        type=str,
        default="backend/data/db.sqlite",
        help="Path to SQLite database (default: backend/data/db.sqlite)",
    )
    parser.add_argument(
        "--num-nearest",
        type=int,
        default=15,
        help="Number of nearest neighbors to compute (default: 15)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Batch size for processing (default: 1000)",
    )

    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"Error: Database not found at {db_path}")
        return

    # Load data
    paper_ids, coordinates = load_paper_coordinates(str(db_path))

    # Compute nearest neighbors
    nearest_map = compute_nearest_neighbors_batched(
        paper_ids,
        coordinates,
        num_nearest=args.num_nearest,
        batch_size=args.batch_size,
    )

    # Update database
    update_database(str(db_path), nearest_map)

    # Create index
    create_index(str(db_path))

    print("\n✓ Pre-computation complete!")
    print(f"  Papers processed: {len(nearest_map)}")
    print(f"  Nearest neighbors per paper: {args.num_nearest}")


if __name__ == "__main__":
    main()
