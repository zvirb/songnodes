"""Data access layer for the `library` schema."""
from typing import List, Dict, Any, Optional
from uuid import UUID
import json

from common.datalayer.outbox import append as append_outbox
async def save_set(conn, set_id: Optional[int], name: str, description: Optional[str], tracks: List[Dict[str, Any]]) -> int:
    """Creates or updates a saved set."""
    if set_id:
        await conn.execute("UPDATE library.sets SET name = $1, description = $2, updated_at = NOW() WHERE id = $3", name, description, set_id)
    else:
        set_id = await conn.fetchval("INSERT INTO library.sets (name, description) VALUES ($1, $2) RETURNING id", name, description)

    await conn.execute("DELETE FROM library.set_tracks WHERE set_id = $1", set_id)

    if tracks:
        # bulk insert tracks
        for pos, track in enumerate(tracks):
            await conn.execute("INSERT INTO library.set_tracks (set_id, track_id, position) VALUES ($1, $2, $3)", set_id, UUID(track['track_id']), pos)

    await append_outbox(conn, 'library_set', set_id, 'library.set.saved.v1', {
        'name': name, 'description': description, 'tracks': tracks
    })
    return set_id

async def delete_set(conn, set_id: int):
    """Deletes a saved set."""
    await conn.execute("DELETE FROM library.set_tracks WHERE set_id = $1", set_id)
    await conn.execute("DELETE FROM library.sets WHERE id = $1", set_id)

async def get_sets(conn) -> List[Dict[str, Any]]:
    """Gets all sets with their tracks."""
    sets = await conn.fetch("SELECT * FROM library.sets ORDER BY created_at DESC")
    result = []
    for s in sets:
        s_dict = dict(s)
        tracks = await conn.fetch("SELECT track_id, position FROM library.set_tracks WHERE set_id = $1 ORDER BY position", s['id'])
        s_dict['tracks'] = [dict(t) for t in tracks]
        # convert uuid to string for json serialization
        for t in s_dict['tracks']:
            t['track_id'] = str(t['track_id'])
        result.append(s_dict)
    return result

async def get_set_export(conn) -> Dict[str, Any]:
    """Generates the export format for saved sets."""
    sets = await get_sets(conn)
    export_format = {"sets": []}
    for s in sets:
        export_format["sets"].append({
            "name": s["name"],
            "description": s["description"],
            "tracks": [{"track_id": str(t["track_id"])} for t in s["tracks"]]
        })
    return export_format
