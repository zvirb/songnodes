# Decision: Resolver Strategy

## What
Implemented WP3 local MusicBrainz resolver, providing a cascade from exact ISRC and canonical Combined Lookup to fuzzy matching via pg_trgm.

## Why
As required by the Integration Plan, we prioritize local matching using downloaded canonical dumps. This ensures low latency (< 50ms requirement) without reliance on web API rate limits.

## Strategy Details
1. **Mix Class Guards**: Evaluates track title mix variants (radio edit, extended, remix) and prevents mismatches.
2. **Postgres GIN index on pg_trgm**: Facilitates fuzzy lookup on recording/artist text.
3. **Canonical Normalization**: Uses `unidecode` based `contracts/normalise.py:combined_lookup` mapping `[^\w]+` to spaces, lowercased.
4. **Sqlite support for lite tiered matching**: Tiers 1 and 2 operate locally via `docs/integration/WP3/lite_tiers.md` definitions.

## Deviations
We could not fully integrate docker testcontainers for live database evaluations within this agent environment; as a result, evaluation logic was successfully dry-run tested locally and documented manually from mocked fixtures.
