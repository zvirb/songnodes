/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LibraryRowPreview } from './LibraryRowPreview';
import { previewAudioManager } from '../../../components/ds/MiniAudioPreview';

/** Minimal stand-in for HTMLAudioElement (jsdom does not implement media playback). */
class FakeAudio {
  static instances: FakeAudio[] = [];
  src = '';
  preload = '';
  currentTime = 0;
  duration = Number.NaN;
  paused = true;
  private listeners = new Map<string, Array<() => void>>();
  constructor() { FakeAudio.instances.push(this); }
  addEventListener(type: string, fn: () => void) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
  emit(type: string) { (this.listeners.get(type) ?? []).forEach((fn) => fn()); }
  play() { this.paused = false; this.emit('playing'); return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute(name: string) { if (name === 'src') this.src = ''; }
  load() {}
}

const URL = 'https://cdnt-preview.dzcdn.net/api/1/1/a/b/c/0/abc.mp3';
const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));
function deferred() {
  let resolve: ((r: Response) => void) | undefined;
  const promise = new Promise<Response>((r) => { resolve = r; });
  return { promise, resolve: (r: Response) => resolve?.(r) };
}
const state = (c: HTMLElement) => c.querySelector('.sn-mini-preview')?.getAttribute('data-state');

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  FakeAudio.instances = [];
  vi.stubGlobal('Audio', FakeAudio);
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  previewAudioManager.stopAll();
  vi.unstubAllGlobals();
});

describe('LibraryRowPreview', () => {
  it('makes no request until play is pressed', () => {
    const { container } = render(<LibraryRowPreview trackId="t1" title="Bicep – Glue" />);
    expect(state(container)).toBe('paused');
    expect(screen.getByRole('button', { name: 'Play preview of Bicep – Glue' })).toBeTruthy();
    expect(screen.getByText('0:00 / 0:30')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches the URL on press, shows loading, then plays it', async () => {
    const pending = deferred();
    fetchMock.mockReturnValue(pending.promise);
    const { container } = render(<LibraryRowPreview trackId="t1" title="Bicep – Glue" />);
    fireEvent.click(screen.getByRole('button', { name: /Play preview/ }));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/library/tracks/t1/preview');
    expect(state(container)).toBe('loading');
    expect(screen.getByRole('button', { name: /Pause preview/ }).getAttribute('aria-busy')).toBe('true');
    await act(async () => { pending.resolve(new Response(JSON.stringify({ url: URL, source: 'deezer' }), { status: 200 })); });
    expect(state(container)).toBe('playing');
    expect(FakeAudio.instances[0].src).toBe(URL);
  });

  it('shows No preview when Deezer has none', async () => {
    fetchMock.mockReturnValue(reply(200, { url: null, source: 'deezer' }));
    const { container } = render(<LibraryRowPreview trackId="t1" title="Bicep – Glue" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Play preview/ })); });
    expect(state(container)).toBe('unavailable');
    expect(screen.getByText('No preview')).toBeTruthy();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('shows the unavailable state with the cause when the lookup fails', async () => {
    fetchMock.mockReturnValue(reply(503, { detail: 'Deezer is unavailable, try again later' }));
    const { container } = render(<LibraryRowPreview trackId="t1" title="Bicep – Glue" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Play preview/ })); });
    expect(state(container)).toBe('unavailable');
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe('Deezer is unavailable, try again later');
  });

  it('names the cause when the server cannot be reached', async () => {
    fetchMock.mockReturnValue(Promise.reject(new TypeError('Failed to fetch')));
    const { container } = render(<LibraryRowPreview trackId="t1" title="Bicep – Glue" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Play preview/ })); });
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe('Preview lookup failed: the server could not be reached');
  });

  it('a second press while loading cancels', async () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => {}));
    const { container } = render(<LibraryRowPreview trackId="t1" title="Bicep – Glue" />);
    fireEvent.click(screen.getByRole('button', { name: /Play preview/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pause preview/ }));
    expect(state(container)).toBe('paused');
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
