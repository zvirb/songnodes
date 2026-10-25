# Draft: Portable Lookup Tiers (lite)

This is a draft spec for the two portable lookup tiers (ISRC; exact `combined_lookup`) so the laptop-side pipeline can start.
WP3 will publish the final version.

1. **Tier 1: ISRC Exact Match**
   - Query: Find exact match for the given ISRC in the lite lookup SQLite database.
   - If a single match is found, use it.
   - If multiple matches are found, apply tie-breaking rules (e.g., duration, mix version).

2. **Tier 2: Exact `combined_lookup` Match**
   - Query: Find exact match using the normalized `combined_lookup` string.
   - The normalized string is generated using `unidecode(re.sub(r'[^\w]+', '', artist_credit_name + recording_name).lower())`.
   - If a single match is found, use it.
   - If multiple matches are found, apply tie-breaking rules based on score and duration.
