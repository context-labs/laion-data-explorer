#!/usr/bin/env python3
"""
Extract a random subset of paper samples to a separate table and remove the sample column.

This script:
1. Creates a new paper_samples table
2. Randomly selects 100 papers with samples
3. Inserts them into paper_samples table
4. Drops the sample column from papers table
5. Vacuums the database to reclaim space

Usage:
    python tooling/extract_paper_samples.py [--db DB_PATH] [--num-samples NUM]
"""

import argparse
import sqlite3
from pathlib import Path


def extract_samples(db_path: str, num_samples: int = 100) -> None:
    """
    Extract random paper samples to a separate table and remove sample column.

    Args:
        db_path: Path to SQLite database
        num_samples: Number of random samples to extract (default: 100)
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print(f"Connected to database: {db_path}")

    # Check current database size
    cursor.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();")
    initial_size = cursor.fetchone()[0]
    print(f"Initial database size: {initial_size / (1024**2):.2f} MB")

    # Check how many papers have samples
    cursor.execute("SELECT COUNT(*) FROM papers WHERE sample IS NOT NULL AND sample != ''")
    papers_with_samples = cursor.fetchone()[0]
    print(f"\nPapers with samples: {papers_with_samples:,}")

    if papers_with_samples == 0:
        print("No papers with samples found. Exiting.")
        conn.close()
        return

    # Adjust num_samples if there aren't enough papers
    if num_samples > papers_with_samples:
        print(f"Only {papers_with_samples} papers with samples available, using that instead of {num_samples}")
        num_samples = papers_with_samples

    print("\n1. Creating paper_samples table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS paper_samples (
            paper_id INTEGER PRIMARY KEY,
            sample TEXT NOT NULL,
            FOREIGN KEY (paper_id) REFERENCES papers(id)
        )
    """)
    conn.commit()
    print("   ✓ Table created")

    print(f"\n2. Selecting {num_samples} random papers with samples...")
    cursor.execute(
        """
        SELECT id, sample
        FROM papers
        WHERE sample IS NOT NULL AND sample != ''
        ORDER BY RANDOM()
        LIMIT ?
    """,
        (num_samples,),
    )

    samples = cursor.fetchall()
    print(f"   ✓ Selected {len(samples)} samples")

    print("\n3. Inserting samples into paper_samples table...")
    cursor.executemany("INSERT INTO paper_samples (paper_id, sample) VALUES (?, ?)", samples)
    conn.commit()
    print(f"   ✓ Inserted {len(samples)} samples")

    # Verify insertion
    cursor.execute("SELECT COUNT(*) FROM paper_samples")
    inserted_count = cursor.fetchone()[0]
    print(f"   ✓ Verified: {inserted_count} rows in paper_samples")

    print("\n4. Creating a new papers table without sample column...")

    # Get current table schema (excluding sample column)
    cursor.execute("PRAGMA table_info(papers)")
    columns = cursor.fetchall()

    # Filter out the sample column and build new schema
    new_columns = []
    for col in columns:
        col_id, name, type_, notnull, default_val, pk = col
        if name != "sample":
            new_columns.append((name, type_))

    # Create new table
    column_defs = ", ".join([f"{name} {type_}" for name, type_ in new_columns])
    cursor.execute(f"CREATE TABLE papers_new ({column_defs})")

    # Copy data (excluding sample column)
    column_names = ", ".join([name for name, _ in new_columns])
    cursor.execute(f"""
        INSERT INTO papers_new ({column_names})
        SELECT {column_names}
        FROM papers
    """)
    conn.commit()
    print("   ✓ Created new table and copied data")

    print("\n5. Replacing old table with new table...")
    cursor.execute("DROP TABLE papers")
    cursor.execute("ALTER TABLE papers_new RENAME TO papers")
    conn.commit()
    print("   ✓ Table replaced")

    # Recreate index
    print("\n6. Recreating index...")
    cursor.execute("CREATE INDEX ix_papers_id ON papers (id)")
    conn.commit()
    print("   ✓ Index recreated")

    print("\n7. Vacuuming database to reclaim space...")
    cursor.execute("VACUUM")
    conn.commit()
    print("   ✓ Database vacuumed")

    # Check new database size
    cursor.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();")
    final_size = cursor.fetchone()[0]

    size_reduction = initial_size - final_size
    percent_reduction = (size_reduction / initial_size) * 100

    print(f"\n{'=' * 60}")
    print("RESULTS:")
    print(f"{'=' * 60}")
    print(f"Initial size:       {initial_size / (1024**2):.2f} MB")
    print(f"Final size:         {final_size / (1024**2):.2f} MB")
    print(f"Space saved:        {size_reduction / (1024**2):.2f} MB ({percent_reduction:.1f}%)")
    print(f"Samples extracted:  {inserted_count}")
    print(f"{'=' * 60}")

    conn.close()


def main():
    parser = argparse.ArgumentParser(description="Extract paper samples to separate table and remove sample column")
    parser.add_argument(
        "--db",
        type=str,
        default="backend/data/db.sqlite",
        help="Path to SQLite database (default: backend/data/db.sqlite)",
    )
    parser.add_argument(
        "--num-samples",
        type=int,
        default=100,
        help="Number of random samples to extract (default: 100)",
    )

    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"Error: Database not found at {db_path}")
        return

    print("=" * 60)
    print("EXTRACT PAPER SAMPLES & REMOVE SAMPLE COLUMN")
    print("=" * 60)
    print(f"Database: {db_path}")
    print(f"Samples to extract: {args.num_samples}")
    print("=" * 60)
    print("\nWARNING: This will permanently modify the database.")
    print("Make sure you have a backup before proceeding!\n")

    response = input("Continue? (yes/no): ")
    if response.lower() != "yes":
        print("Aborted.")
        return

    extract_samples(str(db_path), args.num_samples)

    print("\n✓ Complete!")


if __name__ == "__main__":
    main()
