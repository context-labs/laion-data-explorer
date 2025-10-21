#!/usr/bin/env python3
"""
Compute 2D visualization coordinates and clusters from embeddings.

This script:
1. Loads embeddings from the database
2. Uses UMAP to reduce 768D embeddings to 2D
3. Uses K-Means (or alternative clustering) to group similar papers
4. Extracts cluster labels from paper titles and fields
5. Stores x, y, cluster_id, and cluster_label back in the database

Usage:
    python tooling/compute_visualization.py [--db DB_PATH] [--method kmeans]
"""

import argparse
import json
import sqlite3
from collections import Counter
from pathlib import Path
from typing import List, Tuple, Optional

import numpy as np
import umap
from sklearn.cluster import KMeans, AgglomerativeClustering, DBSCAN, MiniBatchKMeans
from sklearn.metrics import silhouette_score
from sklearn.feature_extraction.text import TfidfVectorizer
from tqdm import tqdm


def load_embeddings(
    db_path: str,
) -> Tuple[List[int], np.ndarray, List[str], List[str], List[str]]:
    """
    Load embeddings, fields, and three_takeaways from database.

    Args:
        db_path: Path to SQLite database

    Returns:
        Tuple of (paper_ids, embeddings_matrix, titles, fields, three_takeaways)
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Loading embeddings from database...")
    cursor.execute("""
        SELECT id, embedding, summarization
        FROM papers
        WHERE embedding IS NOT NULL
        ORDER BY id
    """)

    paper_ids = []
    embeddings = []
    titles = []
    fields = []
    three_takeaways = []

    for row in tqdm(cursor.fetchall(), desc="Loading data"):
        paper_id, embedding_blob, summarization = row

        # Convert embedding
        embedding = np.frombuffer(embedding_blob, dtype=np.float32)
        embeddings.append(embedding)
        paper_ids.append(paper_id)

        # Extract title, field, and three_takeaways from summarization
        title = "Unknown"
        field = "Unknown"
        takeaways = ""
        if summarization:
            try:
                summary_data = json.loads(summarization)
                summary_obj = summary_data.get("summary", {})
                if summary_obj:
                    title = summary_obj.get("title", "Unknown")
                    field = summary_obj.get("field_subfield", "Unknown")
                    takeaways = summary_obj.get("three_takeaways", "")
            except json.JSONDecodeError:
                pass

        titles.append(title)
        fields.append(field)
        three_takeaways.append(takeaways)

    conn.close()

    embeddings_matrix = np.array(embeddings)
    print(f"Loaded {len(paper_ids)} papers with embeddings")

    return paper_ids, embeddings_matrix, titles, fields, three_takeaways


def compute_umap_coordinates(
    embeddings: np.ndarray,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
    n_components: int = 3,
) -> np.ndarray:
    """
    Compute UMAP coordinates from high-dimensional embeddings.

    Args:
        embeddings: Matrix of shape (n_papers, embedding_dim)
        n_neighbors: UMAP parameter for local neighborhood size
        min_dist: UMAP parameter for minimum distance between points
        random_state: Random seed for reproducibility
        n_components: Number of dimensions for output (2 or 3)

    Returns:
        Matrix of shape (n_papers, n_components) with coordinates
    """
    print(
        f"\nComputing UMAP projection to {n_components}D (this may take a few minutes)..."
    )
    print(f"  Input shape: {embeddings.shape}")
    print(
        f"  Parameters: n_neighbors={n_neighbors}, min_dist={min_dist}, n_components={n_components}"
    )

    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        metric="cosine",
        random_state=random_state,
        verbose=True,
    )

    coordinates = reducer.fit_transform(embeddings)
    print(f"  Output shape: {coordinates.shape}")

    return coordinates


def find_optimal_clusters(
    embeddings: np.ndarray, min_k: int = 20, max_k: int = 60
) -> int:
    """
    Find optimal number of clusters using silhouette score.

    Args:
        embeddings: Matrix of embeddings
        min_k: Minimum number of clusters to try
        max_k: Maximum number of clusters to try

    Returns:
        Optimal number of clusters
    """
    # For very large datasets, use MiniBatchKMeans for speed
    n_samples = len(embeddings)
    sample_size = min(5000, n_samples)  # Sample for faster evaluation

    if n_samples > 10000:
        print(f"  Using sample of {sample_size} papers for optimization...")
        sample_idx = np.random.choice(n_samples, sample_size, replace=False)
        sample_embeddings = embeddings[sample_idx]
    else:
        sample_embeddings = embeddings

    # Adjust k range based on sample size
    # Need at least 2 samples per cluster, so max_k = n_samples // 2
    max_possible_k = len(sample_embeddings) // 2

    # For small datasets, use a different range
    if max_possible_k < min_k:
        min_k = max(2, max_possible_k // 3)  # Start from 1/3 of max possible
        max_k = max_possible_k
    else:
        max_k = min(max_k, max_possible_k)

    # Ensure we have a valid range
    if min_k >= max_k:
        print(f"  Dataset too small for optimization, using {max_possible_k} clusters")
        return max_possible_k

    print(f"\nFinding optimal number of clusters (testing {min_k} to {max_k})...")

    scores = []
    k_values = range(min_k, max_k + 1)

    for k in tqdm(k_values, desc="Testing cluster counts"):
        kmeans = MiniBatchKMeans(n_clusters=k, random_state=42, batch_size=256)
        labels = kmeans.fit_predict(sample_embeddings)
        score = silhouette_score(
            sample_embeddings,
            labels,
            metric="cosine",
            sample_size=min(1000, len(sample_embeddings)),
        )
        scores.append(score)

    # Find optimal k (highest silhouette score)
    optimal_idx = np.argmax(scores)
    optimal_k = list(k_values)[optimal_idx]

    print(
        f"  Optimal clusters: {optimal_k} (silhouette score: {scores[optimal_idx]:.3f})"
    )

    return optimal_k


def compute_clusters_kmeans(
    embeddings: np.ndarray, n_clusters: Optional[int] = None, auto_optimize: bool = True
) -> np.ndarray:
    """
    Compute clusters using K-Means.

    Args:
        embeddings: Matrix of shape (n_papers, embedding_dim)
        n_clusters: Number of clusters (if None, automatically determined)
        auto_optimize: Whether to automatically find optimal number of clusters

    Returns:
        Array of cluster IDs for each paper
    """
    # Determine number of clusters
    if n_clusters is None and auto_optimize:
        n_clusters = find_optimal_clusters(embeddings)
    elif n_clusters is None:
        n_clusters = 40  # Default fallback

    print(f"\nClustering with K-Means (k={n_clusters})...")

    # Use MiniBatchKMeans for large datasets
    if len(embeddings) > 10000:
        print("  Using MiniBatchKMeans for efficiency...")
        clusterer = MiniBatchKMeans(
            n_clusters=n_clusters, random_state=42, batch_size=256, max_iter=100
        )
    else:
        clusterer = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)

    cluster_ids = clusterer.fit_predict(embeddings)

    # Count cluster sizes
    unique, counts = np.unique(cluster_ids, return_counts=True)
    print(f"  Created {len(unique)} clusters")
    print(
        f"  Cluster sizes: min={counts.min()}, max={counts.max()}, mean={counts.mean():.1f}"
    )

    return cluster_ids


def compute_clusters_agglomerative(
    embeddings: np.ndarray, n_clusters: int = 40
) -> np.ndarray:
    """
    Compute clusters using Agglomerative Clustering (hierarchical).
    Better for finding nested structure but slower.

    Args:
        embeddings: Matrix of shape (n_papers, embedding_dim)
        n_clusters: Number of clusters

    Returns:
        Array of cluster IDs for each paper
    """
    print(f"\nClustering with Agglomerative Clustering (k={n_clusters})...")

    # For large datasets, use a sample to build the hierarchy
    if len(embeddings) > 5000:
        print(
            "  Note: Agglomerative clustering is slow for large datasets. Consider using 'kmeans' instead."
        )

    clusterer = AgglomerativeClustering(
        n_clusters=n_clusters, metric="cosine", linkage="average"
    )

    cluster_ids = clusterer.fit_predict(embeddings)

    unique, counts = np.unique(cluster_ids, return_counts=True)
    print(f"  Created {len(unique)} clusters")
    print(
        f"  Cluster sizes: min={counts.min()}, max={counts.max()}, mean={counts.mean():.1f}"
    )

    return cluster_ids


def compute_clusters_dbscan(
    embeddings: np.ndarray, eps: float = 0.3, min_samples: int = 5
) -> np.ndarray:
    """
    Compute clusters using DBSCAN (density-based).
    Good for finding clusters of arbitrary shape.

    Args:
        embeddings: Matrix of shape (n_papers, embedding_dim)
        eps: Maximum distance between samples in a cluster
        min_samples: Minimum samples in a cluster

    Returns:
        Array of cluster IDs for each paper (-1 for noise)
    """
    print(f"\nClustering with DBSCAN...")
    print(f"  Parameters: eps={eps}, min_samples={min_samples}")

    clusterer = DBSCAN(eps=eps, min_samples=min_samples, metric="cosine", n_jobs=-1)

    cluster_ids = clusterer.fit_predict(embeddings)

    unique = np.unique(cluster_ids)
    n_clusters = len(unique[unique != -1])
    n_noise = np.sum(cluster_ids == -1)

    print(f"  Found {n_clusters} clusters")
    print(f"  Noise points: {n_noise} ({100 * n_noise / len(cluster_ids):.1f}%)")

    return cluster_ids


def extract_cluster_labels(
    cluster_ids: np.ndarray,
    titles: List[str],
    fields: List[str],
    three_takeaways: List[str],
    top_n: int = 5,
) -> dict:
    """
    Extract descriptive labels for each cluster based on fields and three_takeaways.

    Args:
        cluster_ids: Array of cluster IDs
        titles: List of paper titles (kept for compatibility but not used)
        fields: List of paper fields
        three_takeaways: List of three_takeaways (core contribution, evidence, limitation)
        top_n: Number of top terms to use for label

    Returns:
        Dictionary mapping cluster_id to label string
    """
    print(f"\nExtracting cluster labels...")

    cluster_labels = {}
    unique_clusters = np.unique(cluster_ids)

    for cluster_id in tqdm(unique_clusters, desc="Generating labels"):
        if cluster_id == -1:
            cluster_labels[cluster_id] = "Unclustered"
            continue

        # Get fields and three_takeaways for this cluster
        cluster_mask = cluster_ids == cluster_id
        cluster_fields = [fields[i] for i in range(len(fields)) if cluster_mask[i]]
        cluster_takeaways = [
            three_takeaways[i] for i in range(len(three_takeaways)) if cluster_mask[i]
        ]

        if not cluster_fields:
            cluster_labels[cluster_id] = f"Cluster {cluster_id}"
            continue

        # Check if there's a dominant field
        field_counter = Counter(cluster_fields)
        most_common_field = field_counter.most_common(1)[0]
        field_dominance = most_common_field[1] / len(cluster_fields)

        # If one field dominates (>60%), use it as part of the label
        dominant_field = None
        if field_dominance > 0.6 and most_common_field[0] != "Unknown":
            dominant_field = most_common_field[0].split("—")[0].strip()

        # Use TF-IDF to find most important terms from fields and three_takeaways
        try:
            # Combine fields and three_takeaways for this cluster
            cluster_text_items = []
            for i in range(len(cluster_fields)):
                text = ""
                # Add field if available
                if cluster_fields[i] and cluster_fields[i] != "Unknown":
                    text += cluster_fields[i]
                # Add three_takeaways if available
                if i < len(cluster_takeaways) and cluster_takeaways[i]:
                    text += " " + cluster_takeaways[i]

                if text.strip():  # Only add if there's actual content
                    cluster_text_items.append(text)

            if not cluster_text_items:
                cluster_labels[cluster_id] = f"Cluster {cluster_id}"
                continue

            # Also analyze across all clusters to find distinctive terms
            vectorizer = TfidfVectorizer(
                max_features=100,
                stop_words="english",
                ngram_range=(1, 2),
                min_df=1,
                max_df=0.8,  # Ignore terms that appear in >80% of docs
            )

            # Fit on field + three_takeaways text
            tfidf_matrix = vectorizer.fit_transform(cluster_text_items)
            feature_names = vectorizer.get_feature_names_out()

            # Get top terms by average TF-IDF score
            avg_scores = np.array(tfidf_matrix.mean(axis=0)).flatten()
            top_indices = avg_scores.argsort()[-top_n:][::-1]
            top_terms = [feature_names[i] for i in top_indices]

            # Filter out common/generic terms
            filtered_terms = []
            generic_terms = {
                "research",
                "study",
                "analysis",
                "paper",
                "using",
                "based",
                "approach",
            }
            for term in top_terms:
                if term.lower() not in generic_terms and len(term) > 2:
                    filtered_terms.append(term)
                if len(filtered_terms) >= 3:
                    break

            # Create label
            if dominant_field and filtered_terms:
                label = f"{dominant_field}: {', '.join(filtered_terms[:2])}"
            elif filtered_terms:
                label = ", ".join(filtered_terms[:3])
            else:
                label = f"Cluster {cluster_id}"

            cluster_labels[cluster_id] = label.title()

        except Exception as e:
            print(f"  Warning: Could not extract label for cluster {cluster_id}: {e}")
            cluster_labels[cluster_id] = f"Cluster {cluster_id}"

    # Print summary
    print(f"\nCluster summary:")
    for cluster_id in sorted([c for c in unique_clusters if c != -1]):
        cluster_size = np.sum(cluster_ids == cluster_id)
        print(
            f"  Cluster {cluster_id} ({cluster_size} papers): {cluster_labels[cluster_id]}"
        )

    return cluster_labels


def add_visualization_columns(db_path: str) -> None:
    """
    Add visualization columns to the database if they don't exist.

    Args:
        db_path: Path to SQLite database
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check existing columns
    cursor.execute("PRAGMA table_info(papers)")
    columns = [col[1] for col in cursor.fetchall()]

    # Add columns if they don't exist
    for column, dtype in [
        ("x", "REAL"),
        ("y", "REAL"),
        ("z", "REAL"),
        ("cluster_id", "INTEGER"),
        ("cluster_label", "TEXT"),
    ]:
        if column not in columns:
            print(f"Adding column '{column}' to database...")
            cursor.execute(f"ALTER TABLE papers ADD COLUMN {column} {dtype}")

    conn.commit()
    conn.close()


def store_visualization_data(
    db_path: str,
    paper_ids: List[int],
    coordinates: np.ndarray,
    cluster_ids: np.ndarray,
    cluster_labels: dict,
) -> None:
    """
    Store visualization data back into the database.

    Args:
        db_path: Path to SQLite database
        paper_ids: List of paper IDs
        coordinates: 2D or 3D coordinates (x, y) or (x, y, z)
        cluster_ids: Cluster assignments
        cluster_labels: Cluster label lookup
    """
    print(f"\nStoring visualization data in database...")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if coordinates are 2D or 3D
    n_dims = coordinates.shape[1]

    for i, paper_id in enumerate(tqdm(paper_ids, desc="Updating database")):
        cluster_id = int(cluster_ids[i])
        cluster_label = cluster_labels.get(cluster_id, f"Cluster {cluster_id}")

        if n_dims == 3:
            x, y, z = coordinates[i]
            cursor.execute(
                """
                UPDATE papers
                SET x = ?, y = ?, z = ?, cluster_id = ?, cluster_label = ?
                WHERE id = ?
            """,
                (float(x), float(y), float(z), cluster_id, cluster_label, paper_id),
            )
        else:
            x, y = coordinates[i]
            cursor.execute(
                """
                UPDATE papers
                SET x = ?, y = ?, cluster_id = ?, cluster_label = ?
                WHERE id = ?
            """,
                (float(x), float(y), cluster_id, cluster_label, paper_id),
            )

    conn.commit()
    conn.close()

    print("Visualization data stored successfully!")


def main():
    parser = argparse.ArgumentParser(
        description="Compute visualization coordinates and clusters from embeddings"
    )
    parser.add_argument(
        "--db",
        default="data/db.sqlite",
        help="Path to SQLite database (default: data/db.sqlite)",
    )
    parser.add_argument(
        "--method",
        choices=["kmeans", "agglomerative", "dbscan"],
        default="kmeans",
        help="Clustering method to use (default: kmeans)",
    )
    parser.add_argument(
        "--n-clusters",
        type=int,
        default=100,
        help="Number of clusters for kmeans/agglomerative (default: 100 for detailed clustering)",
    )
    parser.add_argument(
        "--n-neighbors",
        type=int,
        default=15,
        help="UMAP n_neighbors parameter (default: 15)",
    )
    parser.add_argument(
        "--min-dist",
        type=float,
        default=0.1,
        help="UMAP min_dist parameter (default: 0.1)",
    )
    parser.add_argument(
        "--dbscan-eps",
        type=float,
        default=0.3,
        help="DBSCAN eps parameter (default: 0.3)",
    )
    parser.add_argument(
        "--dbscan-min-samples",
        type=int,
        default=5,
        help="DBSCAN min_samples parameter (default: 5)",
    )
    parser.add_argument(
        "--auto-optimize",
        action="store_true",
        default=False,
        help="Automatically find optimal number of clusters for kmeans (default: False, uses --n-clusters)",
    )
    parser.add_argument(
        "--dimensions",
        type=int,
        choices=[2, 3],
        default=3,
        help="Number of dimensions for UMAP projection: 2 for 2D or 3 for 3D (default: 3)",
    )

    args = parser.parse_args()

    # Resolve path relative to project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    db_path = project_root / args.db

    if not db_path.exists():
        print(f"Error: Database not found: {db_path}")
        return 1

    # Add visualization columns
    add_visualization_columns(str(db_path))

    # Load data
    paper_ids, embeddings, titles, fields, three_takeaways = load_embeddings(
        str(db_path)
    )

    if len(paper_ids) == 0:
        print("Error: No papers with embeddings found in database")
        return 1

    # Compute UMAP coordinates
    coordinates = compute_umap_coordinates(
        embeddings,
        n_neighbors=args.n_neighbors,
        min_dist=args.min_dist,
        n_components=args.dimensions,
    )

    # Compute clusters based on method
    if args.method == "kmeans":
        cluster_ids = compute_clusters_kmeans(
            embeddings,
            n_clusters=args.n_clusters,
            auto_optimize=args.auto_optimize and args.n_clusters is None,
        )
    elif args.method == "agglomerative":
        n_clusters = args.n_clusters or 40
        cluster_ids = compute_clusters_agglomerative(embeddings, n_clusters)
    elif args.method == "dbscan":
        cluster_ids = compute_clusters_dbscan(
            embeddings, eps=args.dbscan_eps, min_samples=args.dbscan_min_samples
        )
    else:
        raise ValueError(f"Unknown clustering method: {args.method}")

    # Extract cluster labels using field_subfield and three_takeaways
    cluster_labels = extract_cluster_labels(
        cluster_ids, titles, fields, three_takeaways
    )

    # Store results
    store_visualization_data(
        str(db_path), paper_ids, coordinates, cluster_ids, cluster_labels
    )

    print("\n✓ Visualization data computation complete!")
    print(f"  Papers processed: {len(paper_ids)}")
    print(f"  Clusters found: {len([c for c in cluster_labels.keys() if c != -1])}")
    print("\nYou can now run the API server and visualize the data!")

    return 0


if __name__ == "__main__":
    exit(main())
