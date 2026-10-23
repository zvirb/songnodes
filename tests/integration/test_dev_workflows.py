"""Real database/API regression checks for the minimal Compose development stack.

Run: python -m unittest discover -s tests/integration -p test_dev_workflows.py -v
Synthetic records are uniquely identified and removed; existing data is preserved.
"""
import json
from pathlib import Path
import subprocess
import unittest
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[2]


def sql(statement):
    return subprocess.check_output([
        'docker', 'compose', '-f', 'compose.dev.yaml', 'exec', '-T', 'postgres',
        'psql', '-U', 'songnodes', '-d', 'songnodes', '-v', 'ON_ERROR_STOP=1', '-At',
    ], cwd=ROOT, input=statement.encode(), stderr=subprocess.PIPE).decode()


def request(port, path, method='GET', payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = Request(f'http://127.0.0.1:{port}{path}', data=data, method=method,
                  headers={'Content-Type': 'application/json'})
    try:
        response = urlopen(req, timeout=15)
    except HTTPError as error:
        response = error
    with response:
        body = response.read()
        return response.status, json.loads(body) if body else None


class DevelopmentWorkflows(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ids = [str(uuid4()) for _ in range(4)]
        cls.nodes = [f'song_{value}' for value in cls.ids]
        cls.targets = set()
        cls.marker = str(uuid4())
        # Register cleanup before inserting, so a setup error cannot strand rows.
        cls.addClassCleanup(cls.cleanup)
        a, b, c, unknown = cls.ids
        sql(f"""BEGIN;
          INSERT INTO silver_enriched_tracks
            (id, artist_name, track_title, validation_status, enrichment_metadata, energy)
          VALUES
            ('{a}', 'Integration Artist', '{cls.marker} 50%_literal', 'valid', '{{}}', 0),
            ('{b}', 'Integration Artist', '{cls.marker} B', 'valid', '{{}}', 0.5),
            ('{c}', 'Integration Artist', '{cls.marker} C', 'valid', '{{}}', 0.8),
            ('{unknown}', 'Unknown', '{cls.marker} hidden', 'valid', '{{}}', NULL);
          INSERT INTO silver_track_transitions (from_track_id, to_track_id, occurrence_count)
          VALUES ('{a}', '{b}', 3), ('{b}', '{a}', 2), ('{b}', '{c}', 1), ('{a}', '{unknown}', 99);
          COMMIT;""")

    @classmethod
    def cleanup(cls):
        for target in cls.targets:
            request(8082, f'/api/v1/target-tracks/{target}', 'DELETE')
        values = ','.join(f"'{value}'" for value in cls.ids)
        sql(f'DELETE FROM outbox_events WHERE aggregate_id IN ({values}); '
            f'DELETE FROM silver_enriched_tracks WHERE id IN ({values});')

    def graph(self, path):
        status, body = request(8084, path)
        self.assertEqual(status, 200, body)
        return body

    def test_graph_aliases_and_visibility(self):
        for path in ['/api/graph/data', '/api/v1/graph']:
            data = self.graph(path)
            ids = {node['id'] for node in data['nodes']}
            self.assertTrue(set(self.nodes[:3]).issubset(ids))
            self.assertNotIn(self.nodes[3], ids)
            for edge in data['edges']:
                self.assertIn(edge['source'], ids)
                self.assertIn(edge['target'], ids)
            node = next(node for node in data['nodes'] if node['id'] == self.nodes[0])
            self.assertEqual(node['metadata']['energy'], 0)

    def test_pagination_keeps_total_after_last_page(self):
        result = self.graph('/api/graph/nodes?limit=1&offset=1000000')
        self.assertEqual(result['nodes'], [])
        self.assertGreaterEqual(result['total'], 3)

    def test_induced_edges_are_directed_and_empty_ids_mean_empty(self):
        path = '/api/graph/edges?' + urlencode({'node_ids': ','.join(self.nodes[:2])})
        edges = self.graph(path)['edges']
        self.assertEqual({(edge['source'], edge['target'], edge['weight']) for edge in edges},
                         {(self.nodes[0], self.nodes[1], 3), (self.nodes[1], self.nodes[0], 2)})
        self.assertEqual(self.graph('/api/graph/edges?node_ids=')['edges'], [])

    def test_neighborhood_depth_and_id_formats(self):
        for center in [self.nodes[0], self.ids[0]]:
            one = self.graph(f'/api/graph/neighborhood/{center}?radius=1')['data']
            two = self.graph(f'/api/graph/neighborhood/{center}?radius=2')['data']
            self.assertEqual({node['id'] for node in one['nodes']}, set(self.nodes[:2]))
            self.assertEqual({node['id'] for node in two['nodes']}, set(self.nodes[:3]))

    def test_query_bounds_and_missing_nodes(self):
        for path in ['/api/graph/nodes?limit=-1', '/api/graph/nodes?max_depth=100',
                     '/api/graph/edges?offset=-1', '/api/graph/search?q=%20',
                     '/api/graph/neighborhood/invalid', f'/api/graph/neighborhood/{self.nodes[0]}?radius=3']:
            self.assertEqual(request(8084, path)[0], 422, path)
        self.assertEqual(request(8084, f'/api/graph/neighborhood/song_{uuid4()}')[0], 404)

    def test_literal_search_and_legacy_search_alias(self):
        for route in ['/api/graph/search', '/api/v1/visualization/search']:
            data = self.graph(route + '?' + urlencode({'q': f'{self.marker} 50%_literal'}))
            self.assertEqual([row['id'] for row in data['results']], [self.nodes[0]])
            self.assertEqual(data['status'], 'ok')
        stats = self.graph('/api/graph/stats')
        self.assertGreaterEqual(stats['database_stats']['total_tracks'], 4)
        self.assertGreaterEqual(stats['graph_stats']['nodes']['total_nodes'], 3)

    def test_visualization_graph_has_no_dangling_edges(self):
        status, data = request(8084, '/api/v1/visualization/graph', 'POST',
                               {'center_node_id': self.nodes[0], 'max_depth': 1, 'max_nodes': 1})
        self.assertEqual(status, 200, data)
        self.assertEqual([node['id'] for node in data['nodes']], [self.nodes[0]])
        self.assertEqual(data['edges'], [])

    def test_target_crud_and_repeatable_migration(self):
        status, target = request(8082, '/api/v1/target-tracks', 'POST', {
            'title': f'Target {self.marker}', 'artist': 'Integration Artist', 'priority': 'high',
            'genres': ['House'], 'search_terms': ['extended'], 'is_active': True})
        self.assertEqual(status, 201, target)
        identifier = target['track_id']
        self.targets.add(identifier)
        migration = (ROOT / 'sql/migrations/012_target_tracks_up.sql').read_text()
        sql(migration)
        sql(migration)
        status, listed = request(8082, '/api/v1/target-tracks')
        self.assertEqual(status, 200, listed)
        self.assertTrue(any(row['track_id'] == identifier for row in listed))
        status, updated = request(8082, f'/api/v1/target-tracks/{identifier}', 'PUT', {
            'title': 'Corrected title', 'priority': 'low', 'archived': True,
            'is_active': False, 'completion_percentage': 100, 'genres': [], 'search_terms': []})
        self.assertEqual(status, 200, updated)
        self.assertEqual(updated['title'], 'Corrected title')
        self.assertEqual(updated['genres'], [])
        self.assertFalse(updated['is_active'])
        self.assertEqual(updated['completion_percentage'], 100)
        self.assertEqual(request(8082, f'/api/v1/target-tracks/{identifier}', 'PUT', {})[0], 400)
        self.assertEqual(request(8082, f'/api/v1/target-tracks/{identifier}', 'PUT', {'completion_percentage': 101})[0], 422)
        self.assertEqual(request(8082, f'/api/v1/target-tracks/{identifier}', 'DELETE'), (204, None))
        self.targets.remove(identifier)
        self.assertEqual(request(8082, f'/api/v1/target-tracks/{identifier}', 'DELETE')[0], 404)
        self.assertEqual(request(8082, f'/api/v1/target-tracks/{identifier}', 'PUT', {'archived': False})[0], 404)

    def test_target_validation_does_not_return_500(self):
        for payload in [{'title': '  ', 'artist': 'Artist'}, {'title': 'Track'},
                        {'title': 'Track', 'artist': 'Artist', 'priority': 'urgent'}]:
            self.assertEqual(request(8082, '/api/v1/target-tracks', 'POST', payload)[0], 422)
        self.assertEqual(request(8082, '/api/v1/target-tracks/not-a-uuid', 'DELETE')[0], 422)

    def test_manual_metadata_is_visible_without_cache_delay(self):
        status, result = request(8082, f'/api/tracks/{self.nodes[1]}', 'PATCH',
                                 {'track_title': f'{self.marker} corrected', 'genre': 'House', 'bpm': 130})
        self.assertEqual(status, 200, result)
        self.assertEqual(result['genre'], ['House'])
        data = self.graph(f'/api/graph/neighborhood/{self.nodes[1]}')['data']
        track = next(node for node in data['nodes'] if node['id'] == self.nodes[1])
        self.assertEqual(track['title'], f'{self.marker} corrected')
        self.assertEqual(track['metadata']['bpm'], 130)
        self.assertEqual(request(8082, f'/api/tracks/{uuid4()}', 'PATCH', {'genre': 'House'})[0], 404)
        self.assertEqual(request(8082, f'/api/tracks/{self.nodes[1]}', 'PATCH', {'bpm': 0})[0], 422)


if __name__ == '__main__':
    unittest.main()
