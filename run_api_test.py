#!/usr/bin/env python3
"""
Simple Graph API Test Runner
Run the graph visualization API locally for testing
"""

import subprocess
import sys
import time
import os
import signal
from pathlib import Path

def run_api_server():
    """Start the API server in a subprocess"""
    api_dir = Path("/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/services/graph-visualization-api")

    # Set environment variables
    env = os.environ.copy()
    env.update({
        'DATABASE_URL': 'postgresql+asyncpg://musicdb_user:musicdb_dev_password_2024@localhost:5433/musicdb',
        'REDIS_HOST': 'localhost',
        'REDIS_PORT': '6380',
        'PYTHONPATH': str(api_dir)
    })

    print("🚀 Starting Graph Visualization API server...")
    print(f"📁 Working directory: {api_dir}")

    try:
        # Start the server
        process = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8084', '--reload'],
            cwd=api_dir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )

        print(f"🔧 Server started with PID: {process.pid}")
        print("📡 API will be available at: http://localhost:8084")
        print("⏱️  Waiting for server to start...")

        # Wait a bit for server to start
        time.sleep(3)

        # Check if process is still running
        if process.poll() is None:
            print("✅ Server appears to be running!")
            print("\n📋 Available endpoints:")
            print("  • GET  /health                    - Health check")
            print("  • GET  /api/graph/nodes           - Get all nodes")
            print("  • GET  /api/graph/edges           - Get all edges")
            print("  • GET  /api/graph/search          - Search functionality")
            print("  • WS   /api/graph/ws/{room_id}    - WebSocket updates")
            print("  • GET  /metrics                   - Prometheus metrics")
            print("\n💡 Example usage:")
            print("  curl http://localhost:8084/health")
            print("  curl 'http://localhost:8084/api/graph/nodes?limit=10'")
            print("  curl 'http://localhost:8084/api/graph/search?q=music'")

            # Keep server running
            try:
                print("\n🔄 Server running... Press Ctrl+C to stop")
                while True:
                    time.sleep(1)
                    if process.poll() is not None:
                        print("❌ Server process ended unexpectedly")
                        break

            except KeyboardInterrupt:
                print("\n🛑 Stopping server...")
                process.terminate()
                process.wait(timeout=5)
                print("✅ Server stopped")

        else:
            print("❌ Server failed to start")
            stdout, stderr = process.communicate()
            if stdout:
                print("STDOUT:", stdout)
            if stderr:
                print("STDERR:", stderr)
            return process.returncode

    except Exception as e:
        print(f"❌ Error starting server: {e}")
        return 1

    return 0

def check_dependencies():
    """Check if required dependencies are available"""
    print("🔍 Checking dependencies...")

    # Check if we can import required modules
    try:
        import uvicorn
        import fastapi
        import asyncpg
        import redis
        print("✅ All required Python packages found")
        return True
    except ImportError as e:
        print(f"❌ Missing Python package: {e}")
        print("💡 Install with: pip install fastapi uvicorn asyncpg redis")
        return False

def show_database_connection_info():
    """Show database connection information"""
    print("\n📊 Database Connection Info:")
    print("  • PostgreSQL: localhost:5433")
    print("  • Redis: localhost:6380")
    print("  • Database: musicdb")
    print("  • User: musicdb_user")
    print("\n⚠️  Note: Make sure PostgreSQL and Redis are running")
    print("    You can start them with Docker:")
    print("    docker run -d -p 5433:5432 --name test-postgres \\")
    print("      -e POSTGRES_DB=musicdb -e POSTGRES_USER=musicdb_user \\")
    print("      -e POSTGRES_PASSWORD=musicdb_dev_password_2024 postgres:15")
    print("    docker run -d -p 6380:6379 --name test-redis redis:7-alpine")

if __name__ == "__main__":
    print("🎵 SongNodes Graph Visualization API Test Runner")
    print("=" * 60)

    if not check_dependencies():
        sys.exit(1)

    show_database_connection_info()

    try:
        exit_code = run_api_server()
        sys.exit(exit_code)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)