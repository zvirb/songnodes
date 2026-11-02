import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, searchApi } from './api';
import { sanitizeInput, sanitizeObject } from '../lib/utils';

const NAMES = { artist: 'Itch-E & Scratch-E', title: "Lab's Cloud", note: '{"detail":"<b>"}' };

function bodyOf(init: RequestInit): unknown {
  return typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('sanitizeInput', () => {
  it('returns names with & and quotes unchanged', () => {
    expect(sanitizeInput(NAMES.artist)).toBe('Itch-E & Scratch-E');
    expect(sanitizeInput(NAMES.title)).toBe("Lab's Cloud");
    expect(sanitizeInput(NAMES.note)).toBe('{"detail":"<b>"}');
  });

  it('neutralizes script URL schemes', () => {
    expect(sanitizeInput('javascript:void(0)')).toBe('about:blank');
    expect(sanitizeInput(' Java\tScript:void(0)')).toBe('about:blank');
    expect(sanitizeInput('vbscript:msgbox')).toBe('about:blank');
    expect(sanitizeInput('data:text/html,<script>')).toBe('about:blank');
    expect(sanitizeInput('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(sanitizeInput('https://www.mixesdb.com/w/A&B')).toBe('https://www.mixesdb.com/w/A&B');
  });

  it('is idempotent, so a second pass changes nothing', () => {
    const once = sanitizeObject({ ...NAMES, url: 'javascript:x' });
    expect(sanitizeObject(once)).toEqual(once);
  });
});

describe('API client keeps data as typed', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips a POST body with & and \' unchanged', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) =>
      jsonResponse({ id: 't1', ...(bodyOf(init) as object) }, 201));

    const { data } = await api.post('/target-tracks', { artist: NAMES.artist, title: NAMES.title });

    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sent).toEqual({ artist: 'Itch-E & Scratch-E', title: "Lab's Cloud" });
    expect(data).toEqual({ id: 't1', artist: 'Itch-E & Scratch-E', title: "Lab's Cloud" });
  });

  it('round-trips a PUT body unchanged', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => jsonResponse(bodyOf(init)));
    const { data } = await api.put('/target-tracks/t1', { artist: NAMES.artist });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ artist: 'Itch-E & Scratch-E' });
    expect(data).toEqual({ artist: 'Itch-E & Scratch-E' });
  });

  it('shows response names as stored and neutralizes a script URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      targets: [{ artist: NAMES.artist, title: NAMES.title, source_url: 'javascript:void(0)' }],
      error: NAMES.note,
    }));

    const { data } = await api.get('/target-tracks', { q: 'Itch-E & Scratch-E' });

    expect(String(fetchMock.mock.calls[0][0])).toContain('q=Itch-E+%26+Scratch-E');
    expect(data).toEqual({
      targets: [{ artist: 'Itch-E & Scratch-E', title: "Lab's Cloud", source_url: 'about:blank' }],
      error: '{"detail":"<b>"}',
    });
  });

  it('sends the shared client POST body as typed and keeps the response readable', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ track: { name: NAMES.title, artist: NAMES.artist }, score: 1, matches: [] }]));

    const result = await searchApi.searchTracks(NAMES.artist);

    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).query).toBe('Itch-E & Scratch-E');
    expect(result.data[0].track).toEqual({ name: "Lab's Cloud", artist: 'Itch-E & Scratch-E' });
    expect(result.metadata?.query).toBe('Itch-E & Scratch-E');
  });
});
