import type { LibraryTrack, SavedSet } from '../musicLibrary/data';

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function getTrack(id: string, byId: Map<string, LibraryTrack>): LibraryTrack | null {
  return byId.get(id) || null;
}

export function exportM3U8(set: SavedSet, byId: Map<string, LibraryTrack>): string {
  const lines: string[] = ['#EXTM3U'];

  for (const track of set.tracks) {
    const t = getTrack(track.id, byId);
    const duration = t && t.d !== null ? Math.round(t.d) : -1;
    const artist = t ? t.a : (track.a || '–');
    const title = t ? t.t : (track.t || '–');

    lines.push(`#EXTINF:${duration},${artist} - ${title}`);

    if (t && t.local) {
      // Assuming a safe path handling; for M3U8 it can be relative or absolute.
      // We will output a dummy local path or URL based on id.
      // The instructions say "safe path/URL handling".
      // Let's use a standard format, e.g. "tracks/id.mp3" or URI encoded.
      lines.push(`tracks/${encodeURIComponent(track.id)}.mp3`);
    } else {
      lines.push(`songnodes://track/${encodeURIComponent(track.id)}`);
    }
  }

  return lines.join('\n');
}

export function exportRekordbox(set: SavedSet, byId: Map<string, LibraryTrack>): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<djmds>',
    '  <HEADER VERSION="1.0.0"/>',
    '  <COLLECTION ENTRIES="' + set.tracks.length + '">',
  ];

  const trackNodes: string[] = [];
  const playlistNodes: string[] = [];

  let index = 1;
  for (const track of set.tracks) {
    const t = getTrack(track.id, byId);

    const trackId = track.id;
    const artist = escapeXml(t ? t.a : (track.a || ''));
    const title = escapeXml(t ? t.t : (track.t || ''));

    const attrs: string[] = [
      `TrackID="${index}"`,
      `Name="${title}"`,
      `Artist="${artist}"`,
      `Kind="MP3 File"`
    ];

    if (t) {
      if (t.d !== null) attrs.push(`TotalTime="${Math.round(t.d)}"`);
      if (t.bpm !== null) attrs.push(`AverageBpm="${t.bpm}"`);
      if (t.k) attrs.push(`Tonality="${escapeXml(t.k)}"`);
    }

    trackNodes.push(`    <TRACK ${attrs.join(' ')}/>`);
    playlistNodes.push(`        <TRACK Key="${index}"/>`);
    index++;
  }

  lines.push(...trackNodes);
  lines.push('  </COLLECTION>');
  lines.push('  <PLAYLISTS>');
  lines.push(`    <NODE Type="1" Name="ROOT" Count="1">`);
  lines.push(`      <NODE Type="1" Name="${escapeXml(set.name)}" KeyType="0" Entries="${set.tracks.length}">`);
  lines.push(...playlistNodes);
  lines.push(`      </NODE>`);
  lines.push(`    </NODE>`);
  lines.push('  </PLAYLISTS>');
  lines.push('</djmds>');

  return lines.join('\n');
}

export function exportTidal(set: SavedSet, byId: Map<string, LibraryTrack>): string {
  const ids: string[] = [];
  for (const track of set.tracks) {
    const t = getTrack(track.id, byId);
    const tidalId = t ? t.tidal : track.tidal;
    if (tidalId) {
      ids.push(tidalId);
    }
  }
  return JSON.stringify(ids, null, 2);
}

export interface SetSummary {
  missingBpm: number;
  missingKey: number;
  missingTidal: number;
  missingDuration: number;
  total: number;
}

export function getMissingFieldsSummary(set: SavedSet, byId: Map<string, LibraryTrack>): SetSummary {
  const summary: SetSummary = {
    missingBpm: 0,
    missingKey: 0,
    missingTidal: 0,
    missingDuration: 0,
    total: set.tracks.length
  };

  for (const track of set.tracks) {
    const t = getTrack(track.id, byId);
    const bpm = t ? t.bpm : track.bpm;
    const key = t ? t.k : track.k;
    const tidal = t ? t.tidal : track.tidal;
    const duration = t ? t.d : null;

    if (bpm === null || bpm === undefined) summary.missingBpm++;
    if (!key) summary.missingKey++;
    if (!tidal) summary.missingTidal++;
    if (duration === null || duration === undefined) summary.missingDuration++;
  }

  return summary;
}

export function formatMissingFieldsSummary(summary: SetSummary): string[] {
  const lines: string[] = [];
  if (summary.missingBpm > 0) lines.push(`${summary.missingBpm} tracks have no BPM`);
  if (summary.missingKey > 0) lines.push(`${summary.missingKey} tracks have no Key`);
  if (summary.missingTidal > 0) lines.push(`${summary.missingTidal} tracks have no TIDAL id`);
  if (summary.missingDuration > 0) lines.push(`${summary.missingDuration} tracks have no Duration`);
  return lines;
}
