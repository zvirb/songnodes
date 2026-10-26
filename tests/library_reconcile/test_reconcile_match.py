import json
import os
from library.reconcile.match import find_candidates

def test_find_candidates():
    fixture_path = os.path.join(os.path.dirname(__file__), 'fixtures', 'planted.json')
    with open(fixture_path) as f:
        data = json.load(f)

    def to_row(t, is_lib=False):
        row = {
            'id': t['id'],
            'artist_name': t['artist_name'] if not is_lib else t.get('artist', ''),
            'track_title': t['track_title'] if not is_lib else t.get('title', ''),
            'isrc': t.get('isrc'),
            'musicbrainz_id': t.get('musicbrainz_id') if not is_lib else t.get('mbid')
        }
        if is_lib and 'norm_key' in t:
            row['norm_key'] = t['norm_key']
        return row

    lib_rows = [to_row(t, True) for t in data['library']]
    sil_rows = [to_row(t, False) for t in data['silver']]

    candidates = find_candidates(lib_rows, sil_rows)

    candidate_map = {(c.library_id, c.silver_id): c for c in candidates}

    assert ('lib-1', 'sil-1') in candidate_map
    assert any(e['rule'] == 'norm_key_equality' for e in candidate_map[('lib-1', 'sil-1')].evidence)

    assert ('lib-2', 'sil-2') in candidate_map
    assert any(e['rule'] == 'isrc_equality' for e in candidate_map[('lib-2', 'sil-2')].evidence)

    assert ('lib-3', 'sil-3') in candidate_map
    assert any(e['rule'] == 'mbid_equality' for e in candidate_map[('lib-3', 'sil-3')].evidence)

    assert ('lib-4', 'sil-4') in candidate_map
    assert any(e['rule'] == 'isrc_equality' for e in candidate_map[('lib-4', 'sil-4')].evidence)
    assert any(e['rule'] == 'mbid_equality' for e in candidate_map[('lib-4', 'sil-4')].evidence)

    assert ('lib-5', 'sil-5') not in candidate_map

    assert len(candidates) == 4
