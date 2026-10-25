# Research brief: resolving noisy DJ track strings to MBIDs (agent-gathered 25 Oct 2026)
Thresholds below are **guesses to be calibrated**, not published values.

**Verified**
- Canonical data CSV columns: id, artist_credit_id, artist_mbids, artist_credit_name, release_mbid, release_name, recording_mbid, recording_name, combined_lookup, score, year. Redirect file: recording_mbid → canonical_recording_mbid, canonical_release_mbid. Refreshed on the 1st and 15th. Canonical MBIDs are not guaranteed stable: store dump version/date with every match.
- `combined_lookup` (listenbrainz-server `mbid_mapping/mapping/canonical_musicbrainz_data.py`, master): `unidecode(re.sub(r'[^\w]+', '', artist_credit_name + recording_name).lower())` — concatenate with no separator, strip every non-word char including spaces, lowercase, then unidecode (third-party; not stdlib). Dedup keeps one row per combined_lookup; check the score direction before relying on it. The normaliser must reproduce `combined_lookup` for 100% of ≥1,000 real rows.
- MusicBrainz style: remixes, dubs, radio/single/extended edits are separate recordings; remasters are not. Keep the mix string in the match key.
- ISRC: edits/remixes/remasters get their own ISRC. Treat ISRC as strong but not unique (multiple MBIDs → tie-break by title/mix/duration; the multi-recording case is unverified).
- pg_trgm: default similarity_threshold 0.3; `%` uses GIN/GiST; KNN `<->` is efficient on GiST. SQLite FTS5 `trigram` tokenizer gives substring candidates, no similarity score; terms under 3 chars match nothing. RapidFuzz `token_set_ratio` returns 100 for subset token sets (dangerous: "Free Your Mind" vs "Free Your Mind (Extended Remix)") — strip and compare the mix separately.
- `lb-matching-tools` MetadataCleaner: strip feat./remaster tags, retry on failure; no thresholds published.

**Recommended cascade**
0. Parse mix/version bracket, feat./ft., vs./&/x, remixer. Keep raw + parsed.
1. ISRC exact. One MBID → accept (high). Several → tie-break.
2. Exact `combined_lookup`: with mix; then without if the mix is Original/Extended; primary artist only; feat. removed; artist order swapped. Tie-break by score then duration.
3. Trigram candidates (pg_trgm GIN or FTS5), rerank top 20–50 with RapidFuzz on artist and title separately; start artist ≥ 90 and title ≥ 90 auto-accept, title ≥ 80 and artist ≥ 95 review.
4. Duration guard (seconds): start ±5 s same-mix; > 20 s with a different mix token = different version.
5. Mix-class rule: original/extended/radio/club/dub/instrumental/remix by X/VIP/edit. Different classes never auto-accept; remixer mismatch is a hard reject.

**Evaluation**
- Silver set: ISRC-matched rows with the ISRC hidden; does the text cascade recover the same MBID?
- Stratified labelled sample (~500–1,000) for the rest. Report precision, recall, coverage per stage and per mix class; sweep thresholds; choose auto-accept for the best fit to the ground truth (target ≥ 98% precision is a guess) and keep a review band.
- Store per match: mbid, canonical_mbid, method (isrc / lookup_exact / lookup_variant / fuzzy), variant, artist_sim, title_sim, duration_delta, mix_class_match, confidence bucket, dump version, normaliser version.
- Inspect confusion pairs: radio vs extended, original vs remix, same title different artist, feat. swaps, canonical-redirect collisions.

**Unverified:** how `score` is derived; ListenBrainz's Typesense query parameters; any published threshold or duration tolerance.
