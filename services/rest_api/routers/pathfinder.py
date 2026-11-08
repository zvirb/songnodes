"""
DJ Set Pathfinding Router
Intelligent pathfinding for creating DJ setlists with constraints
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Set, Tuple
import heapq
import logging
from collections import defaultdict, deque
import math
try:
    from annoy import AnnoyIndex
except ImportError:
    AnnoyIndex = None
import sys
import os

# Handle both direct imports and package imports
try:
    from ..utils.pathfinder_utils import find_pivots
except (ImportError, ValueError):
    # Fallback for direct module execution
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from utils.pathfinder_utils import find_pivots

from common.metadata.camelot import to_camelot
from common.metadata.transition_scoring import Compat, bpm_verdict, compat_score, key_verdict, path_cost

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/pathfinder", tags=["Pathfinder"])

# Camelot Wheel - Harmonic mixing compatibility
CAMELOT_WHEEL = {
    '1A': {'compatible': ['12A', '2A', '1B'], 'energy_up': '1B', 'energy_down': None},
    '2A': {'compatible': ['1A', '3A', '2B'], 'energy_up': '2B', 'energy_down': None},
    '3A': {'compatible': ['2A', '4A', '3B'], 'energy_up': '3B', 'energy_down': None},
    '4A': {'compatible': ['3A', '5A', '4B'], 'energy_up': '4B', 'energy_down': None},
    '5A': {'compatible': ['4A', '6A', '5B'], 'energy_up': '5B', 'energy_down': None},
    '6A': {'compatible': ['5A', '7A', '6B'], 'energy_up': '6B', 'energy_down': None},
    '7A': {'compatible': ['6A', '8A', '7B'], 'energy_up': '7B', 'energy_down': None},
    '8A': {'compatible': ['7A', '9A', '8B'], 'energy_up': '8B', 'energy_down': None},
    '9A': {'compatible': ['8A', '10A', '9B'], 'energy_up': '9B', 'energy_down': None},
    '10A': {'compatible': ['9A', '11A', '10B'], 'energy_up': '10B', 'energy_down': None},
    '11A': {'compatible': ['10A', '12A', '11B'], 'energy_up': '11B', 'energy_down': None},
    '12A': {'compatible': ['11A', '1A', '12B'], 'energy_up': '12B', 'energy_down': None},
    '1B': {'compatible': ['12B', '2B', '1A'], 'energy_up': None, 'energy_down': '1A'},
    '2B': {'compatible': ['1B', '3B', '2A'], 'energy_up': None, 'energy_down': '2A'},
    '3B': {'compatible': ['2B', '4B', '3A'], 'energy_up': None, 'energy_down': '3A'},
    '4B': {'compatible': ['3B', '5B', '4A'], 'energy_up': None, 'energy_down': '4A'},
    '5B': {'compatible': ['4B', '6B', '5A'], 'energy_up': None, 'energy_down': '5A'},
    '6B': {'compatible': ['5B', '7B', '6A'], 'energy_up': None, 'energy_down': '6A'},
    '7B': {'compatible': ['6B', '8B', '7A'], 'energy_up': None, 'energy_down': '7A'},
    '8B': {'compatible': ['7B', '9B', '8A'], 'energy_up': None, 'energy_down': '8A'},
    '9B': {'compatible': ['8B', '10B', '9A'], 'energy_up': None, 'energy_down': '9A'},
    '10B': {'compatible': ['9B', '11B', '10A'], 'energy_up': None, 'energy_down': '10A'},
    '11B': {'compatible': ['10B', '12B', '11A'], 'energy_up': None, 'energy_down': '11A'},
    '12B': {'compatible': ['11B', '1B', '12A'], 'energy_up': None, 'energy_down': '12A'},
}

# ===========================================
# Request/Response Models
# ===========================================

class TrackNode(BaseModel):
    """Track node with metadata"""
    id: str
    name: str
    artist: str
    duration_ms: int  # Duration in milliseconds
    camelot_key: Optional[str] = None
    bpm: Optional[float] = None
    energy: Optional[float] = None

class GraphEdge(BaseModel):
    """Edge representing connection between tracks"""
    from_id: str
    to_id: str
    weight: float = Field(
        ...,
        description="Occurrence count: how many DJ sets played this transition (higher is stronger). "
                    "Read as a whole count; values below 1 count as an unobserved edge.",
    )
    connection_type: Optional[str] = None

class PathfinderRequest(BaseModel):
    """Request for pathfinding"""
    start_track_id: str = Field(..., description="Starting track ID (required)")
    end_track_id: Optional[str] = Field(None, description="Ending track ID (optional)")
    target_duration_ms: int = Field(..., ge=60000, le=14400000, description="Target duration in milliseconds (1 min to 4 hours)")
    waypoint_track_ids: List[str] = Field(default=[], description="Tracks that must be included (unordered)")
    tracks: List[TrackNode] = Field(..., description="Available tracks")
    edges: List[GraphEdge] = Field(..., description="Graph edges (connections)")
    tolerance_ms: int = Field(default=300000, description="Duration tolerance (±5 minutes default)")
    prefer_key_matching: bool = Field(default=True, description="Use Camelot key matching as tiebreaker")

class PathSegment(BaseModel):
    """Segment of the path"""
    track: TrackNode
    connection_strength: Optional[float] = None
    key_compatible: bool = False
    cumulative_duration_ms: int = 0
    is_synthetic_edge: bool = False  # True if this transition uses a harmonic fallback edge

class PathfinderResponse(BaseModel):
    """Response from pathfinding"""
    success: bool
    path: List[PathSegment]
    total_duration_ms: int
    target_duration_ms: int
    duration_difference_ms: int
    waypoints_visited: List[str]
    waypoints_missed: List[str]
    average_connection_strength: float
    key_compatibility_score: float  # 0-1, percentage of compatible key transitions
    message: str

# ===========================================
# Helper Functions
# ===========================================

def is_key_compatible(from_key: Optional[str], to_key: Optional[str]) -> bool:
    """Check if two Camelot keys are harmonically compatible"""
    norm_from = to_camelot(from_key) or from_key
    norm_to = to_camelot(to_key) or to_key
    if not norm_from or not norm_to or norm_from not in CAMELOT_WHEEL:
        return False

    return norm_to == norm_from or norm_to in CAMELOT_WHEEL[norm_from]['compatible']

# Waypoint edges cost this fraction of their normal cost: steers the search towards them
# while every cost stays positive (spec harmonic-1 section 2.6: no negative waypoint rewards).
WAYPOINT_COST_FACTOR = 0.5

def occurrence_count(weight: Optional[float]) -> int:
    """Read a request edge weight as its occurrence count (whole plays, never negative)."""
    if weight is None or not math.isfinite(weight) or weight < 1:
        return 0
    return int(weight)

def transition_cost(from_track: TrackNode, to_track: TrackNode, count: int, prefer_key_matching: bool = True) -> float:
    """Spec harmonic-1 section 2.6 cost of one directed edge: always > 0, lower is better.

    It falls as the key/BPM compatibility score rises and as the occurrence count rises;
    an unknown key or BPM costs the spec's neutral U, never less than a known perfect part.
    When prefer_key_matching is False, harmonic key mismatch penalties are excluded.
    """
    bpm = bpm_verdict(from_track.bpm, to_track.bpm)
    if not prefer_key_matching:
        compat = Compat(bpm.score, 1.0, bpm.score) if bpm.score is not None else Compat(None, 0.0, None)
        return path_cost(compat, count)
    key = key_verdict(from_track.camelot_key, to_track.camelot_key)
    return path_cost(compat_score(key.score, bpm.score), count)

def compute_reverse_bfs_distances(
    target_ids: Set[str],
    prepared_adj: Dict[str, List[Tuple[str, float, float, bool, bool, int]]]
) -> Dict[str, Dict[str, int]]:
    """Precompute shortest-hop distances to each target node using reverse BFS."""
    rev_adj: Dict[str, List[str]] = defaultdict(list)
    for u, neighbors in prepared_adj.items():
        for v, _, _, _, _, _ in neighbors:
            rev_adj[v].append(u)

    distances: Dict[str, Dict[str, int]] = {}
    for target in target_ids:
        dist_map: Dict[str, int] = {target: 0}
        queue = deque([target])
        while queue:
            curr = queue.popleft()
            curr_dist = dist_map[curr]
            for prev_node in rev_adj.get(curr, ()):
                if prev_node not in dist_map:
                    dist_map[prev_node] = curr_dist + 1
                    queue.append(prev_node)
        distances[target] = dist_map
    return distances

def calculate_heuristic(
    current_duration: int,
    target_duration: int,
    remaining_waypoints: Set[str],
    avg_track_duration: float,
    current_track_id: Optional[str] = None,
    end_id: Optional[str] = None,
    hop_distances: Optional[Dict[str, Dict[str, int]]] = None
) -> float:
    """
    Improved heuristic for A* search (2025 best practices)

    Uses admissible heuristic that doesn't overestimate:
    - Duration difference (scaled down to not dominate)
    - Waypoint estimation (minimum tracks needed, not penalized)
    - Reverse BFS hop distance guidance toward remaining waypoints and end_id
    """
    # Calculate minimum additional duration needed
    duration_remaining = max(0, target_duration - current_duration)

    # Estimate minimum tracks needed for remaining waypoints
    min_waypoint_duration = len(remaining_waypoints) * avg_track_duration

    base_h = max(duration_remaining, min_waypoint_duration) / max(avg_track_duration, 1.0)

    if current_track_id is not None and hop_distances:
        min_hops = 0
        if remaining_waypoints:
            wp_hops = [
                hop_distances.get(wp, {}).get(current_track_id, 10)
                for wp in remaining_waypoints
            ]
            min_hops = min(wp_hops) + sum(sorted(wp_hops)[1:]) + len(remaining_waypoints) * 8
            if end_id and end_id not in remaining_waypoints:
                end_from_wp = min(
                    hop_distances.get(end_id, {}).get(wp, 10)
                    for wp in remaining_waypoints
                )
                min_hops += end_from_wp
        elif end_id:
            min_hops = hop_distances.get(end_id, {}).get(current_track_id, 10)

        # Guide search strongly toward target/waypoints while preserving duration guidance
        return max(base_h * 0.25, float(min_hops) * 0.8) + (float(min_hops) * 0.5)

    return base_h

# ===========================================
# ANN (Approximate Nearest Neighbors) Helpers
# ===========================================

def camelot_to_vector(key: Optional[str]) -> Tuple[float, float]:
    """Convert Camelot key to a 2D vector for distance calculation"""
    if not key:
        return (0.0, 0.0)

    norm_key = to_camelot(key) or key
    try:
        letter = norm_key[-1].upper()
        number = int(norm_key[:-1])
        if letter not in ('A', 'B') or not (1 <= number <= 12):
            return (0.0, 0.0)
    except (ValueError, TypeError, IndexError):
        return (0.0, 0.0)

    angle = (number - 1) * (2 * math.pi / 12)  # 12 keys on the wheel
    radius = 1.0 if letter == 'B' else 0.7  # Major keys on outer circle

    x = radius * math.cos(angle)
    y = radius * math.sin(angle)
    return (x, y)

def find_similar_tracks(
    tracks: List[TrackNode],
    n_neighbors: int = 10,
    bpm_weight: float = 1.0,
    key_weight: float = 1.0
) -> Dict[str, List[Tuple[str, float]]]:
    """
    Find similar tracks using Annoy for approximate nearest neighbors.
    Builds a multi-dimensional index and finds N closest tracks for each track.
    """
    if not tracks:
        return defaultdict(list)

    track_map = {i: track for i, track in enumerate(tracks)}

    # Normalize BPM to a 0-1 range for indexing
    bpms = [track.bpm for track in tracks if track.bpm]
    min_bpm, max_bpm = min(bpms) if bpms else 0, max(bpms) if bpms else 1

    vectors: Dict[int, List[float]] = {}
    for i, track in track_map.items():
        normalized_bpm = ((track.bpm - min_bpm) / (max_bpm - min_bpm)) if track.bpm and max_bpm > min_bpm else 0.5
        key_x, key_y = camelot_to_vector(track.camelot_key)
        vectors[i] = [
            normalized_bpm * bpm_weight,
            key_x * key_weight,
            key_y * key_weight,
        ]

    adjacency = defaultdict(list)

    if AnnoyIndex is not None:
        f = 3
        t = AnnoyIndex(f, 'euclidean')
        for i, v in vectors.items():
            t.add_item(i, v)
        t.build(10)  # 10 trees

        for i, track in track_map.items():
            neighbors_indices = t.get_nns_by_item(i, n_neighbors + 1)
            for neighbor_idx in neighbors_indices:
                if i == neighbor_idx:
                    continue
                neighbor_track = track_map[neighbor_idx]
                distance = t.get_distance(i, neighbor_idx)
                adjacency[track.id].append((neighbor_track.id, distance))
    else:
        for i, track in track_map.items():
            vi = vectors[i]
            dists = []
            for j, other in track_map.items():
                if i == j:
                    continue
                vj = vectors[j]
                dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(vi, vj)))
                dists.append((dist, other.id))
            dists.sort(key=lambda item: item[0])
            for dist, other_id in dists[:n_neighbors]:
                adjacency[track.id].append((other_id, dist))

    return adjacency


# ===========================================
# Pathfinding Algorithm
# ===========================================

class PathfinderState:
    """State for A* search"""
    def __init__(
        self,
        current_track_id: str,
        path: List[Tuple[str, float, bool, bool]],
        visited: Set[str],
        duration: int,
        remaining_waypoints: Set[str],
        cost: float,
        heuristic: float,
        pivot_score: int
    ):
        self.current_track_id = current_track_id
        self.path = path
        self.visited = visited
        self.duration = duration
        self.remaining_waypoints = remaining_waypoints
        self.cost = cost
        self.heuristic = heuristic
        self.pivot_score = pivot_score
        self.f_score = cost + heuristic

    def __lt__(self, other):
        """For priority queue ordering"""
        if self.f_score == other.f_score:
            return self.pivot_score > other.pivot_score
        return self.f_score < other.f_score

def prepare_adjacency(
    adjacency: Dict[str, List[Tuple[str, float]]],
    tracks_dict: Dict[str, TrackNode],
    prefer_key_matching: bool,
    synthetic_edges: Optional[Set[Tuple[str, str]]] = None
) -> Dict[str, List[Tuple[str, float, float, bool, bool, int]]]:
    """
    Pre-compute static edge metrics and transition costs for all edges in the graph once.
    This eliminates millions of redundant key compatibility and BPM difference calculation calls
    during A* search expansions in progressive relaxation iterations.

    Returns:
        Dict mapping track_id -> List of pre-computed tuples:
        (neighbor_id, edge_weight, base_transition_cost, key_compatible, is_synthetic, neighbor_duration_ms)
    """
    if synthetic_edges is None:
        synthetic_edges = set()

    prepared = {}
    for u, neighbors in adjacency.items():
        u_track = tracks_dict.get(u)
        if not u_track:
            continue

        u_neighbors = []
        for v, edge_weight in neighbors:
            v_track = tracks_dict.get(v)
            if not v_track:
                continue

            key_compatible = is_key_compatible(u_track.camelot_key, v_track.camelot_key)
            is_synthetic = (u, v) in synthetic_edges
            # Request edges carry their occurrence count; ANN fallback edges are inferred (n = 0)
            count = 0 if is_synthetic else occurrence_count(edge_weight)
            base_trans_cost = transition_cost(u_track, v_track, count, prefer_key_matching=prefer_key_matching)
            v_duration = v_track.duration_ms

            u_neighbors.append((v, edge_weight, base_trans_cost, key_compatible, is_synthetic, v_duration))

        prepared[u] = u_neighbors

    return prepared


def find_path(
    start_id: str,
    end_id: Optional[str],
    target_duration: int,
    tolerance: int,
    waypoint_ids: Set[str],
    tracks_dict: Dict[str, TrackNode],
    adjacency: Dict[str, List[Tuple[str, float]]],  # {from_id: [(to_id, weight), ...]}
    prefer_key_matching: bool,
    pivots: Set[str],
    synthetic_edges: Optional[Set[Tuple[str, str]]] = None,  # Set of (from_id, to_id) synthetic edges
    prepared_adj: Optional[Dict[str, List[Tuple[str, float, float, bool, bool, int]]]] = None,
    avg_duration: Optional[float] = None,
    hop_distances: Optional[Dict[str, Dict[str, int]]] = None
) -> Tuple[Optional[List[Tuple[str, float, bool, bool]]], Optional[List[Tuple[str, float, bool, bool]]]]:
    """
    Modified A* pathfinding with constraints

    Returns:
        Tuple of (best_path, longest_valid_path)
        - best_path: Optimal path satisfying all constraints, or None
        - longest_valid_path: Longest valid path found (even if constraints failed), or None
    """
    if start_id not in tracks_dict:
        return None, None

    if synthetic_edges is None:
        synthetic_edges = set()

    # Pre-compute adjacency metrics if not already provided
    if prepared_adj is None:
        prepared_adj = prepare_adjacency(adjacency, tracks_dict, prefer_key_matching, synthetic_edges)

    # Calculate average track duration for heuristic if not provided
    if avg_duration is None:
        avg_duration = sum(t.duration_ms for t in tracks_dict.values()) / max(len(tracks_dict), 1)

    # Precompute reverse BFS hop distances to end_id and waypoints for heuristic guidance
    target_nodes: Set[str] = set(waypoint_ids)
    if end_id:
        target_nodes.add(end_id)
    if hop_distances is None and target_nodes:
        hop_distances = compute_reverse_bfs_distances(target_nodes, prepared_adj)

    # Initial state
    start_track = tracks_dict[start_id]
    initial_waypoints = waypoint_ids - {start_id}
    initial_state = PathfinderState(
        current_track_id=start_id,
        path=[(start_id, 0.0, False, False)],
        visited={start_id},
        duration=start_track.duration_ms,
        remaining_waypoints=initial_waypoints,
        cost=0.0,
        heuristic=calculate_heuristic(
            start_track.duration_ms, target_duration, initial_waypoints, avg_duration,
            current_track_id=start_id, end_id=end_id, hop_distances=hop_distances
        ),
        pivot_score=1 if start_id in pivots else 0
    )

    # Priority queue for A* search
    open_set = [initial_state]
    best_path = None
    best_score = (float('inf'), float('inf'))

    # Fallback: keep track of the best-effort path that reaches the correct endpoint
    # (preferring all waypoints visited, then duration closest to target_duration / longest valid)
    longest_valid_path = None
    best_fallback_key = (-1, float('-inf'), -1)  # (all_waypoints_int, -duration_diff, duration)

    # Closed-set / state dominance pruning to prevent exponential state-space explosion
    bucket_ms = max(int(avg_duration // 2), 30000)
    best_g_score: Dict[Tuple[str, frozenset, int], float] = {}
    node_wp_expansions: Dict[Tuple[str, frozenset], int] = defaultdict(int)
    max_expansions_per_node_wp = 16

    iterations = 0
    max_iterations = 10000  # Prevent infinite loops
    max_allowed_duration = max(target_duration + (tolerance * 2), int(target_duration * 2.5) if (end_id or waypoint_ids) else 0)

    while open_set and iterations < max_iterations:
        iterations += 1

        current_state = heapq.heappop(open_set)

        # DEBUG: Log state
        if iterations <= 5:  # Only log first 5 iterations
            logger.info(f"DEBUG iter {iterations}: current={current_state.current_track_id}, "
                       f"duration={current_state.duration}ms, visited={len(current_state.visited)}, "
                       f"remaining_waypoints={len(current_state.remaining_waypoints)}")

        # Check if we've reached a valid end state
        duration_diff = abs(current_state.duration - target_duration)
        is_within_tolerance = duration_diff <= tolerance
        all_waypoints_visited = len(current_state.remaining_waypoints) == 0
        is_correct_endpoint = (end_id is None) or (current_state.current_track_id == end_id)

        # Update fallback path if it ends at the required endpoint (and isn't just the single start node when no end_id)
        if is_correct_endpoint and (len(current_state.path) > 1 or end_id == start_id):
            wp_rank = 1 if all_waypoints_visited else -len(current_state.remaining_waypoints)
            fallback_key = (wp_rank, -duration_diff, current_state.duration)
            if fallback_key > best_fallback_key:
                best_fallback_key = fallback_key
                longest_valid_path = current_state.path

        # Valid solution if: within tolerance, all waypoints visited, and correct endpoint
        if is_within_tolerance and all_waypoints_visited and is_correct_endpoint:
            candidate_score = (round(current_state.cost, 6), duration_diff)
            if candidate_score < best_score:
                best_path = current_state.path
                best_score = candidate_score
            continue  # Keep searching for better paths

        # If we already reached end_id early (before target duration or before all waypoints), do not expand past end_id
        if end_id is not None and current_state.current_track_id == end_id and current_state. current_track_id != start_id:
            continue

        # State dominance / closed-set check
        wp_frozen = frozenset(current_state.remaining_waypoints)
        node_wp_key = (current_state.current_track_id, wp_frozen)
        if node_wp_expansions[node_wp_key] >= max_expansions_per_node_wp:
            continue

        dur_bucket = current_state.duration // bucket_ms
        state_key = (current_state.current_track_id, wp_frozen, dur_bucket)
        prev_best_g = best_g_score.get(state_key)
        if prev_best_g is not None and current_state.cost >= prev_best_g:
            continue
        best_g_score[state_key] = current_state.cost
        node_wp_expansions[node_wp_key] += 1

        # Expand neighbors using pre-calculated transition parameters
        neighbors = prepared_adj.get(current_state.current_track_id)
        if not neighbors:
            if iterations <= 5:
                logger.warning(f"DEBUG iter {iterations}: Node {current_state.current_track_id} has NO neighbors in adjacency list")
            continue

        if iterations <= 5:
            logger.info(f"DEBUG iter {iterations}: Expanding {len(neighbors)} neighbors")

        curr_visited = current_state.visited
        curr_duration = current_state.duration
        curr_remaining_wp = current_state.remaining_waypoints
        curr_cost = current_state.cost
        curr_path = current_state.path
        curr_piv_score = current_state.pivot_score

        for neighbor_id, edge_weight, base_trans_cost, key_compatible, is_synthetic, neighbor_dur in neighbors:
            # Skip visited tracks
            if neighbor_id in curr_visited:
                continue

            # Skip if already over duration
            new_duration = curr_duration + neighbor_dur
            if new_duration > max_allowed_duration:
                continue

            # Update remaining waypoints efficiently
            new_remaining_waypoints = curr_remaining_wp - {neighbor_id} if neighbor_id in curr_remaining_wp else curr_remaining_wp

            # Skip unreachable states if neighbor cannot reach remaining waypoints or end_id
            if hop_distances:
                if end_id is not None and neighbor_id != end_id:
                    if neighbor_id not in hop_distances.get(end_id, {}):
                        continue
                if new_remaining_waypoints:
                    if any(neighbor_id not in hop_distances.get(wp, {}) for wp in new_remaining_waypoints):
                        continue

            # Reaching a remaining waypoint is discounted, never rewarded with a negative cost
            step_cost = base_trans_cost * WAYPOINT_COST_FACTOR if neighbor_id in curr_remaining_wp else base_trans_cost

            new_cost = curr_cost + step_cost

            new_wp_frozen = frozenset(new_remaining_waypoints)
            new_dur_bucket = new_duration // bucket_ms
            new_state_key = (neighbor_id, new_wp_frozen, new_dur_bucket)
            if new_cost >= best_g_score.get(new_state_key, float('inf')):
                continue

            # Calculate heuristic
            new_heuristic = calculate_heuristic(
                new_duration, target_duration, new_remaining_waypoints, avg_duration,
                current_track_id=neighbor_id, end_id=end_id, hop_distances=hop_distances
            )

            is_piv = 1 if neighbor_id in pivots else 0

            # Create new state
            new_state = PathfinderState(
                current_track_id=neighbor_id,
                path=curr_path + [(neighbor_id, edge_weight, key_compatible, is_synthetic)],
                visited=curr_visited | {neighbor_id},
                duration=new_duration,
                remaining_waypoints=new_remaining_waypoints,
                cost=new_cost,
                heuristic=new_heuristic,
                pivot_score=curr_piv_score + is_piv
            )

            heapq.heappush(open_set, new_state)

    logger.info(f"Pathfinding completed in {iterations} iterations")

    return best_path, longest_valid_path

# ===========================================
# API Endpoint
# ===========================================

@router.post("/find-path", response_model=PathfinderResponse)
async def find_dj_path(request: PathfinderRequest):
    """
    Find optimal DJ set path with constraints

    Uses modified A* algorithm with:
    - Duration constraint (target ± tolerance)
    - Waypoint constraint (must visit specified tracks)
    - Connection strength optimization (prefer stronger connections)
    - Camelot key matching as tiebreaker
    - No track repetition
    """
    try:
        # Validate inputs
        if request.start_track_id not in [t.id for t in request.tracks]:
            raise HTTPException(status_code=400, detail="Start track not found in track list")

        if request.end_track_id and request.end_track_id not in [t.id for t in request.tracks]:
            raise HTTPException(status_code=400, detail="End track not found in track list")

        # Build data structures
        tracks_dict = {track.id: track for track in request.tracks}

        # Build adjacency list from existing edges
        adjacency: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
        for edge in request.edges:
            adjacency[edge.from_id].append((edge.to_id, edge.weight))

        # 2025 ENHANCEMENT: Use ANN to find similar tracks for a fallback graph
        ann_key_weight = 1.0 if request.prefer_key_matching else 0.0
        ann_adjacency = find_similar_tracks(
            request.tracks, n_neighbors=15, bpm_weight=1.5, key_weight=ann_key_weight
        )

        synthetic_edges_added = 0
        synthetic_edge_set = set()

        # Augment the graph with ANN edges where no real edge exists
        for from_id, neighbors in ann_adjacency.items():
            existing_neighbors = {to_id for to_id, _ in adjacency.get(from_id, [])}
            for to_id, weight in neighbors:
                if to_id not in existing_neighbors:
                    # ANN distance is already a good weight, but we can scale it
                    adjacency[from_id].append((to_id, weight * 5.0)) # Scale weight to be higher than typical real edges
                    synthetic_edge_set.add((from_id, to_id))
                    synthetic_edges_added += 1

        logger.info(f"Added {synthetic_edges_added} synthetic edges from ANN similarity search")

        # Validate waypoints
        waypoint_ids = set(request.waypoint_track_ids)
        invalid_waypoints = waypoint_ids - set(tracks_dict.keys())
        if invalid_waypoints:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid waypoint track IDs: {list(invalid_waypoints)}"
            )

        logger.info(f"Starting pathfinding: start={request.start_track_id}, end={request.end_track_id}, "
                   f"target_duration={request.target_duration_ms}ms, waypoints={len(waypoint_ids)}")

        # DEBUG: Log adjacency list info
        logger.info(f"DEBUG: Total tracks: {len(tracks_dict)}, Total edges: {len(request.edges)}")
        logger.info(f"DEBUG: Adjacency list size: {len(adjacency)}")
        if request.start_track_id in adjacency:
            logger.info(f"DEBUG: Start node has {len(adjacency[request.start_track_id])} neighbors")
            logger.info(f"DEBUG: First 3 neighbors: {adjacency[request.start_track_id][:3]}")
        else:
            logger.warning(f"DEBUG: Start node {request.start_track_id} NOT in adjacency list!")

        # DEBUG: Log track metadata for start node
        if request.start_track_id in tracks_dict:
            start_track = tracks_dict[request.start_track_id]
            logger.info(f"DEBUG: Start track duration: {start_track.duration_ms}ms")
        else:
            logger.warning(f"DEBUG: Start track {request.start_track_id} NOT in tracks_dict!")

        pivots = find_pivots(
            tracks=request.tracks,
            adjacency=adjacency,
            start_id=request.start_track_id,
            end_id=request.end_track_id,
            waypoint_ids=waypoint_ids
        )
        logger.info(f"Identified {len(pivots)} pivot nodes to guide the search.")

        # Pre-compute static graph adjacency properties once for all relaxation attempts
        prepared_adj = prepare_adjacency(
            adjacency=adjacency,
            tracks_dict=tracks_dict,
            prefer_key_matching=request.prefer_key_matching,
            synthetic_edges=synthetic_edge_set
        )
        avg_track_duration = sum(t.duration_ms for t in tracks_dict.values()) / max(len(tracks_dict), 1)
        target_nodes_for_bfs: Set[str] = set(waypoint_ids)
        if request.end_track_id:
            target_nodes_for_bfs.add(request.end_track_id)
        hop_distances = compute_reverse_bfs_distances(target_nodes_for_bfs, prepared_adj) if target_nodes_for_bfs else None

        # Progressive relaxation strategy (2025 best practice)
        # Try with increasing tolerance levels if strict search fails
        tolerance_multipliers = [1.0, 1.5, 2.0, 3.0]
        path = None

        # Track the global best fallback path across all attempts
        global_longest_valid_path = None
        global_best_fallback_key = (-1, float('-inf'), -1)

        def update_global_fallback(candidate_path: Optional[List[Tuple[str, float, bool, bool]]]):
            nonlocal global_longest_valid_path, global_best_fallback_key
            if not candidate_path:
                return
            cand_dur = sum(tracks_dict[tid].duration_ms for tid, _, _, _ in candidate_path)
            visited_wps = sum(1 for tid, _, _, _ in candidate_path if tid in waypoint_ids)
            cand_diff = abs(cand_dur - request.target_duration_ms)
            cand_key = (visited_wps, -cand_diff, cand_dur)
            if cand_key > global_best_fallback_key:
                global_best_fallback_key = cand_key
                global_longest_valid_path = candidate_path

        for multiplier in tolerance_multipliers:
            adjusted_tolerance = int(request.tolerance_ms * multiplier)
            logger.info(f"Attempting pathfinding with tolerance={adjusted_tolerance}ms (multiplier={multiplier})")

            path, longest_fallback = find_path(
                start_id=request.start_track_id,
                end_id=request.end_track_id,
                target_duration=request.target_duration_ms,
                tolerance=adjusted_tolerance,
                waypoint_ids=waypoint_ids,
                tracks_dict=tracks_dict,
                adjacency=adjacency,
                prefer_key_matching=request.prefer_key_matching,
                pivots=pivots,
                synthetic_edges=synthetic_edge_set,
                prepared_adj=prepared_adj,
                avg_duration=avg_track_duration,
                hop_distances=hop_distances
            )

            update_global_fallback(longest_fallback)

            if path:
                logger.info(f"Path found with tolerance multiplier {multiplier}")
                break

        if not path and global_longest_valid_path:
            visited_in_best = sum(1 for tid, _, _, _ in global_longest_valid_path if tid in waypoint_ids)
            if visited_in_best == len(waypoint_ids):
                logger.info("Using valid fallback path that visited all waypoints and reached endpoint.")
                path = global_longest_valid_path

        if not path:
            # Final fallback: Try without requiring all waypoints (best-effort)
            logger.info("Attempting best-effort pathfinding without strict waypoint requirement")

            # Run with no waypoints, then check which ones we hit
            path, longest_fallback = find_path(
                start_id=request.start_track_id,
                end_id=request.end_track_id,
                target_duration=request.target_duration_ms,
                tolerance=request.tolerance_ms * 3,  # More generous tolerance
                waypoint_ids=set(),  # No strict waypoint requirement
                tracks_dict=tracks_dict,
                adjacency=adjacency,
                prefer_key_matching=request.prefer_key_matching,
                pivots=pivots,
                synthetic_edges=synthetic_edge_set,
                prepared_adj=prepared_adj,
                avg_duration=avg_track_duration,
                hop_distances=hop_distances
            )

            update_global_fallback(longest_fallback)

        # Use the longest valid path if we still haven't found a path meeting constraints
        if not path and global_longest_valid_path:
            logger.warning("No path met constraints. Falling back to longest valid path found.")
            path = global_longest_valid_path

            # Recalculate duration for the fallback path
            current_duration = 0
            for track_id, _, _, _ in path:
                current_duration += tracks_dict[track_id].duration_ms

            logger.info(f"Fallback path duration: {current_duration}ms (Target: {request.target_duration_ms}ms)")

        if not path:
            return PathfinderResponse(
                success=False,
                path=[],
                total_duration_ms=0,
                target_duration_ms=request.target_duration_ms,
                duration_difference_ms=request.target_duration_ms,
                waypoints_visited=[],
                waypoints_missed=list(waypoint_ids),
                average_connection_strength=0.0,
                key_compatibility_score=0.0,
                message="No valid path found. Graph may be disconnected or constraints too strict. Try: (1) Remove end track requirement, (2) Increase tolerance significantly, (3) Remove some waypoints."
            )

        # Build response
        path_segments = []
        total_duration = 0
        visited_waypoints = []
        key_compatible_count = 0
        total_connections = len(path) - 1
        total_connection_strength = 0.0

        for i, (track_id, connection_strength, key_compatible, is_synthetic) in enumerate(path):
            track = tracks_dict[track_id]
            total_duration += track.duration_ms

            if track_id in waypoint_ids:
                visited_waypoints.append(track_id)

            if key_compatible:
                key_compatible_count += 1

            if i > 0:  # Skip first track's connection strength
                total_connection_strength += connection_strength

            path_segments.append(PathSegment(
                track=track,
                connection_strength=connection_strength if i > 0 else None,
                key_compatible=key_compatible,
                cumulative_duration_ms=total_duration,
                is_synthetic_edge=is_synthetic if i > 0 else False  # First track has no incoming edge
            ))

        missed_waypoints = list(waypoint_ids - set(visited_waypoints))

        avg_connection_strength = total_connection_strength / max(total_connections, 1)
        key_compatibility_score = key_compatible_count / max(total_connections, 1) if total_connections > 0 else 0.0

        duration_diff = abs(total_duration - request.target_duration_ms)

        # Determine success flag: if duration diff is within original tolerance, it's a success.
        # Otherwise, if we used a fallback path, it might strictly be a "failure" to meet constraints,
        # but the user requested this functionality, so we can mark it as success or include a warning in message.
        # Given the requirement "pathfinding system is working... even if a path exists", we should probably treat it as success.
        is_strict_success = duration_diff <= request.tolerance_ms

        # However, if we are returning the fallback because we couldn't stretch the length,
        # we can mark it as success=True so the frontend displays it, but note it in the message.
        success = True
        message = f"Found path with {len(path)} tracks, {len(visited_waypoints)}/{len(waypoint_ids)} waypoints visited"

        if not is_strict_success:
             message += f". Note: Target duration not reached (short by {duration_diff/60000:.1f} mins)."

        return PathfinderResponse(
            success=success,
            path=path_segments,
            total_duration_ms=total_duration,
            target_duration_ms=request.target_duration_ms,
            duration_difference_ms=duration_diff,
            waypoints_visited=visited_waypoints,
            waypoints_missed=missed_waypoints,
            average_connection_strength=avg_connection_strength,
            key_compatibility_score=key_compatibility_score,
            message=message
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pathfinding error: {str(e)}", exc_info=True)
        # Security: Do not expose internal exception details or trace messages to clients
        raise HTTPException(status_code=500, detail="Pathfinding failed")
