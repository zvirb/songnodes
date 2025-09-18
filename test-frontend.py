#!/usr/bin/env python3
"""
Test script to verify frontend is working with data
"""

import requests
import json
import time

def test_frontend():
    """Test if frontend is accessible and loading data"""
    print("🎨 Testing Frontend Accessibility...")

    try:
        # Test frontend
        response = requests.get("http://localhost:3006", timeout=5)
        if response.status_code == 200:
            print("  ✅ Frontend is accessible at http://localhost:3006")

            # Check if data files are accessible
            print("\n📊 Testing Data File Access...")

            # Test live data
            data_response = requests.get("http://localhost:3006/live-performance-data.json", timeout=5)
            if data_response.status_code == 200:
                data = data_response.json()
                print(f"  ✅ Live performance data accessible: {len(data.get('nodes', []))} nodes, {len(data.get('edges', []))} edges")

                # Show sample data
                print("\n🎵 Sample Artists in Data:")
                for node in data.get('nodes', [])[:5]:
                    if node.get('type') == 'artist':
                        print(f"    • {node.get('label')} (ID: {node.get('id')})")

                print("\n🏢 Sample Venues in Data:")
                for node in data.get('nodes', [])[:5]:
                    if node.get('type') == 'venue':
                        city = node.get('metadata', {}).get('city', 'Unknown')
                        print(f"    • {node.get('label')}, {city}")

            else:
                print(f"  ❌ Live data not accessible: {data_response.status_code}")

            # Test sample data fallback
            sample_response = requests.get("http://localhost:3006/sample-data.json", timeout=5)
            if sample_response.status_code == 200:
                sample_data = sample_response.json()
                print(f"  ✅ Sample data accessible: {len(sample_data.get('nodes', []))} nodes")
            else:
                print(f"  ❌ Sample data not accessible: {sample_response.status_code}")

        else:
            print(f"  ❌ Frontend not accessible: {response.status_code}")
            return False

    except Exception as e:
        print(f"  ❌ Frontend test failed: {e}")
        return False

    return True

def main():
    print("=" * 50)
    print("🧪 Frontend Data Test")
    print("=" * 50)

    if test_frontend():
        print("\n🎉 Frontend tests passed!")
        print("\n📋 Next steps:")
        print("  1. Open http://localhost:3006 in your browser")
        print("  2. Open browser developer tools (F12)")
        print("  3. Check the Console tab for data loading messages")
        print("  4. Look for messages like:")
        print("     - '🎵 Attempting to load live performance data...'")
        print("     - '✅ Loaded live performance data: { nodes: X, edges: Y }'")
        print("     - '✅ Setting nodes and edges: { nodes: X, edges: Y }'")
        print("\n💡 If the graph is still empty:")
        print("  1. Check browser console for errors")
        print("  2. Verify data files are accessible")
        print("  3. Check if SimpleGPUCanvas is properly rendering nodes")
    else:
        print("\n❌ Frontend tests failed!")
        print("Please check if the frontend server is running:")
        print("  cd frontend && npm run dev")

if __name__ == "__main__":
    main()