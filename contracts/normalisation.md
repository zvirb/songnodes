# Normalization Contracts

## Overview
This document specifies the behavior of the text normaliser (used for `combined_lookup`) and explains its properties. The normalizer removes accents, ignores case and punctuation, handles feat./ft./vs./&/x and mix/version brackets, and provides a stable representation.

## Goal
Reproduce the canonical dump's `combined_lookup` exactly:
`unidecode(re.sub(r'[^\w]+', '', artist_credit_name + recording_name).lower())`

## Implementations
There must be two implementations that pass the same set of vectors:
1. `contracts/normalise.py`: The songnodes Python implementation, allowed to use `unidecode`.
2. `pipeline/djlib/normalise.py`: The `musicLibrary` implementation, which must use **Python 3.10 stdlib only**.

### Non-Latin Scripts
For the stdlib-only implementation: Since `unidecode` is not available, we use `unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')`. This will strip non-Latin characters instead of transliterating them. We document this gap here: exact transliteration (like "ni hao" from Chinese) requires `unidecode` and won't match perfectly in stdlib, but it's acceptable for the lite lookup since most DJ track names use ASCII or Latin extensions.

## Compatibility with existing methods
- Do not change `matching.normalize_text`, `artist_key`, or `parse_title`.
- You can reuse `parse_title` if needed, but this new function `combined_lookup(artist_credit_name, recording_name)` is separate and dedicated to this canonical lookup.
