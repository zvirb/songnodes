import os
import tarfile
import gzip
import json
import logging
from typing import Set, Dict, Any, List, Optional
import csv
from datetime import datetime, timezone
import hashlib
import io

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# To slim `recording` and `track`, we need to keep rows with an ISRC or a canonical row.
# Since we process the stream sequentially, we'd need a two-pass approach, or store recording IDs in memory.
# Memory limit should be fine for a set of integer IDs (even millions of integers is only a few MBs).
# Let's extract ISRC and canonical data first to build sets of allowed recording IDs / MBIDs.

CORE_TABLES = [
    'artist', 'artist_alias', 'artist_credit', 'artist_credit_name',
    'recording', 'recording_alias', 'isrc', 'track', 'medium', 'release',
    'release_label', 'label', 'label_alias', 'release_group', 'url', 'link',
    'link_type', 'l_artist_url', 'l_label_url', 'l_recording_url', 'l_release_url',
    'l_release_group_url', 'artist_gid_redirect', 'recording_gid_redirect',
    'release_gid_redirect', 'release_group_gid_redirect', 'label_gid_redirect'
]

DERIVED_TABLES = [
    'tag', 'artist_tag', 'recording_tag', 'release_tag', 'release_group_tag',
    'label_tag', 'genre'
]

ALL_TABLES = CORE_TABLES + DERIVED_TABLES

def compute_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def get_canonical_mbids(dump_dir: str) -> Set[str]:
    canonical_mbids = set()
    canonical_file = os.path.join(dump_dir, "canonical_musicbrainz_data.csv.gz")
    if not os.path.exists(canonical_file):
        logger.warning(f"Canonical file {canonical_file} not found. Skipping canonical slim filter.")
        return canonical_mbids

    with gzip.open(canonical_file, 'rt', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if 'recording_mbid' in row and row['recording_mbid']:
                canonical_mbids.add(row['recording_mbid'])

    # Also add canonical_recording_mbid from redirect file just to be safe
    redirect_file = os.path.join(dump_dir, "canonical_recording_redirect.csv.gz")
    if os.path.exists(redirect_file):
        with gzip.open(redirect_file, 'rt', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if 'canonical_recording_mbid' in row and row['canonical_recording_mbid']:
                    canonical_mbids.add(row['canonical_recording_mbid'])
                if 'recording_mbid' in row and row['recording_mbid']:
                    canonical_mbids.add(row['recording_mbid'])

    return canonical_mbids

def extract_tar_file(tar_path: str, tables_to_extract: List[str], staging_dir: str, canonical_mbids: Set[str], isrc_recording_ids: Set[str], recording_mbid_to_id: Dict[str, str], manifest: Dict[str, Any]):
    # Since we don't know the order in the tar, and isrc might come after recording,
    # we might need to extract `recording` to a temp file, or stream everything and filter later.
    # The brief states: "keep `recording`/`track` rows only when they have an ISRC or a canonical row".
    # Since we can't guarantee `isrc` comes before `recording` in the tarball, we will first extract everything to staging,
    # then apply the slim filter as a post-processing step on the extracted `.tsv.gz` files.

    if not os.path.exists(tar_path):
        logger.warning(f"Tar file {tar_path} not found.")
        return

    with tarfile.open(tar_path, "r:bz2") as tar:
        for member in tar:
            if not member.isfile():
                continue

            # The member name might be "mbdump/artist" or just "artist"
            filename = os.path.basename(member.name)
            if filename in tables_to_extract:
                logger.info(f"Extracting {filename} from {tar_path}")
                out_path = os.path.join(staging_dir, f"{filename}.tsv.gz")
                source = tar.extractfile(member)
                if not source:
                    continue

                with gzip.open(out_path, 'wb') as out_f:
                    while chunk := source.read(8192 * 1024):
                        out_f.write(chunk)

def apply_slim_filter(staging_dir: str, canonical_mbids: Set[str], manifest: Dict[str, Any]):
    isrc_file = os.path.join(staging_dir, "isrc.tsv.gz")
    isrc_recording_ids = set()
    if os.path.exists(isrc_file):
        with gzip.open(isrc_file, 'rt', encoding='utf-8') as f:
            for line in f:
                parts = line.strip('\n').split('\t')
                if len(parts) >= 2 and parts[1] != '\\N':
                    isrc_recording_ids.add(parts[1])

    recording_file = os.path.join(staging_dir, "recording.tsv.gz")
    kept_recording_ids = set()
    if os.path.exists(recording_file):
        temp_rec = recording_file + ".tmp"
        orig_count = 0
        kept_count = 0
        with gzip.open(recording_file, 'rt', encoding='utf-8') as f_in, \
             gzip.open(temp_rec, 'wt', encoding='utf-8') as f_out:
             for line in f_in:
                 orig_count += 1
                 parts = line.strip('\n').split('\t')
                 rec_id = parts[0]
                 rec_gid = parts[1] if len(parts) > 1 else None

                 if rec_id in isrc_recording_ids or (rec_gid and rec_gid in canonical_mbids):
                     kept_recording_ids.add(rec_id)
                     f_out.write(line)
                     kept_count += 1

        os.replace(temp_rec, recording_file)
        manifest["recording_slim"] = {"original": orig_count, "kept": kept_count}
        logger.info(f"Slimmed recording: {kept_count}/{orig_count} kept")

    track_file = os.path.join(staging_dir, "track.tsv.gz")
    if os.path.exists(track_file):
        temp_track = track_file + ".tmp"
        orig_count = 0
        kept_count = 0
        with gzip.open(track_file, 'rt', encoding='utf-8') as f_in, \
             gzip.open(temp_track, 'wt', encoding='utf-8') as f_out:
             for line in f_in:
                 orig_count += 1
                 parts = line.strip('\n').split('\t')
                 rec_id = parts[2] if len(parts) > 2 else None

                 if rec_id and rec_id in kept_recording_ids:
                     f_out.write(line)
                     kept_count += 1

        os.replace(temp_track, track_file)
        manifest["track_slim"] = {"original": orig_count, "kept": kept_count}
        logger.info(f"Slimmed track: {kept_count}/{orig_count} kept")

def run(dump_dir: str, staging_dir: str):
    logger.info("Starting extract...")
    os.makedirs(staging_dir, exist_ok=True)

    canonical_mbids = get_canonical_mbids(dump_dir)
    manifest = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "files": []
    }

    mbdump_path = os.path.join(dump_dir, "mbdump.tar.bz2")
    mbdump_derived_path = os.path.join(dump_dir, "mbdump-derived.tar.bz2")

    extract_tar_file(mbdump_path, CORE_TABLES, staging_dir, canonical_mbids, set(), {}, manifest)
    extract_tar_file(mbdump_derived_path, DERIVED_TABLES, staging_dir, canonical_mbids, set(), {}, manifest)

    # We must also extract the canonical data directly into staging so `load` can pick them up.
    # The staging format contract says: "canonical_musicbrainz_data.csv.gz, etc." are provided.
    # Actually wait! The contract says `canonical_musicbrainz_data` is in postgres `ref_mb` schema.
    # Let's also copy canonical csv.gz files to staging for load.
    for canonical_file in ["canonical_musicbrainz_data.csv.gz", "canonical_recording_redirect.csv.gz", "canonical_release_redirect.csv.gz"]:
        src = os.path.join(dump_dir, canonical_file)
        dst = os.path.join(staging_dir, canonical_file)
        if os.path.exists(src):
            with open(src, 'rb') as f_in, open(dst, 'wb') as f_out:
                f_out.write(f_in.read())

    logger.info("Applying slim filters...")
    apply_slim_filter(staging_dir, canonical_mbids, manifest)

    # Generate final manifest with row counts and checksums
    # "manifest.json with row counts, sha256, SCHEMA_SEQUENCE, TIMESTAMP, source file"
    for filename in os.listdir(staging_dir):
        if filename.endswith(".tsv.gz") or filename.endswith(".csv.gz"):
            filepath = os.path.join(staging_dir, filename)
            sha256 = compute_sha256(filepath)

            # Count rows
            row_count = 0
            with gzip.open(filepath, 'rt', encoding='utf-8') as f:
                for _ in f:
                    row_count += 1

            if filename.endswith(".csv.gz"):
                row_count -= 1 # header

            manifest["files"].append({
                "filename": filename,
                "sha256": sha256,
                "rows": max(0, row_count)
            })

    with open(os.path.join(staging_dir, "manifest.json"), 'w') as f:
        json.dump(manifest, f, indent=2)

    logger.info("Extract complete.")
