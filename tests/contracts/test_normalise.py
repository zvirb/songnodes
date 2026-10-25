import json
import os
import pytest
from contracts.normalise import combined_lookup as songnodes_lookup
from pipeline.djlib.normalise import combined_lookup as stdlib_lookup

@pytest.mark.unit
def test_normalise_vectors():
    fixtures_path = os.path.join(os.path.dirname(__file__), '..', '..', 'contracts', 'fixtures', 'normalise_vectors.json')
    with open(fixtures_path, 'r') as f:
        vectors = json.load(f)

    for vector in vectors:
        sn_res = songnodes_lookup(vector["artist"], vector["title"])
        st_res = stdlib_lookup(vector["artist"], vector["title"])
        assert sn_res == vector["expected"], f"Songnodes failed for {vector}: got {sn_res}"
        assert st_res == vector["expected"], f"Stdlib failed for {vector}: got {st_res}"
