#!/usr/bin/env python3
"""
Load live performance data from Setlist.fm API into the visualization
"""

import requests
import json
from datetime import datetime

API_KEY = "8xTq8eBNbEZCWKg1ZrGpgsRQlU9GlNYNZVtG"
BASE_URL = "https://api.setlist.fm/rest/1.0"

def fetch_setlists(artist_name, limit=10):
    """Fetch setlists for an artist"""
    headers = {
        "x-api-key": API_KEY,
        "Accept": "application/json"
    }

    url = f"{BASE_URL}/search/setlists"
    params = {
        "artistName": artist_name,
        "p": 1
    }

    response = requests.get(url, headers=headers, params=params)
    data = response.json()

    setlists = []
    for setlist in data.get('setlist', [])[:limit]:
        setlists.append({
            'id': setlist['id'],
            'artist': setlist['artist']['name'],
            'date': setlist['eventDate'],
            'venue': setlist['venue']['name'],
            'city': setlist['venue']['city']['name'],
            'country': setlist['venue']['city']['country']['name'],
            'url': setlist['url']
        })

    return setlists

def convert_to_graph_data(setlists):
    """Convert setlist data to graph format"""
    nodes = []
    edges = []

    # Track unique entities
    artists = set()
    venues = set()
    cities = set()

    for setlist in setlists:
        # Add artist node
        artist_id = f"artist_{setlist['artist'].replace(' ', '_')}"
        if artist_id not in artists:
            nodes.append({
                "id": artist_id,
                "label": setlist['artist'],
                "type": "artist",
                "metadata": {"source": "setlistfm"}
            })
            artists.add(artist_id)

        # Add venue node
        venue_id = f"venue_{setlist['venue'].replace(' ', '_')}"
        if venue_id not in venues:
            nodes.append({
                "id": venue_id,
                "label": setlist['venue'],
                "type": "venue",
                "metadata": {
                    "source": "setlistfm",
                    "city": setlist['city'],
                    "country": setlist['country']
                }
            })
            venues.add(venue_id)

        # Add city node
        city_id = f"city_{setlist['city'].replace(' ', '_')}"
        if city_id not in cities:
            nodes.append({
                "id": city_id,
                "label": setlist['city'],
                "type": "location",
                "metadata": {
                    "source": "setlistfm",
                    "country": setlist['country']
                }
            })
            cities.add(city_id)

        # Add performance edge
        edges.append({
            "id": f"perf_{setlist['id']}",
            "source": artist_id,
            "target": venue_id,
            "type": "performed_at",
            "metadata": {
                "date": setlist['date'],
                "url": setlist['url']
            }
        })

        # Add venue to city edge
        edges.append({
            "id": f"loc_{venue_id}_{city_id}",
            "source": venue_id,
            "target": city_id,
            "type": "located_in",
            "metadata": {"source": "setlistfm"}
        })

    return {"nodes": nodes, "edges": edges}

def main():
    print("🎵 Loading Live Performance Data from Setlist.fm")
    print("=" * 50)

    # Fetch setlists for popular electronic music artists
    artists = ["Calvin Harris", "David Guetta", "Marshmello", "Tiësto", "Martin Garrix"]
    all_setlists = []

    for artist in artists:
        print(f"\n📡 Fetching data for {artist}...")
        setlists = fetch_setlists(artist, limit=5)
        all_setlists.extend(setlists)
        print(f"  ✅ Found {len(setlists)} recent performances")

        for setlist in setlists[:3]:  # Show first 3
            print(f"    • {setlist['date']} - {setlist['venue']}, {setlist['city']}")

    # Convert to graph format
    print("\n📊 Converting to graph format...")
    graph_data = convert_to_graph_data(all_setlists)

    print(f"  ✅ Created {len(graph_data['nodes'])} nodes")
    print(f"  ✅ Created {len(graph_data['edges'])} edges")

    # Save to file for frontend
    output_file = "frontend/public/live-performance-data.json"
    with open(output_file, "w") as f:
        json.dump(graph_data, f, indent=2)

    print(f"\n✅ Data saved to {output_file}")

    # Show summary
    print("\n📈 Data Summary:")
    print("=" * 50)

    node_types = {}
    for node in graph_data['nodes']:
        node_type = node['type']
        node_types[node_type] = node_types.get(node_type, 0) + 1

    for node_type, count in node_types.items():
        print(f"  {node_type.capitalize()}s: {count}")

    print("\n🎉 Live performance data loaded successfully!")
    print("\nThe data includes:")
    print("  • Artist performance history")
    print("  • Venue information with locations")
    print("  • Geographic distribution of concerts")
    print("  • Performance relationships")

    print("\n🚀 Next steps:")
    print("  1. Refresh http://localhost:3006 to load the new data")
    print("  2. The graph will show real concert venues and locations")
    print("  3. Click on nodes to see performance details")

if __name__ == "__main__":
    main()