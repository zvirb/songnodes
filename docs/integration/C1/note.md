# Resolver merging decision

The resolver code in `services/reference-data/resolver/resolver.py` and `services/reference_data/resolver/resolver.py` contained slight differences. We merged all logic from the hyphenated version (`services/reference-data/resolver/resolver.py`) into the underscored version (`services/reference_data/resolver/resolver.py`), making it the canonical one. We updated `contracts/ownership.yaml` to point to the underscored folder (`services/reference_data/resolver/`).

The kept resolver successfully uses the ref_mb connection string setup and `MB_LOCAL_ENABLED` configuration which are read from `settings.py`. Note that while `resolver.py` itself doesn't directly import `MB_LOCAL_ENABLED`, the codebase infrastructure instantiates `MusicBrainzResolver` and handles the connections via `settings.py`, which is gated by `MB_LOCAL_ENABLED`.

Finally, we renamed `tests/resolver/run_eval.py` to `tests/resolver/test_run_eval.py` so that `pytest` can automatically discover and run the tests.
