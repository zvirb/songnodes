import { UnifiedTrack, TargetPriority } from '../types/unifiedTrack';
import { LibraryTrack, LibraryFile } from '../features/musicLibrary/data';
import { SN } from '../lib/songnodes'; // .tsx extension is not needed in import

const BASE_URL = import.meta.env.BASE_URL;

export async function fetchTargetTracks(): Promise<UnifiedTrack[]> {
  const res = await fetch('/api/v1/target-tracks');
  if (!res.ok) throw new Error('Failed to fetch target tracks');

  const rawData = await res.json();

  return rawData.map((t: any) => ({
    id: t.track_id, // UUID from target_tracks table
    artist: t.artist,
    title: t.title,
    mix: null, // target_tracks table doesn't have a mix column currently
    durationSec: null,
    bpm: null,
    key: null,
    energy: null,
    genre: (t.genres && t.genres.length > 0) ? t.genres[0] : null,
    label: null,
    source: 'backend',
    isTarget: t.is_active ?? true,
    targetPriority: t.priority || 'medium',
    tidalUrl: null
  }));
}

export async function fetchLibraryFixture(): Promise<UnifiedTrack[]> {
  const dataPath = BASE_URL.endsWith('/') ? `${BASE_URL}data/music-library.json` : `${BASE_URL}/data/music-library.json`;
  const res = await fetch(dataPath);
  if (!res.ok) throw new Error('Failed to fetch library fixture');
  const file: LibraryFile = await res.json();

  return file.tracks.map(fromLibraryRow);
}

export function fromLibraryRow(track: LibraryTrack): UnifiedTrack {
  let bpmVal: number | null = null;
  if (track.bpm != null && !isNaN(track.bpm) && track.bpm > 0) {
    // Normalise to 1 decimal place
    bpmVal = Math.round(track.bpm * 10) / 10;
  }

  // Use a fallback normalization regex if SN isn't available during testing, but we import SN above
  // The system requires SN.camelot for standard Camelot formatting
  const keyVal = track.k ? (SN?.camelot ? SN.camelot(track.k) : null) : null;

  return {
    id: track.id,
    artist: track.a,
    title: track.t,
    mix: track.m,
    durationSec: track.d,
    bpm: bpmVal,
    key: keyVal,
    energy: track.e,
    genre: track.g,
    label: track.lbl,
    source: 'library-fixture',
    isTarget: false, // Will be hydrated from local storage or backend targets
    targetPriority: null,
    tidalUrl: track.tidal
  };
}
