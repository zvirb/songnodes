# Staging Format

## MusicBrainz Staging Data
- Located at `data/metabrainz/staging/<dump-version>/<table>.tsv.gz`.
- Format: `COPY text` (tab-delimited, `\N` = NULL, backslash escapes `\t \n \r \\ \b \f \v`, optional `\.` end line).
- Header-free.
- Accompanied by a `manifest.json`.

## Canonical Data
- Due to stdlib-only pipeline constraints (cannot read `.tar.zst`), canonical data is provided as gzip CSV:
  - `canonical_musicbrainz_data.csv.gz`
  - `canonical_recording_redirect.csv.gz`
  - `canonical_release_redirect.csv.gz`
