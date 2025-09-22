#!/usr/bin/env python3
"""Calculate expected edges for playlists"""

def calculate_edges(num_tracks, max_distance=3):
    """Calculate how many edges should be created for a playlist"""
    edges = 0

    for i in range(num_tracks):
        # For each track, count edges to tracks within max_distance
        for distance in range(1, max_distance + 1):
            if i + distance < num_tracks:
                edges += 1

    return edges

# Test with different playlist sizes
print("Expected edges for different playlist sizes:")
print("(Including distance=1, 2, and 3 relationships)")
print("-" * 40)

for tracks in [11, 15, 20]:
    edges = calculate_edges(tracks, max_distance=3)
    print(f"{tracks} tracks: {edges} edges")

print("\nBreakdown for 11 tracks:")
print(f"  Distance=1: {10} edges (sequential)")
print(f"  Distance=2: {9} edges")
print(f"  Distance=3: {8} edges")
print(f"  Total: {10+9+8} edges")

print("\nIf we had 3 playlists with 11 tracks each:")
print(f"  Total adjacencies generated: {3 * 27} = 81 edges")
print(f"  (Some might be duplicates and get aggregated in the database)")