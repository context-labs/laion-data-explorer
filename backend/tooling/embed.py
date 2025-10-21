#!/usr/bin/env python3
"""
Generate embeddings for scientific paper summaries using SPECTER2.

This script iterates through all rows in the database and generates embeddings
for the structured extractions using the SPECTER2 model from AllenAI.

SPECTER2 is designed specifically for scientific documents and generates
embeddings optimized for semantic search over scientific literature.

Usage:
    python tooling/embed.py [--db DB_PATH] [--batch-size BATCH_SIZE] [--resume]

Default db: data/db.sqlite
Default batch size: 32
"""

import argparse
import json
import pickle
import sqlite3
from pathlib import Path
from typing import List, Optional

import numpy as np
import torch
from tqdm import tqdm
from transformers import AutoModel, AutoTokenizer


def get_paper_text(sample: str, summarization: str) -> Optional[str]:
    """
    Extract meaningful text from a paper record for embedding.

    Args:
        sample: The raw sample data (may contain paper metadata)
        summarization: The structured JSON extraction

    Returns:
        Combined text for embedding, or None if not available
    """
    text_parts = []

    # Try to parse the summarization JSON
    if summarization and summarization.strip():
        try:
            summary_data = json.loads(summarization)

            # Check article classification
            article_class = summary_data.get("article_classification", "")

            # Skip non-scientific text
            if article_class == "NON_SCIENTIFIC_TEXT":
                return None

            # Extract summary content
            summary_obj = summary_data.get("summary", {})
            if summary_obj:
                # Prioritize fields that contain the most semantic information
                title = summary_obj.get("title", "").strip()
                abstract = summary_obj.get("executive_summary", "").strip()
                research_context = summary_obj.get("research_context", "").strip()

                if title:
                    text_parts.append(f"Title: {title}")
                if abstract:
                    text_parts.append(f"Abstract: {abstract}")
                if research_context:
                    text_parts.append(f"Context: {research_context}")

        except json.JSONDecodeError:
            # If JSON parsing fails, we'll fall back to sample
            pass

    # If we didn't get anything from summarization, try sample
    if not text_parts and sample and sample.strip():
        # Try to extract title and abstract from sample
        lines = sample.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('title:'):
                title = line[6:].strip()
                text_parts.append(f"Title: {title}")
            elif line.startswith('abstract:'):
                abstract = line[9:].strip()
                text_parts.append(f"Abstract: {abstract}")

    if text_parts:
        return "\n".join(text_parts)

    return None


def generate_embeddings(
    texts: List[str],
    model,
    tokenizer,
    device: str = "cpu",
    max_length: int = 512
) -> np.ndarray:
    """
    Generate embeddings using SPECTER2.

    Args:
        texts: List of texts to embed
        model: The SPECTER2 model
        tokenizer: The SPECTER2 tokenizer
        device: Device to run on ('cpu' or 'cuda')
        max_length: Maximum sequence length

    Returns:
        Numpy array of embeddings (batch_size x embedding_dim)
    """
    # Tokenize texts
    inputs = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=max_length,
        return_tensors="pt"
    ).to(device)

    # Generate embeddings
    with torch.no_grad():
        outputs = model(**inputs)
        # Use CLS token embedding
        embeddings = outputs.last_hidden_state[:, 0, :]

    return embeddings.cpu().numpy()


def add_embeddings_column(db_path: str) -> None:
    """
    Add embeddings column to the database if it doesn't exist.

    Args:
        db_path: Path to the SQLite database
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if column exists
    cursor.execute("PRAGMA table_info(papers)")
    columns = [col[1] for col in cursor.fetchall()]

    if "embedding" not in columns:
        print("Adding 'embedding' column to database...")
        cursor.execute("ALTER TABLE papers ADD COLUMN embedding BLOB")
        conn.commit()

    conn.close()


def embed_database(
    db_path: str,
    batch_size: int = 32,
    device: Optional[str] = None,
    resume: bool = False,
    commit_interval: int = 200
) -> None:
    """
    Generate and store embeddings for all papers in the database.

    Args:
        db_path: Path to the SQLite database
        batch_size: Number of papers to process at once
        device: Device to run on ('cpu' or 'cuda'), auto-detect if None
        resume: If True, skip papers that already have embeddings
        commit_interval: Number of papers to process before committing to database
    """
    # Determine device
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    # Load SPECTER2 model
    print("Loading SPECTER2 model...")
    model_name = "allenai/specter2_base"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name, trust_remote_code=True).to(device)
    model.eval()
    print(f"Model loaded: {model_name}")

    # Add embeddings column if needed
    add_embeddings_column(db_path)

    # Setup checkpoint file
    checkpoint_path = Path(db_path).parent / ".embed_checkpoint.pkl"

    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get total count and already embedded count
    cursor.execute("SELECT COUNT(*) FROM papers")
    total_count = cursor.fetchone()[0]

    if resume:
        cursor.execute("SELECT COUNT(*) FROM papers WHERE embedding IS NOT NULL")
        already_embedded = cursor.fetchone()[0]
        print(f"\nResume mode: {already_embedded} papers already embedded")
        print(f"Processing remaining {total_count - already_embedded} papers...")
    else:
        already_embedded = 0
        print(f"\nProcessing {total_count} papers...")

    # Fetch all paper IDs first to avoid cursor invalidation during commits
    # This uses minimal memory since we're only storing IDs
    if resume:
        cursor.execute("SELECT id FROM papers WHERE embedding IS NULL")
    else:
        cursor.execute("SELECT id FROM papers")

    paper_ids_to_process = [row[0] for row in cursor.fetchall()]

    batch_ids = []
    batch_texts = []
    processed = 0
    skipped = 0
    papers_since_commit = 0

    with tqdm(total=total_count, initial=already_embedded, desc="Generating embeddings") as pbar:
        # Iterate through paper IDs and fetch each paper's data
        for paper_id in paper_ids_to_process:
            # Fetch paper data
            cursor.execute("SELECT sample, summarization FROM papers WHERE id = ?", (paper_id,))
            row = cursor.fetchone()
            if not row:
                continue

            sample, summarization = row

            # Extract text for embedding
            text = get_paper_text(sample, summarization)

            if text:
                batch_ids.append(paper_id)
                batch_texts.append(text)
            else:
                skipped += 1
                pbar.update(1)
                continue

            # Process batch when it's full
            if len(batch_texts) >= batch_size:
                embeddings = generate_embeddings(
                    batch_texts,
                    model,
                    tokenizer,
                    device=device
                )

                # Store embeddings
                for idx, paper_id in enumerate(batch_ids):
                    embedding_bytes = embeddings[idx].tobytes()
                    cursor.execute(
                        "UPDATE papers SET embedding = ? WHERE id = ?",
                        (embedding_bytes, paper_id)
                    )

                papers_since_commit += len(batch_texts)
                processed += len(batch_texts)
                pbar.update(len(batch_texts))

                # Commit every commit_interval papers instead of every batch
                if papers_since_commit >= commit_interval:
                    conn.commit()
                    papers_since_commit = 0

                    # Save checkpoint
                    with open(checkpoint_path, 'wb') as f:
                        pickle.dump({
                            'processed': processed + already_embedded,
                            'skipped': skipped,
                            'total': total_count
                        }, f)

                # Clear batch
                batch_ids = []
                batch_texts = []

        # Process remaining items
        if batch_texts:
            embeddings = generate_embeddings(
                batch_texts,
                model,
                tokenizer,
                device=device
            )

            for idx, paper_id in enumerate(batch_ids):
                embedding_bytes = embeddings[idx].tobytes()
                cursor.execute(
                    "UPDATE papers SET embedding = ? WHERE id = ?",
                    (embedding_bytes, paper_id)
                )

            processed += len(batch_texts)
            pbar.update(len(batch_texts))

        # Final commit
        conn.commit()

    conn.close()

    # Clean up checkpoint file on successful completion
    if checkpoint_path.exists():
        checkpoint_path.unlink()

    print(f"\nComplete!")
    print(f"  Processed: {processed}")
    print(f"  Skipped: {skipped}")
    print(f"  Total: {total_count}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate SPECTER2 embeddings for papers in the database"
    )
    parser.add_argument(
        "--db",
        default="data/db.sqlite",
        help="Path to SQLite database (default: data/db.sqlite)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size for embedding generation (default: 32, use 64 for GPU)"
    )
    parser.add_argument(
        "--device",
        choices=["cpu", "cuda"],
        default=None,
        help="Device to run on (default: auto-detect)"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip papers that already have embeddings (useful for resuming interrupted runs)"
    )
    parser.add_argument(
        "--commit-interval",
        type=int,
        default=200,
        help="Number of papers to process before committing to database (default: 200)"
    )

    args = parser.parse_args()

    # Resolve path relative to project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    db_path = project_root / args.db

    if not db_path.exists():
        print(f"Error: Database not found: {db_path}")
        return 1

    embed_database(
        str(db_path),
        batch_size=args.batch_size,
        device=args.device,
        resume=args.resume,
        commit_interval=args.commit_interval
    )

    return 0


if __name__ == "__main__":
    exit(main())
