"""
Utilities for the pathfinding algorithm, inspired by the research paper
"Breaking the Sorting Barrier for Directed Single-Source Shortest Paths".
"""
from collections import defaultdict, deque
from typing import List, Dict, Set, Tuple, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..routers.pathfinder import TrackNode

def find_pivots(
    tracks: List["TrackNode"],
    adjacency: Dict[str, List[Tuple[str, float]]],
    start_id: str,
    end_id: Optional[str],
    waypoint_ids: Set[str],
    num_pivots: int = 20
) -> Set[str]:
    """
    Finds pivot nodes in the graph to guide the A* search.
    This implementation uses node degree as a proxy for influence, which is
    much faster than the previous reachability-based approach.
    """
    if not tracks:
        return set()

    # Calculate the degree of each node (number of incoming and outgoing edges)
    in_degree = defaultdict(int)
    out_degree = defaultdict(int)
    for from_id, neighbors in adjacency.items():
        out_degree[from_id] = len(neighbors)
        for to_id, _ in neighbors:
            in_degree[to_id] += 1

    node_degrees = {
        track.id: in_degree[track.id] + out_degree[track.id] for track in tracks
    }

    # Sort nodes by degree in descending order
    sorted_nodes = sorted(
        node_degrees.items(), key=lambda item: item[1], reverse=True
    )

    # Select the top N nodes as pivots
    pivots = {node_id for node_id, degree in sorted_nodes[:num_pivots]}

    # Ensure start, end, and waypoint tracks are always included as pivots
    initial_nodes = {start_id} | waypoint_ids
    if end_id:
        initial_nodes.add(end_id)
    pivots.update(initial_nodes)

    return pivots

def bfs_reachable_nodes(
    start_id: str,
    adjacency: Dict[str, List[Tuple[str, float]]],
    max_nodes: Optional[int] = None
) -> Set[str]:
    """
    Performs BFS to find all nodes reachable from start_id.

    Args:
        start_id: Starting node ID
        adjacency: Graph adjacency list {from_id: [(to_id, weight), ...]}
        max_nodes: Optional limit on number of nodes to explore (for performance)

    Returns:
        Set of node IDs reachable from start_id
    """
    if start_id not in adjacency:
        return {start_id}

    reachable = {start_id}
    queue = deque([start_id])

    while queue and (max_nodes is None or len(reachable) < max_nodes):
        current_id = queue.popleft()

        for neighbor_id, _ in adjacency.get(current_id, []):
            if neighbor_id not in reachable:
                reachable.add(neighbor_id)
                queue.append(neighbor_id)

    return reachable

def validate_pathfinder_request(
    start_id: str,
    end_id: Optional[str],
    waypoint_ids: Set[str],
    target_duration_ms: int,
    tracks_dict: Dict[str, "TrackNode"],
    adjacency: Dict[str, List[Tuple[str, float]]]
) -> Tuple[bool, List[str], List[str]]:
    """
    Validates pathfinder constraints before running A*.

    Returns:
        Tuple of (is_valid, errors, suggestions)
        - is_valid: True if all constraints are valid
        - errors: List of specific error messages
        - suggestions: List of actionable suggestions to fix errors
    """
    errors = []
    suggestions = []

    # Check if start track exists
    if start_id not in tracks_dict:
        errors.append(f"Start track ID '{start_id}' not found in track list")
        suggestions.append("Select a valid start track from the graph")
        return (False, errors, suggestions)

    # Check start track connectivity
    start_out_degree = len(adjacency.get(start_id, []))
    if start_out_degree == 0:
        start_track = tracks_dict[start_id]
        errors.append(
            f"Start track '{start_track.name}' by {start_track.artist} has no outgoing connections"
        )
        suggestions.append("Select a different start track with more connections")
        suggestions.append("This track may be isolated or newly added to the database")

    # Check reachability via BFS (limit to 5000 nodes for performance)
    reachable = bfs_reachable_nodes(start_id, adjacency, max_nodes=5000)

    # Check end track reachability
    if end_id:
        if end_id not in tracks_dict:
            errors.append(f"End track ID '{end_id}' not found in track list")
            suggestions.append("Select a valid end track from the graph")
        elif end_id not in reachable:
            end_track = tracks_dict[end_id]
            errors.append(
                f"End track '{end_track.name}' by {end_track.artist} is unreachable from start track (different cluster)"
            )
            suggestions.append("Remove the end track requirement")
            suggestions.append("Or select an end track from the same cluster as the start track")

    # Check waypoint reachability
    unreachable_waypoints = []
    for waypoint_id in waypoint_ids:
        if waypoint_id not in tracks_dict:
            errors.append(f"Waypoint ID '{waypoint_id}' not found in track list")
            continue

        if waypoint_id not in reachable:
            waypoint_track = tracks_dict[waypoint_id]
            unreachable_waypoints.append(f"'{waypoint_track.name}' by {waypoint_track.artist}")

    if unreachable_waypoints:
        if len(unreachable_waypoints) == 1:
            errors.append(f"Waypoint {unreachable_waypoints[0]} is unreachable from start track")
            suggestions.append("Remove this waypoint or select a different start track")
        else:
            errors.append(
                f"{len(unreachable_waypoints)} waypoints are unreachable: " +
                ", ".join(unreachable_waypoints)
            )
            suggestions.append(f"Remove the {len(unreachable_waypoints)} unreachable waypoints")
            suggestions.append("Or select a different start track")

    # Check duration feasibility
    if tracks_dict:
        min_track_duration = min(t.duration_ms for t in tracks_dict.values())
        max_track_duration = max(t.duration_ms for t in tracks_dict.values())
        avg_track_duration = sum(t.duration_ms for t in tracks_dict.values()) / len(tracks_dict)

        # Minimum possible duration (single track)
        if target_duration_ms < min_track_duration:
            errors.append(
                f"Target duration {target_duration_ms//60000}min is less than shortest track duration {min_track_duration//60000}min"
            )
            suggestions.append(f"Increase target duration to at least {min_track_duration//60000} minutes")

        # Check if duration is achievable with reachable tracks
        reachable_tracks = [tracks_dict[tid] for tid in reachable if tid in tracks_dict]
        if reachable_tracks:
            max_reachable_duration = sum(t.duration_ms for t in reachable_tracks)
            if target_duration_ms > max_reachable_duration:
                errors.append(
                    f"Target duration {target_duration_ms//60000}min exceeds total duration of all reachable tracks {max_reachable_duration//60000}min"
                )
                suggestions.append(f"Reduce target duration to at most {max_reachable_duration//60000} minutes")

        # Check if waypoints + minimum tracks can fit in duration
        if waypoint_ids:
            min_waypoint_duration = sum(
                tracks_dict[wid].duration_ms for wid in waypoint_ids if wid in tracks_dict
            )
            if target_duration_ms < min_waypoint_duration:
                errors.append(
                    f"Target duration {target_duration_ms//60000}min is less than total waypoint duration {min_waypoint_duration//60000}min"
                )
                suggestions.append(f"Increase target duration to at least {min_waypoint_duration//60000} minutes")
                suggestions.append("Or remove some waypoints")

    is_valid = len(errors) == 0

    # Add general suggestions if there are errors
    if not is_valid and not suggestions:
        suggestions.append("Try increasing the duration tolerance")
        suggestions.append("Consider removing some constraints")

    return (is_valid, errors, suggestions)
