# Decision Doc: WP0 Contracts, DDL, Fixtures

**Date:** 2026-10-25
**Package:** WP0

## What
We have established the foundational contracts, DDL schema, fixtures, and normalization procedures required for the MetaBrainz reference data and `musicLibrary` pipeline to integrate into `songnodes`.

## Why
Per the integration plan, WP0 is the prerequisite for all parallel agents to begin work. It sets up testable contracts (API specs, schemas) and dummy fixtures so packages can be built out before real datasets (which are up to 14GB) are loaded.

## Sources
- `plan/INTEGRATION_PLAN.md`
- `plan/research/mb_import.md`
- `plan/research/matching.md`
- `plan/research/integration_patterns.md`

## Deviations / Implementation Notes
- **Normalization:** `combined_lookup` was built in two flavors—one using `unidecode` for the main songnodes platform and one using Python 3.10 stdlib (`unicodedata.normalize`) for the `djlib` pipeline. The stdlib approach cannot effectively transliterate non-Latin strings perfectly like `unidecode`, which is an accepted limitation for the pipeline's lite lookup since most track names fall within Latin or ASCII bounds. Both pass all standard vectors defined in the contract.
- **Migration Numbers:** As noted in the updated addendum, migration numbers are strictly within the `100-119` block for this package. The guard script `check_migrations.py` has been updated to enforce unique pairings of `_up` and `_down` within new migration ranges.

## Next Steps
All other packages (WP2, WP3, WP4, WP5, WP8, WP9) can now parallelize their builds against these interfaces.
