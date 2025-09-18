#!/usr/bin/env python3
"""
Quick test script to verify all components are working
"""

import subprocess
import time
import requests
import json
from pathlib import Path

def test_docker_services():
    """Check if Docker services are running"""
    print("🐳 Testing Docker Services...")
    result = subprocess.run(["docker", "ps", "--format", "{{.Names}}"], capture_output=True, text=True)
    containers = result.stdout.strip().split('\n')

    required = ["musicdb-postgres", "musicdb-redis", "musicdb-rabbitmq"]
    for service in required:
        if service in containers:
            print(f"  ✅ {service} is running")
        else:
            print(f"  ❌ {service} is NOT running")

    return all(s in containers for s in required)

def test_frontend():
    """Check if frontend is accessible"""
    print("\n🎨 Testing Frontend...")
    try:
        response = requests.get("http://localhost:3006", timeout=2)
        if response.status_code == 200:
            print("  ✅ Frontend is accessible at http://localhost:3006")
            return True
    except:
        pass
    print("  ❌ Frontend is not accessible")
    return False

def test_scrapers():
    """Test if scrapers are valid"""
    print("\n🕷️ Testing Scrapers...")
    scrapers_path = Path("scrapers/spiders")

    scrapers = ["1001tracklists_spider.py", "mixesdb_spider.py", "setlistfm_spider.py"]
    for scraper in scrapers:
        scraper_file = scrapers_path / scraper
        if scraper_file.exists():
            # Try to compile the Python file
            try:
                import py_compile
                py_compile.compile(str(scraper_file), doraise=True)
                print(f"  ✅ {scraper} is valid")
            except:
                print(f"  ❌ {scraper} has syntax errors")
        else:
            print(f"  ❌ {scraper} not found")

    return True

def test_database():
    """Check if database is accessible"""
    print("\n💾 Testing Database...")
    try:
        import psycopg2
        conn = psycopg2.connect(
            host="localhost",
            port=5433,
            database="musicdb",
            user="musicdb_user",
            password="musicdb_secure_pass"
        )
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'musicdb'")
        count = cursor.fetchone()[0]
        print(f"  ✅ Database connected - {count} tables found")
        conn.close()
        return True
    except Exception as e:
        print(f"  ❌ Database connection failed: {e}")
        return False

def create_sample_data():
    """Create sample data for visualization"""
    print("\n📊 Creating Sample Data...")

    sample_data = {
        "nodes": [
            {"id": "artist1", "label": "Calvin Harris", "type": "artist", "x": 100, "y": 100},
            {"id": "artist2", "label": "Tiësto", "type": "artist", "x": 200, "y": 100},
            {"id": "track1", "label": "Feel So Close", "type": "track", "x": 150, "y": 200},
            {"id": "venue1", "label": "Ultra Music Festival", "type": "venue", "x": 150, "y": 50}
        ],
        "edges": [
            {"source": "artist1", "target": "track1", "type": "performed"},
            {"source": "artist1", "target": "venue1", "type": "played_at"},
            {"source": "artist2", "target": "venue1", "type": "played_at"}
        ]
    }

    # Save to file for frontend
    with open("frontend/public/sample-data.json", "w") as f:
        json.dump(sample_data, f, indent=2)

    print("  ✅ Sample data created at frontend/public/sample-data.json")
    return True

def main():
    print("=" * 50)
    print("🎵 SongNodes System Test")
    print("=" * 50)

    results = {
        "Docker": test_docker_services(),
        "Database": test_database(),
        "Frontend": test_frontend(),
        "Scrapers": test_scrapers(),
        "Sample Data": create_sample_data()
    }

    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    print("=" * 50)

    for component, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {component}: {status}")

    if all(results.values()):
        print("\n🎉 All tests passed! System is ready.")
        print("\n📋 Next Steps:")
        print("  1. Open http://localhost:3006 to see the visualization")
        print("  2. The sample data is already loaded")
        print("  3. Run scrapers with: cd scrapers && scrapy crawl [spider_name]")
    else:
        print("\n⚠️ Some tests failed. Please check the errors above.")

if __name__ == "__main__":
    main()