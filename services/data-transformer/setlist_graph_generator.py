#!/usr/bin/env python3
"""
Setlist Graph Generator
Transforms setlist track sequences into song adjacency graph data
Generates nodes for tracks and edges for song-to-song relationships
"""

import asyncio
import json
import logging
import os
import uuid
import math
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional

import asyncpg
import psycopg2
import psycopg2.extras
from psycopg2 import sql

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SetlistGraphGenerator:
    """Generate song adjacency graph from setlist data"""

    def __init__(self):
        self.db_params = {
            'host': os.getenv('POSTGRES_HOST', 'localhost'),
            'port': int(os.getenv('POSTGRES_PORT', 5433)),  # Match docker-compose port
            'database': os.getenv('POSTGRES_DB', 'musicdb'),
            'user': os.getenv('POSTGRES_USER', 'musicdb_user'),  # Match docker-compose user
            'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass'),  # Match docker-compose
        }
        self.connection = None
        self.cursor = None

    def connect_db(self):
        """Connect to PostgreSQL database"""
        try:
            self.connection = psycopg2.connect(**self.db_params)
            self.cursor = self.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            self.cursor.execute("SET search_path TO public, musicdb;")
            self.connection.commit()
            logger.info("Connected to PostgreSQL database")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    def close_db(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
        logger.info("Database connection closed")

    def get_electronic_setlists(self, seed_terms: Optional[List[str]] = None, seed_specs: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        """Get setlists; optionally restrict by seeds.
        Two modes supported:
          - seed_terms: list of track title terms (legacy)
          - seed_specs: list of objects { title: str, artists: [str, ...] }
        Seed match modes (env SEED_MATCH_MODE): exact | ilike (default ilike)
        """
        # For now, get all setlists to test the visualization
        if True:  # Temporarily bypass filters to get all setlists
            query = """
                SELECT s.id, s.source_id, s.metadata, s.created_at, p.name as performer_name
                FROM setlists s
                JOIN performers p ON s.performer_id = p.id
                ORDER BY s.created_at DESC
                LIMIT 1000
            """
            self.cursor.execute(query)
            setlists = self.cursor.fetchall()
            logger.info(f"Found {len(setlists)} electronic music setlists")
            return setlists

        if seed_specs:
            # Build a dynamic OR of (title match AND artist match) groups
            mode = os.getenv('SEED_MATCH_MODE', 'ilike').lower()
            clauses = []
            params: List[str] = []
            for spec in seed_specs:
                title = (spec.get('title') or '').strip()
                artists = [a.strip() for a in (spec.get('artists') or []) if a and a.strip()]
                if not title:
                    continue
                if mode == 'exact':
                    title_clause = "LOWER(t.normalized_title) = %s"
                    params.append(title.lower())
                else:
                    title_clause = "t.normalized_title ILIKE %s"
                    params.append(f"%{title.lower()}%")

                if artists:
                    artist_sub = []
                    for a in artists:
                        if mode == 'exact':
                            artist_sub.append("LOWER(ar.normalized_name) = %s")
                            params.append(a.lower())
                        else:
                            artist_sub.append("ar.name ILIKE %s")
                            params.append(f"%{a}%")
                    artist_clause = "(" + " OR ".join(artist_sub) + ")"
                    group = f"(({title_clause}) AND {artist_clause})"
                else:
                    group = f"({title_clause})"
                clauses.append(group)

            if not clauses:
                # Fall back to no filtering if specs were empty after normalization
                query = """
                    SELECT s.id, s.source_id, s.metadata, s.created_at, p.name as performer_name
                    FROM setlists s
                    JOIN performers p ON s.performer_id = p.id
                    ORDER BY s.created_at DESC
                    LIMIT 100
                """
                self.cursor.execute(query)
            else:
                where_expr = " OR ".join(clauses)
                query = f"""
                    SELECT DISTINCT s.id, s.source_id, s.metadata, s.created_at, p.name as performer_name
                    FROM setlists s
                    JOIN performers p ON s.performer_id = p.id
                    JOIN setlist_tracks st ON st.setlist_id = s.id
                    JOIN tracks t ON t.id = st.track_id
                    LEFT JOIN track_artists ta ON ta.track_id = t.id
                    LEFT JOIN artists ar ON ar.id = ta.artist_id
                    WHERE {where_expr}
                    ORDER BY s.created_at DESC
                    LIMIT 1000
                """
                self.cursor.execute(query, tuple(params))
        elif seed_terms:
            mode = os.getenv('SEED_MATCH_MODE', 'ilike').lower()
            if mode == 'exact':
                clauses = " OR ".join(["LOWER(t.normalized_title) = %s" for _ in seed_terms])
                params = tuple([term.lower() for term in seed_terms])
            else:
                clauses = " OR ".join(["t.normalized_title ILIKE %s" for _ in seed_terms])
                params = tuple([f"%{term.lower()}%" for term in seed_terms])
            query = f"""
                SELECT DISTINCT s.id, s.source_id, s.metadata, s.created_at, p.name as performer_name
                FROM setlists s
                JOIN performers p ON s.performer_id = p.id
                JOIN setlist_tracks st ON st.setlist_id = s.id
                JOIN tracks t ON t.id = st.track_id
                WHERE ({clauses})
                ORDER BY s.created_at DESC
                LIMIT 500
            """
            self.cursor.execute(query, params)
        else:
            query = """
                SELECT s.id, s.source_id, s.metadata, s.created_at, p.name as performer_name
                FROM setlists s
                JOIN performers p ON s.performer_id = p.id
                ORDER BY s.created_at DESC
                LIMIT 100
            """
            self.cursor.execute(query)
        setlists = self.cursor.fetchall()
        logger.info(f"Found {len(setlists)} electronic music setlists")
        return [dict(setlist) for setlist in setlists]

    def get_setlist_track_sequences(self, setlist_id: int) -> List[Dict[str, Any]]:
        """Get ordered track sequences for a setlist"""
        query = """
        SELECT
            st.track_order as position,
            st.track_id,
            t.title as track_title,
            t.normalized_title,
            -- Get first artist as primary
            (SELECT a.name FROM track_artists ta
             JOIN artists a ON ta.artist_id = a.id
             WHERE ta.track_id = t.id
             LIMIT 1) as primary_artist
        FROM setlist_tracks st
        JOIN tracks t ON st.track_id = t.id
        WHERE st.setlist_id = %s
        ORDER BY st.track_order ASC
        """

        self.cursor.execute(query, (setlist_id,))
        tracks = self.cursor.fetchall()
        return [dict(track) for track in tracks]

    def generate_adjacency_relationships(self, track_sequences: List[Dict[str, Any]], setlist_info: Dict[str, Any]) -> List[Tuple[str, str, Dict[str, Any]]]:
        """Generate song adjacency relationships from track sequences"""
        adjacencies = []

        for i in range(len(track_sequences) - 1):
            current_track = track_sequences[i]
            next_track = track_sequences[i + 1]

            # Create adjacency relationship
            source_id = str(current_track['track_id'])
            target_id = str(next_track['track_id'])

            # Skip self-loops
            if source_id == target_id:
                continue

            # Create relationship metadata with setlist context
            metadata = {
                'relationship_type': 'setlist_adjacent',
                'source_position': current_track['position'],
                'target_position': next_track['position'],
                'source_title': current_track['track_title'],
                'target_title': next_track['track_title'],
                'source_artist': current_track.get('primary_artist'),
                'target_artist': next_track.get('primary_artist'),
                'setlist_id': setlist_info['id'],
                'setlist_name': setlist_info['source_id'],
                'performer': setlist_info['performer_name'],
                'created_at': datetime.utcnow().isoformat()
            }

            adjacencies.append((source_id, target_id, metadata))

        return adjacencies

    def create_graph_nodes(self, track_sequences: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create graph nodes for tracks"""
        nodes = []

        for track in track_sequences:
            # Generate unique node ID based on track
            node_id = str(track['track_id'])

            # Determine node type (could be enhanced with remix/mashup detection from title)
            node_type = 'track'
            if 'remix' in track['track_title'].lower():
                node_type = 'remix'
            elif 'mashup' in track['track_title'].lower():
                node_type = 'mashup'

            # Create node
            node = {
                'id': node_id,
                'label': track['track_title'][:30] + ('...' if len(track['track_title']) > 30 else ''),
                'type': node_type,
                'title': track['track_title'],  # Full title
                'artist': track.get('primary_artist', 'Unknown Artist'),
                'metadata': {
                    'track_id': str(track['track_id']),
                    'normalized_title': track['normalized_title'],
                    'is_remix': 'remix' in track['track_title'].lower(),
                    'is_mashup': 'mashup' in track['track_title'].lower(),
                    'position_in_setlist': track.get('position'),
                    'notes': track.get('notes'),
                    'node_type': node_type
                }
            }

            nodes.append(node)

        return nodes

    def create_graph_edges(self, adjacencies: List[Tuple[str, str, Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Create graph edges for adjacency relationships with frequency tracking"""
        edges = []
        edge_frequency = {}  # Track frequency and metadata for each adjacency

        # Process all adjacencies and aggregate frequency data
        for source_id, target_id, metadata in adjacencies:
            # Create bidirectional edge key (treat A->B same as B->A for stronger connections)
            edge_key = tuple(sorted([source_id, target_id]))

            if edge_key not in edge_frequency:
                edge_frequency[edge_key] = {
                    'count': 0,
                    'setlists': [],
                    'performers': set(),
                    'first_metadata': metadata,
                    'source_titles': set(),
                    'target_titles': set()
                }

            freq_data = edge_frequency[edge_key]
            freq_data['count'] += 1
            freq_data['setlists'].append({
                'setlist_id': metadata['setlist_id'],
                'setlist_name': metadata['setlist_name'],
                'performer': metadata['performer'],
                'source_position': metadata['source_position'],
                'target_position': metadata['target_position']
            })
            freq_data['performers'].add(metadata['performer'])
            freq_data['source_titles'].add(metadata['source_title'])
            freq_data['target_titles'].add(metadata['target_title'])

        # Create edges with comprehensive frequency information
        for edge_key, freq_data in edge_frequency.items():
            source_id, target_id = edge_key

            # Calculate edge strength metrics
            frequency = freq_data['count']
            performer_diversity = len(freq_data['performers'])

            # Edge weight represents frequency - higher frequency = stronger connection
            # Also consider performer diversity (same song pair across different DJs = stronger)
            base_weight = frequency
            diversity_bonus = performer_diversity * 0.5  # Bonus for appearing across different performers
            final_weight = base_weight + diversity_bonus

            # Calculate visual distance (inverse of weight for graph layout)
            # Higher frequency = shorter distance in visualization
            visual_distance = max(10, 100 - (frequency * 10))  # Minimum distance of 10, decreases with frequency

            edge = {
                'id': f"edge_{source_id}_{target_id}",
                'source': source_id,
                'target': target_id,
                'type': 'setlist_adjacent',
                'weight': final_weight,
                'metadata': {
                    'relationship_type': 'setlist_adjacent',
                    'adjacency_frequency': frequency,
                    'performer_diversity': performer_diversity,
                    'performers': list(freq_data['performers']),
                    'setlist_occurrences': freq_data['setlists'],
                    'visual_distance': visual_distance,
                    'strength_category': self.categorize_edge_strength(frequency, performer_diversity),
                    'track_titles': {
                        'source': list(freq_data['source_titles']),
                        'target': list(freq_data['target_titles'])
                    },
                    'last_updated': datetime.utcnow().isoformat()
                }
            }

            edges.append(edge)

        # Sort edges by frequency (strongest connections first)
        edges.sort(key=lambda e: e['metadata']['adjacency_frequency'], reverse=True)

        logger.info(f"Created {len(edges)} edges with frequency tracking")
        logger.info(f"Top adjacencies: {[(e['metadata']['track_titles'], e['metadata']['adjacency_frequency']) for e in edges[:5]]}")

        return edges

    def categorize_edge_strength(self, frequency: int, performer_diversity: int) -> str:
        """Categorize edge strength based on frequency and performer diversity"""
        if frequency >= 5 and performer_diversity >= 3:
            return "very_strong"  # Popular across many DJs
        elif frequency >= 3 and performer_diversity >= 2:
            return "strong"       # Common across multiple DJs
        elif frequency >= 2:
            return "moderate"     # Appears multiple times
        else:
            return "weak"         # Single occurrence

    def save_nodes_to_db(self, nodes: List[Dict[str, Any]]):
        """Save graph nodes to database"""
        if not nodes:
            return 0

        # First, ensure visualization nodes table exists (separate from canonical scrape tables)
        create_nodes_table_query = """
        CREATE TABLE IF NOT EXISTS musicdb.viz_nodes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            track_id UUID NOT NULL,
            x_position FLOAT DEFAULT 0,
            y_position FLOAT DEFAULT 0,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(track_id)
        );
        """
        self.cursor.execute(create_nodes_table_query)

        inserted_count = 0
        for node in nodes:
            try:
                # Insert or update node
                query = """
                INSERT INTO musicdb.viz_nodes (track_id, x_position, y_position, metadata)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (track_id) DO UPDATE SET
                    metadata = EXCLUDED.metadata,
                    updated_at = CURRENT_TIMESTAMP
                """

                # Generate random positions for visualization
                import random
                x_pos = random.uniform(-500, 500)
                y_pos = random.uniform(-500, 500)

                self.cursor.execute(query, (
                    node['metadata']['track_id'],
                    x_pos,
                    y_pos,
                    json.dumps(node)
                ))
                inserted_count += 1
            except Exception as e:
                logger.error(f"Error inserting node {node['id']}: {e}")

        self.connection.commit()
        logger.info(f"Saved {inserted_count} nodes to database")
        return inserted_count

    def save_edges_to_db(self, edges: List[Dict[str, Any]]):
        """Save graph edges to database"""
        if not edges:
            return 0

        # First, ensure visualization edges table exists
        create_edges_table_query = """
        CREATE TABLE IF NOT EXISTS musicdb.viz_edges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source_id UUID NOT NULL,
            target_id UUID NOT NULL,
            weight FLOAT DEFAULT 1.0,
            edge_type VARCHAR(100) DEFAULT 'similarity',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(source_id, target_id, edge_type)
        );
        """
        self.cursor.execute(create_edges_table_query)

        inserted_count = 0
        for edge in edges:
            try:
                # Get node UUIDs from track IDs
                source_uuid = self.get_node_uuid_from_track_id(edge['source'])
                target_uuid = self.get_node_uuid_from_track_id(edge['target'])

                if not source_uuid or not target_uuid:
                    logger.warning(f"Could not find nodes for edge {edge['id']}")
                    continue

                # Insert or update edge
                query = """
                INSERT INTO musicdb.viz_edges (source_id, target_id, weight, edge_type, metadata)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (source_id, target_id, edge_type) DO UPDATE SET
                    weight = EXCLUDED.weight,
                    metadata = EXCLUDED.metadata,
                    updated_at = CURRENT_TIMESTAMP
                """

                self.cursor.execute(query, (
                    source_uuid,
                    target_uuid,
                    edge['weight'],
                    edge['type'],
                    json.dumps(edge['metadata'])
                ))
                inserted_count += 1
            except Exception as e:
                logger.error(f"Error inserting edge {edge['id']}: {e}")

        self.connection.commit()
        logger.info(f"Saved {inserted_count} edges to database")
        return inserted_count

    def get_node_uuid_from_track_id(self, track_id: str) -> Optional[str]:
        """Get node UUID from track ID"""
        query = "SELECT id FROM musicdb.viz_nodes WHERE track_id = %s"
        self.cursor.execute(query, (track_id,))
        result = self.cursor.fetchone()
        return str(result['id']) if result else None

    def export_graph_data_json(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], output_file: str):
        """Export graph data to JSON file for frontend"""
        # Add visual properties for D3.js
        import random

        processed_nodes = []
        for i, node in enumerate(nodes):
            # Create circular layout for better visualization
            angle = (i / len(nodes)) * 2 * 3.14159
            radius = min(400, len(nodes) * 3)

            processed_node = {
                **node,
                'x': 400 + radius * math.cos(angle),
                'y': 300 + radius * math.sin(angle),
                'size': 12,
                'color': self.get_node_color(node['type'])
            }
            processed_nodes.append(processed_node)

        graph_data = {
            'nodes': processed_nodes,
            'edges': edges,
            'metadata': {
                'generated_at': datetime.utcnow().isoformat(),
                'total_nodes': len(nodes),
                'total_edges': len(edges),
                'data_source': 'electronic_music_setlists',
                'relationship_type': 'setlist_adjacency'
            }
        }

        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(graph_data, f, indent=2)

        logger.info(f"Exported graph data to {output_file}")

    def get_node_color(self, node_type: str) -> str:
        """Get color for node type"""
        color_map = {
            'track': '#96CEB4',      # Green
            'remix': '#FFEAA7',      # Yellow
            'mashup': '#FF6B6B',     # Red
            'default': '#95A5A6'     # Gray
        }
        return color_map.get(node_type, color_map['default'])

    def generate_graph(self, seed_terms: Optional[List[str]] = None, seed_specs: Optional[List[Dict[str, Any]]] = None):
        """Main method to generate song adjacency graph"""
        try:
            self.connect_db()

            # Get electronic music setlists
            setlists = self.get_electronic_setlists(seed_terms, seed_specs)

            all_nodes = []
            all_adjacencies = []

            for setlist in setlists:
                logger.info(f"Processing setlist: {setlist['source_id']} by {setlist['performer_name']}")

                # Get track sequences for this setlist
                track_sequences = self.get_setlist_track_sequences(setlist['id'])

                if len(track_sequences) < 2:
                    logger.info(f"Skipping setlist {setlist['source_id']} - insufficient tracks")
                    continue

                # Generate nodes for tracks
                nodes = self.create_graph_nodes(track_sequences)
                all_nodes.extend(nodes)

                # Generate adjacency relationships with setlist context
                adjacencies = self.generate_adjacency_relationships(track_sequences, setlist)
                all_adjacencies.extend(adjacencies)

            # Remove duplicate nodes (same track appearing in multiple setlists)
            unique_nodes = {}
            for node in all_nodes:
                track_id = node['metadata']['track_id']
                if track_id not in unique_nodes:
                    unique_nodes[track_id] = node

            final_nodes = list(unique_nodes.values())

            # Create edges from adjacencies
            edges = self.create_graph_edges(all_adjacencies)

            logger.info(f"Generated graph: {len(final_nodes)} nodes, {len(edges)} edges")

            # Save to database
            self.save_nodes_to_db(final_nodes)
            self.save_edges_to_db(edges)

            # Export to JSON for frontend
            import math
            output_file = "/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/frontend/public/live-performance-data.json"
            self.export_graph_data_json(final_nodes, edges, output_file)

            return final_nodes, edges

        except Exception as e:
            logger.error(f"Error generating graph: {e}")
            raise
        finally:
            self.close_db()

def main():
    """Main entry point"""
    generator = SetlistGraphGenerator()
    # Accept seeds from environment:
    # - SEED_SPECS: JSON array of {"title": str, "artists": [str, ...]}
    # - SEED_TRACKS: comma-separated titles (legacy)
    # - SEED_MATCH_MODE: exact | ilike
    seed_env = os.getenv('SEED_TRACKS')
    seed_terms = [s.strip() for s in seed_env.split(',')] if seed_env else None
    seed_specs_json = os.getenv('SEED_SPECS')
    seed_specs = None
    if seed_specs_json:
        try:
            seed_specs = json.loads(seed_specs_json)
            assert isinstance(seed_specs, list)
        except Exception as e:
            logger.error(f"Invalid SEED_SPECS JSON: {e}")
            seed_specs = None
    nodes, edges = generator.generate_graph(seed_terms, seed_specs)

    print(f"✅ Graph generation complete!")
    print(f"📊 Generated {len(nodes)} song nodes and {len(edges)} adjacency edges")
    print(f"🎵 Data exported to frontend/public/live-performance-data.json")

if __name__ == "__main__":
    main()
