import { SavedSet } from '../musicLibrary/data';
import api from '../../services/api';
import { useStore } from '../../store/useStore';
import { SN } from '../../lib/songnodes';

export function playlistName(date: Date, setName: string): string {
  return `${SN.format.date(date)} \u00b7 ${setName}`;
}

export interface UnmatchedTrack {
  position: number;
  artist: string;
  title: string;
}

export interface SendSetToTidalResult {
  playlist_id: string;
  url: string;
  added: number;
  unmatched: UnmatchedTrack[];
}

export async function sendSetToTidal(set: SavedSet, note: string = ""): Promise<SendSetToTidalResult> {
  const credentials = useStore.getState().musicCredentials;
  const token = credentials.tidal?.accessToken;

  const tracks = set.tracks.map(t => ({
    artist: t.a || '',
    title: t.t || '',
    tidal: t.tidal || null
  }));

  const payload = {
    name: playlistName(new Date(), set.name),
    description: note,
    tracks
  };

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/v1/tidal/sets/send', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: unknown } | null;
    const detail = typeof body?.detail === 'string' ? body.detail : `TIDAL send failed (HTTP ${response.status})`;
    throw new Error(detail);
  }
  const data = await response.json();
  return data as SendSetToTidalResult;

}
