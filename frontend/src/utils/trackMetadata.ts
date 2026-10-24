import type { GraphNode, Track } from '../types';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};

/** Fresh direct/metadata values, including explicit nulls, override cached tracks. */
export function trackFromNode(input: GraphNode | Record<string, unknown>): Track {
  const node = input as unknown as RecordValue;
  const metadata = object(node.metadata);
  const nested = object(node.track);
  const sources = [node, metadata, nested];
  const field = (...names: string[]) => {
    for (const source of sources) {
      for (const name of names) if (source[name] !== undefined) return source[name];
    }
    return undefined;
  };
  const number = (value: unknown): number | undefined => {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const text = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value : undefined;
  const identifier = (value: unknown): string | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? String(value) : text(value);

  const durationMsRaw = field('duration_ms');
  const durationMs = number(durationMsRaw);
  const seconds = number(field('duration', 'duration_seconds'));
  const duration = durationMsRaw !== undefined
    ? durationMs !== undefined && durationMs >= 0 ? durationMs / 1000 : undefined
    : seconds !== undefined && seconds >= 0 ? seconds : undefined;
  const bpm = number(field('bpm'));
  const key = text(field('key', 'musical_key'));
  const camelotKey = text(field('camelot_key', 'camelotKey'));
  const title = text(field('title', 'name', 'track_name')) ?? text(field('label')) ?? 'Unknown Track';
  const releaseDate = text(field('release_date'));
  const genre = field('genre', 'category');
  const track: Track = {
    ...nested,
    id: identifier(node.id ?? node.track_id ?? nested.id) ?? '',
    name: title, title,
    artist: text(field('artist', 'artist_name')) ?? 'Unknown Artist',
    bpm: bpm !== undefined && bpm > 0 ? bpm : undefined,
    key, musical_key: text(field('musical_key', 'key')),
    camelotKey, camelot_key: camelotKey,
    energy: number(field('energy')), energy_scale: text(field('energy_scale')),
    danceability: number(field('danceability')), valence: number(field('valence')),
    duration, duration_seconds: duration,
    duration_ms: duration !== undefined ? duration * 1000 : undefined,
    genre: Array.isArray(genre) ? text(genre[0]) : text(genre),
    genres: Array.isArray(field('genres')) ? field('genres') as string[] : Array.isArray(genre) ? genre : undefined,
    album: text(field('album')), release_date: releaseDate,
    year: number(field('year', 'release_year')) ?? (releaseDate ? number(releaseDate.slice(0, 4)) : undefined),
    isrc: text(field('isrc')), spotify_id: identifier(field('spotify_id')),
    apple_music_id: identifier(field('apple_music_id')), beatport_id: identifier(field('beatport_id')),
    tidal_id: identifier(field('tidal_id')), deezer_id: identifier(field('deezer_id')),
    // Graph metadata.label is display text, never a record-label fallback.
    record_label: text(field('record_label')), mix_name: text(field('mix_name', 'version')),
    preview_url: text(field('preview_url')),
    status: 'unplayed', metadata,
  };
  for (const name of ['intro', 'outro', 'waveform', 'beatgrid', 'lastPlayed', 'playCount',
                       'tags', 'mood', 'notes', 'cuePoints'] as const) {
    if (field(name) !== undefined) Object.assign(track, { [name]: field(name) });
  }
  return track;
}

/** One mapping for initial loads, reloads, and legacy node responses. */
export function graphNodeFromApi(raw: GraphNode | Record<string, unknown>): GraphNode {
  const node = raw as unknown as RecordValue;
  const track = trackFromNode(raw);
  const position = object(node.position);
  const hash = track.id.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
  return {
    ...node, ...track, id: track.id, type: 'track', track_id: textId(node.track_id),
    label: typeof object(node.metadata).label === 'string' ? object(node.metadata).label as string : track.name,
    x: typeof position.x === 'number' ? position.x : typeof node.x === 'number' ? node.x : ((hash & 0xFFFF) / 0xFFFF) * 1600 - 800,
    y: typeof position.y === 'number' ? position.y : typeof node.y === 'number' ? node.y : (((hash >> 16) & 0xFFFF) / 0xFFFF) * 1200 - 600,
    metadata: object(node.metadata), track,
  };
}

const textId = (value: unknown) => typeof value === 'string' ? value : undefined;

/** Never turn an uncalibrated stored energy value into a rating or percentage. */
export function formatStoredEnergy(energy?: number, scale?: string): string {
  return energy === undefined || !Number.isFinite(energy)
    ? 'Unknown' : `${energy} (${scale || 'scale not recorded'})`;
}

/**
 * Energy as shown to people (design-system/11-data-display.md, "Stored scales"):
 * an integer 1–10 or null (rendered as an en dash). Never a default of 5,
 * never a percentage. `converted` marks legacy 0–1 floats; `needsCheck` marks
 * a 0–1 float stored without a scale.
 */
export interface DisplayEnergy { value: number | null; converted: boolean; needsCheck: boolean; raw?: number }
export function displayEnergy(energy?: number | null, scale?: string | null): DisplayEnergy {
  const raw = energy == null ? undefined : Number(energy);
  const none: DisplayEnergy = { value: null, converted: false, needsCheck: false, raw };
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0 || raw > 10) return none;
  const clamp = (n: number) => Math.min(10, Math.max(1, Math.round(n)));
  if (scale === 'legacy_0_1') return raw <= 1 ? { value: clamp(raw * 10), converted: true, needsCheck: false, raw } : none;
  if (scale === 'dj_1_10') return raw >= 1 ? { value: clamp(raw), converted: false, needsCheck: false, raw } : none;
  if (raw <= 1 && !Number.isInteger(raw)) return { value: clamp(raw * 10), converted: true, needsCheck: true, raw };
  if (Number.isInteger(raw)) return { value: raw, converted: false, needsCheck: false, raw };
  return none;
}

/** The duration-based legacy router requires measurements for every supplied track. */
export function routeTracksFromNodes(nodes: (GraphNode | Record<string, unknown>)[]) {
  return nodes.map(node => {
    const track = trackFromNode(node);
    if (track.duration_ms === undefined || track.duration_ms <= 0) {
      throw new Error(`Cannot calculate a timed route: duration is unknown for ${track.name}. Enrich track durations first.`);
    }
    return {
      id: track.id, name: track.name, artist: track.artist,
      duration_ms: Math.round(track.duration_ms), camelot_key: track.camelot_key,
      bpm: track.bpm, energy: track.energy,
    };
  });
}
