# Identity Contracts

## Overview
This document defines how track identities work across the MusicBrainz reference data (`ref_mb`), the DJ library pipeline (`musicLibrary`), and the songnodes data layer.

## Canonical Track ID
- The canonical track id is the existing `silver_enriched_tracks.id`.
- Merges are handled via `identity.py` redirects, which resolve aliases or older IDs to the single canonical track.

## Mapping Identifiers
- `musicLibrary` tracks (identified by `bp:<id>` / `h:<sha1[:12]>`, `norm_key`), ISRC, MBID, TIDAL/Deezer/Beatport ids map onto silver identifier columns and evidence rows.
- No secondary track table is needed for identifier resolution.
- ISRC and MBID are treated as **attributes and match keys**, never as primary keys (one ISRC can map to several recordings).
- We utilize the `library` schema's `library.track_xref` cross-reference table only if the existing `silver_enriched_tracks` and evidence rows cannot effectively hold a 1:M source-system mapping.

## Source System Keys
- Natural key `(source_system, source_id)` uniquely maps a source entity.
- The `silver_enriched_tracks.id` is the canonical ID that ties these source keys together.
