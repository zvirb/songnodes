"""
DJ Set Pathfinding Router
Intelligent pathfinding for creating DJ setlists with constraints
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Set, Tuple
import heapq
import logging
from collections import defaultdict

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
    weight: float  # Lower is stronger connection
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
    if not from_key or not to_key or from_key not in CAMELOT_WHEEL:
        return False

    return to_key in CAMELOT_WHEEL[from_key]['compatible']

def get_key_compatibility_bonus(from_key: Optional[str], to_key: Optional[str]) -> float:
    """Get bonus score for key compatibility (0 = no bonus, 1 = perfect match)"""
    if not from_key or not to_key:
        return 0.0

    if from_key == to_key:
        return 1.0  # Same key = perfect

    if is_key_compatible(from_key, to_key):
        return 0.5  # Compatible = good

    return 0.0  # Not compatible = no bonus

def calculate_heuristic(
    current_duration: int,
    target_duration: int,
    remaining_waypoints: Set[str],
    avg_track_duration: int
) -> float:
    """
    Heuristic for A* search

    Estimates cost to reach goal:
    - Duration difference penalty
    - Waypoint penalty (must visit remaining waypoints)
    """
    duration_diff = abs(target_duration - current_duration)

    # Penalty for unvisited waypoints
    waypoint_penalty = len(remaining_waypoints) * avg_track_duration * 2

    return duration_diff + waypoint_penalty

# ===========================================
# Pathfinding Algorithm
# ===========================================

class PathfinderState:
    """State for A* search"""
    def __init__(
        self,
        current_track_id: str,
        path: List[Tuple[str, float, bool]],  # (track_id, connection_strength, key_compatible)
        visited: Set[str],
        duration: int,
        remaining_waypoints: Set[str],
        cost: float,
        heuristic: float
    ):
        self.current_track_id = current_track_id
        self.path = path
        self.visited = visited
        self.duration = duration
        self.remaining_waypoints = remaining_waypoints
        self.cost = cost  # g(n) - actual cost so far
        self.heuristic = heuristic  # h(n) - estimated cost to goal
        self.f_score = cost + heuristic  # f(n) = g(n) + h(n)

    def __lt__(self, other):
        """For priority queue ordering"""
        return self.f_score < other.f_score

def find_path(
    start_id: str,
    end_id: Optional[str],
    target_duration: int,
    tolerance: int,
    waypoint_ids: Set[str],
    tracks_dict: Dict[str, TrackNode],
    adjacency: Dict[str, List[Tuple[str, float]]],  # {from_id: [(to_id, weight), ...]}
    prefer_key_matching: bool
) -> Optional[List[Tuple[str, float, bool]]]:
    """
    Modified A* pathfinding with constraints

    Returns: List of (track_id, connection_strength, key_compatible) or None if no path found
    """
    if start_id not in tracks_dict:
        return None

    # Calculate average track duration for heuristic
    avg_duration = sum(t.duration_ms for t in tracks_dict.values()) / len(tracks_dict)

    # Initial state
    start_track = tracks_dict[start_id]
    initial_state = PathfinderState(
        current_track_id=start_id,
        path=[(start_id, 0.0, False)],
        visited={start_id},
        duration=start_track.duration_ms,
        remaining_waypoints=waypoint_ids - {start_id},
        cost=0.0,
        heuristic=calculate_heuristic(start_track.duration_ms, target_duration, waypoint_ids - {start_id}, avg_duration)
    )

    # Priority queue for A* search
    open_set = [initial_state]
    best_path = None
    best_duration_diff = float('inf')

    iterations = 0
    max_iterations = 10000  # Prevent infinite loops

    while open_set and iterations < max_iterations:
        iterations += 1

        current_state = heapq.heappop(open_set)

        # Check if we've reached a valid end state
        duration_diff = abs(current_state.duration - target_duration)
        is_within_tolerance = duration_diff <= tolerance
        all_waypoints_visited = len(current_state.remaining_waypoints) == 0
        is_correct_endpoint = (end_id is None) or (current_state.current_track_id == end_id)

        # Valid solution if: within tolerance, all waypoints visited, and correct endpoint
        if is_within_tolerance and all_waypoints_visited and is_correct_endpoint:
            if duration_diff < best_duration_diff:
                best_path = current_state.path
                best_duration_diff = duration_diff
            continue  # Keep searching for better paths

        # Expand neighbors
        if current_state.current_track_id not in adjacency:
            continue

        current_track = tracks_dict[current_state.current_track_id]

        for neighbor_id, edge_weight in adjacency[current_state.current_track_id]:
            # Skip visited tracks
            if neighbor_id in current_state.visited:
                continue

            # Skip if already over duration (with some buffer)
            neighbor_track = tracks_dict[neighbor_id]
            new_duration = current_state.duration + neighbor_track.duration_ms
            if new_duration > target_duration + tolerance:
                continue

            # Calculate key compatibility
            key_compatible = False
            if prefer_key_matching:
                key_compatible = is_key_compatible(current_track.camelot_key, neighbor_track.camelot_key)

            # Calculate cost
            # Edge weight is the base cost (lower = stronger connection)
            # Add key compatibility bonus (reduces cost if keys are compatible)
            key_bonus = get_key_compatibility_bonus(current_track.camelot_key, neighbor_track.camelot_key) * 0.3
            transition_cost = edge_weight - key_bonus

            # Penalty for not visiting waypoints when we should
            waypoint_penalty = 0
            if neighbor_id in current_state.remaining_waypoints:
                waypoint_penalty = -1.0  # Encourage visiting waypoints

            new_cost = current_state.cost + transition_cost + waypoint_penalty

            # Update remaining waypoints
            new_remaining_waypoints = current_state.remaining_waypoints - {neighbor_id}

            # Calculate heuristic
            new_heuristic = calculate_heuristic(new_duration, target_duration, new_remaining_waypoints, avg_duration)

            # Create new state
            new_state = PathfinderState(
                current_track_id=neighbor_id,
                path=current_state.path + [(neighbor_id, edge_weight, key_compatible)],
                visited=current_state.visited | {neighbor_id},
                duration=new_duration,
                remaining_waypoints=new_remaining_waypoints,
                cost=new_cost,
                heuristic=new_heuristic
            )

            heapq.heappush(open_set, new_state)

    logger.info(f"Pathfinding completed in {iterations} iterations")

    return best_path

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

        # Build adjacency list from edges
        adjacency: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
        for edge in request.edges:
            adjacency[edge.from_id].append((edge.to_id, edge.weight))

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

        # Run pathfinding algorithm
        path = find_path(
            start_id=request.start_track_id,
            end_id=request.end_track_id,
            target_duration=request.target_duration_ms,
            tolerance=request.tolerance_ms,
            waypoint_ids=waypoint_ids,
            tracks_dict=tracks_dict,
            adjacency=adjacency,
            prefer_key_matching=request.prefer_key_matching
        )

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
                message="No valid path found within constraints. Try adjusting duration tolerance or waypoints."
            )

        # Build response
        path_segments = []
        total_duration = 0
        visited_waypoints = []
        key_compatible_count = 0
        total_connections = len(path) - 1
        total_connection_strength = 0.0

        for i, (track_id, connection_strength, key_compatible) in enumerate(path):
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
                cumulative_duration_ms=total_duration
            ))

        missed_waypoints = list(waypoint_ids - set(visited_waypoints))

        avg_connection_strength = total_connection_strength / max(total_connections, 1)
        key_compatibility_score = key_compatible_count / max(total_connections, 1) if total_connections > 0 else 0.0

        duration_diff = abs(total_duration - request.target_duration_ms)

        return PathfinderResponse(
            success=True,
            path=path_segments,
            total_duration_ms=total_duration,
            target_duration_ms=request.target_duration_ms,
            duration_difference_ms=duration_diff,
            waypoints_visited=visited_waypoints,
            waypoints_missed=missed_waypoints,
            average_connection_strength=avg_connection_strength,
            key_compatibility_score=key_compatibility_score,
            message=f"Found path with {len(path)} tracks, {len(visited_waypoints)}/{len(waypoint_ids)} waypoints visited"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pathfinding error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Pathfinding failed: {str(e)}")
