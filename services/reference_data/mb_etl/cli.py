import argparse
import sys
from . import extract, load, index, verify

def main():
    parser = argparse.ArgumentParser(prog="python -m mb_etl")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # extract
    extract_parser = subparsers.add_parser("extract", help="Stream extract members from mbdump.tar.bz2 to staging")
    extract_parser.add_argument("--dump-dir", required=True, help="Path to data/metabrainz containing mbdump tarballs")
    extract_parser.add_argument("--staging-dir", required=True, help="Path to output staging files")

    # load
    load_parser = subparsers.add_parser("load", help="COPY staging into ref_mb")
    load_parser.add_argument("--staging-dir", required=True, help="Path to staging files")
    load_parser.add_argument("--db-url", required=True, help="Postgres database URL")

    # index
    index_parser = subparsers.add_parser("index", help="Build indexes after load")
    index_parser.add_argument("--db-url", required=True, help="Postgres database URL")

    # verify
    verify_parser = subparsers.add_parser("verify", help="Run independent cross-check against JSON dumps")
    verify_parser.add_argument("--db-url", required=True, help="Postgres database URL")
    verify_parser.add_argument("--json-dump-dir", required=True, help="Path to JSON dumps")

    args = parser.parse_args()

    if args.command == "extract":
        extract.run(args.dump_dir, args.staging_dir)
    elif args.command == "load":
        load.run(args.staging_dir, args.db_url)
    elif args.command == "index":
        index.run(args.db_url)
    elif args.command == "verify":
        verify.run(args.db_url, args.json_dump_dir)

if __name__ == "__main__":
    sys.exit(main())
