import os
import json
import gzip
import logging
import psycopg2

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def truncate_tables(cursor, manifest_files):
    tables = []
    for f in manifest_files:
        filename = f["filename"]
        if filename.endswith(".tsv.gz"):
            tables.append(f"ref_mb.{filename[:-7]}")
        elif filename.endswith(".csv.gz"):
            tables.append(f"ref_mb.{filename[:-7]}")

    if tables:
        # TRUNCATE CASCADE to clear all safely
        cursor.execute(f"TRUNCATE {', '.join(tables)} CASCADE;")

def run(staging_dir: str, db_url: str):
    logger.info("Starting load...")

    manifest_path = os.path.join(staging_dir, "manifest.json")
    if not os.path.exists(manifest_path):
        logger.error("Manifest not found")
        return

    with open(manifest_path, 'r') as f:
        manifest = json.load(f)

    conn = psycopg2.connect(db_url)
    conn.autocommit = False

    try:
        with conn.cursor() as cursor:
            # Note: "additive migrations with down scripts" implies tables are bare during load, constraints/indexes after load.
            # Truncate first to be idempotent
            truncate_tables(cursor, manifest.get("files", []))

            for file_info in manifest.get("files", []):
                filename = file_info["filename"]
                filepath = os.path.join(staging_dir, filename)
                table_name = filename[:-7] # remove .tsv.gz or .csv.gz

                logger.info(f"Loading {table_name}...")

                if filename.endswith(".tsv.gz"):
                    # TSV
                    copy_sql = f"COPY ref_mb.{table_name} FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\N', QUOTE E'\\b')"
                    with gzip.open(filepath, 'rt', encoding='utf-8') as f:
                        cursor.copy_expert(copy_sql, f)
                elif filename.endswith(".csv.gz"):
                    # CSV with header
                    copy_sql = f"COPY ref_mb.{table_name} FROM STDIN WITH (FORMAT csv, HEADER true)"
                    with gzip.open(filepath, 'rt', encoding='utf-8') as f:
                        cursor.copy_expert(copy_sql, f)

            conn.commit()
            logger.info("Load complete.")
    except Exception as e:
        conn.rollback()
        logger.error(f"Load failed: {e}")
        raise
    finally:
        conn.close()
