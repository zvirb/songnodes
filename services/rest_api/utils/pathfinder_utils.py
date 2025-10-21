"""
Utilities for the pathfinding algorithm, inspired by the research paper
"Breaking the Sorting Barrier for Directed Single-Source Shortest Paths".
"""
from collections import defaultdict
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
