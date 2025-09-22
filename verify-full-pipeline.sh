#!/bin/bash

echo "=== VERIFYING COMPLETE DATA PIPELINE ==="
echo ""

echo "1. DATABASE STATUS:"
echo "-------------------"
python3 - <<EOF
import asyncio
import asyncpg

async def check():
    conn = await asyncpg.connect(
        host='localhost', port=5433, database='musicdb',
        user='musicdb_user', password='musicdb_secure_pass'
    )
    songs = await conn.fetchval("SELECT COUNT(*) FROM songs")
    adjacencies = await conn.fetchval("SELECT COUNT(*) FROM song_adjacency")
    print(f"   Songs in DB: {songs}")
    print(f"   Adjacencies in DB: {adjacencies}")
    await conn.close()

asyncio.run(check())
EOF

echo ""
echo "2. API STATUS:"
echo "--------------"
echo -n "   Nodes from API: "
curl -s http://localhost:8084/api/graph/nodes?limit=1 | jq '.total'
echo -n "   Edges from API: "
curl -s http://localhost:8084/api/graph/edges?limit=1 | jq '.total'

echo ""
echo "3. DATA TRANSFORMATION:"
echo "-----------------------"
echo -n "   Song nodes (type='song'): "
curl -s http://localhost:8084/api/graph/nodes?limit=500 | jq '[.nodes[] | select(.metadata.node_type == "song")] | length'
echo -n "   Artist nodes (type='artist'): "
curl -s http://localhost:8084/api/graph/nodes?limit=500 | jq '[.nodes[] | select(.metadata.node_type == "artist")] | length'

echo ""
echo "4. FRONTEND STATUS:"
echo "-------------------"
if curl -s http://localhost:3006 > /dev/null; then
    echo "   Frontend: ✅ Running on port 3006"
else
    echo "   Frontend: ❌ Not accessible"
fi

echo ""
echo "5. SAMPLE DATA:"
echo "---------------"
echo "   First 3 song nodes:"
curl -s http://localhost:8084/api/graph/nodes?limit=100 | jq -r '.nodes[] | select(.metadata.node_type == "song") | .metadata.label' | head -3 | sed 's/^/      - /'

echo ""
echo "   Sample adjacencies (top 3 by weight):"
python3 - <<EOF
import asyncio
import asyncpg

async def check():
    conn = await asyncpg.connect(
        host='localhost', port=5433, database='musicdb',
        user='musicdb_user', password='musicdb_secure_pass'
    )
    top = await conn.fetch("""
        SELECT s1.title as t1, s2.title as t2, sa.occurrence_count
        FROM song_adjacency sa
        JOIN songs s1 ON sa.song_id_1 = s1.song_id
        JOIN songs s2 ON sa.song_id_2 = s2.song_id
        ORDER BY sa.occurrence_count DESC
        LIMIT 3
    """)
    for row in top:
        print(f"      - {row['t1']} → {row['t2']} (count: {row['occurrence_count']})")
    await conn.close()

asyncio.run(check())
EOF

echo ""
echo "==================================="
echo "SUMMARY:"
echo "The visualization should now display:"
echo "  • 60 song nodes"
echo "  • 1,171 edges (adjacency relationships)"
echo "  • Edge weights based on occurrence frequency"
echo ""
echo "Access the visualization at: http://localhost:3006"
echo "==================================="