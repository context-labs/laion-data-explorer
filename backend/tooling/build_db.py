#!/usr/bin/env python3
"""
Build a SQLite database from the parquet file containing scraped data and structured extractions.

Usage:
    python tooling/build_db.py [--input INPUT_PARQUET] [--output OUTPUT_DB] [--num-rows NUM_ROWS]

Default input: data/full.parquet
Default output: data/db.sqlite
"""

import argparse
import json
import sqlite3
from pathlib import Path

import pandas as pd


def create_db(parquet_path: str, db_path: str, num_rows: int | None = None) -> None:
    """
    Create a SQLite database from a parquet file.

    Args:
        parquet_path: Path to the input parquet file
        db_path: Path to the output SQLite database
        num_rows: Optional limit on number of rows to read from parquet
    """
    print(f"Reading parquet from: {parquet_path}")
    df = pd.read_parquet(parquet_path)

    if num_rows:
        print(f"Limiting to first {num_rows} rows")
        df = df.head(num_rows)

    print(f"Loaded {len(df)} rows with columns: {df.columns.tolist()}")

    # Filter out papers that failed or are non-scientific
    initial_count = len(df)

    # Remove rows where summarization is null/empty
    df = df[df["summarization"].notna()]
    print(f"  Removed {initial_count - len(df)} rows with null summarization")

    # Parse summarization and filter NON_SCIENTIFIC_TEXT
    def should_include_paper(summarization_str):
        """Check if paper should be included in the database."""
        if not summarization_str:
            return False
        try:
            data = json.loads(summarization_str)
            classification = data.get("article_classification", "")
            # Only include SCIENTIFIC_TEXT and PARTIAL_SCIENTIFIC_TEXT
            return classification in ["SCIENTIFIC_TEXT", "PARTIAL_SCIENTIFIC_TEXT"]
        except (json.JSONDecodeError, TypeError):
            return False

    mask = df["summarization"].apply(should_include_paper)
    filtered_count = len(df) - mask.sum()
    df = df[mask]
    print(f"  Removed {filtered_count} rows that failed to summarize or were NON_SCIENTIFIC_TEXT")
    print(f"  Retained {len(df)} scientific papers for database")

    # Extract title, publication_year, and field_subfield from summarization
    def extract_field(summarization_str, field_name):
        """Extract a field from the summarization JSON."""
        try:
            data = json.loads(summarization_str)
            summary = data.get("summary", {})
            if summary:
                return summary.get(field_name)
        except (json.JSONDecodeError, TypeError):
            pass
        return None

    print("  Extracting title, publication_year, field_subfield, and classification...")
    df["title"] = df["summarization"].apply(lambda x: extract_field(x, "title"))
    df["publication_year"] = df["summarization"].apply(lambda x: extract_field(x, "publication_year"))
    df["field_subfield"] = df["summarization"].apply(lambda x: extract_field(x, "field_subfield"))

    # Extract and map classification
    def extract_classification(summarization_str):
        """Extract classification and map to simplified labels."""
        try:
            data = json.loads(summarization_str)
            classification = data.get("article_classification", "")
            if classification == "SCIENTIFIC_TEXT":
                return "FULL_TEXT"
            elif classification == "PARTIAL_SCIENTIFIC_TEXT":
                return "PARTIAL_TEXT"
        except (json.JSONDecodeError, TypeError):
            pass
        return None

    df["classification"] = df["summarization"].apply(extract_classification)

    # Remove the error column if it exists
    if "error" in df.columns:
        df = df.drop(columns=["error"])
        print("  Removed error column")

    # Create/connect to database
    print(f"\nCreating database at: {db_path}")
    conn = sqlite3.connect(db_path)

    try:
        # Write dataframe to SQLite
        # if_exists='replace' will drop and recreate the table if it exists
        df.to_sql("papers", conn, if_exists="replace", index=True, index_label="id")

        print(f"Successfully created 'papers' table with {len(df)} rows")

        # Show table schema
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(papers)")
        columns = cursor.fetchall()

        print("\nTable schema:")
        for col in columns:
            col_id, name, dtype, notnull, default, pk = col
            print(f"  {name:20s} {dtype:15s} {'PRIMARY KEY' if pk else ''}")

        # Show sample row count
        cursor.execute("SELECT COUNT(*) FROM papers")
        count = cursor.fetchone()[0]
        print(f"\nTotal rows in database: {count}")

        conn.commit()

    finally:
        conn.close()

    print(f"\nDatabase created successfully at: {db_path}")


def main():
    parser = argparse.ArgumentParser(description="Build SQLite database from parquet file")
    parser.add_argument(
        "--input",
        default="data/full.parquet",
        help="Input parquet file path (default: data/full.parquet)",
    )
    parser.add_argument(
        "--output",
        default="data/db.sqlite",
        help="Output SQLite database path (default: data/db.sqlite)",
    )
    parser.add_argument(
        "--num-rows",
        type=int,
        default=None,
        help="Limit number of rows to read from parquet (default: read all rows)",
    )

    args = parser.parse_args()

    # Resolve paths relative to project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    input_path = project_root / args.input
    output_path = project_root / args.output

    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        return 1

    # Create output directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)

    create_db(str(input_path), str(output_path), num_rows=args.num_rows)

    return 0


if __name__ == "__main__":
    exit(main())
