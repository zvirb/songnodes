import json
import os
from djlib.normalise import combined_lookup

def test_normalise_vectors():
    fixtures_path = os.path.join(os.path.dirname(__file__), '..', 'contracts', 'fixtures', 'normalise_vectors.json')
    with open(fixtures_path, 'r') as f:
        vectors = json.load(f)

    for vector in vectors:
        result = combined_lookup(vector["artist"], vector["title"])
        assert result == vector["expected"], f"Failed for {vector}: got {result}, expected {vector['expected']}"

if __name__ == '__main__':
    test_normalise_vectors()
    print("All tests passed.")
