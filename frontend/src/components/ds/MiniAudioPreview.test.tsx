/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MiniAudioPreview, previewAudioManager } from './MiniAudioPreview';

/** Minimal stand-in for HTMLAudioElement (jsdom does not implement media playback). */
class FakeAudio {
  static instances: FakeAudio[] = [];
  static failAll = false;
  src = '';
  preload = '';
  currentTime = 0;
  duration = Number.NaN;
  paused = true;
  private listeners = new Map<string, Array<() => void>>();
  constructor() { FakeAudio.instances.push(this); }
  addEventListener(type: string, fn: () => void) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
  emit(type: string) { (this.listeners.get(type) ?? []).forEach((fn) => fn()); }
  play() {
    if (FakeAudio.failAll) { this.emit('error'); return Promise.reject(new Error('404')); }
    this.paused = false;
    this.emit('playing');
    return Promise.resolve();
  }
  pause() { this.paused = true; }
  removeAttribute(name: string) { if (name === 'src') this.src = ''; }
  load() {}
}

const button = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.failAll = false;
  vi.stubGlobal('Audio', FakeAudio);
});
afterEach(() => {
  cleanup();
  previewAudioManager.stopAll();
  vi.unstubAllGlobals();
});

describe('MiniAudioPreview', () => {
  it('starts paused with the clip length', () => {
    render(<MiniAudioPreview src="/clip.mp3" title="Bicep – Glue" />);
    expect(button(/Play preview of Bicep – Glue/).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('0:00 / 0:30')).toBeTruthy();
  });

  it('toggles between play and pause', async () => {
    const { container } = render(<MiniAudioPreview src="/clip.mp3" title="Bicep – Glue" />);
    await act(async () => { fireEvent.click(button(/Play preview/)); });
    expect(container.querySelector('.sn-mini-preview')?.getAttribute('data-state')).toBe('playing');
    expect(button(/Pause preview of Bicep – Glue/).getAttribute('aria-pressed')).toBe('true');
    await act(async () => { fireEvent.click(button(/Pause preview/)); });
    expect(container.querySelector('.sn-mini-preview')?.getAttribute('data-state')).toBe('paused');
    expect(FakeAudio.instances[0].paused).toBe(true);
  });

  it('shows elapsed time and progress as the clip plays', async () => {
    const { container } = render(<MiniAudioPreview src="/clip.mp3" title="Bicep – Glue" />);
    await act(async () => { fireEvent.click(button(/Play preview/)); });
    const audio = FakeAudio.instances[0];
    act(() => { audio.duration = 30; audio.emit('loadedmetadata'); audio.currentTime = 12; audio.emit('timeupdate'); });
    expect(screen.getByText('0:12 / 0:30')).toBeTruthy();
    const root = container.querySelector<HTMLElement>('.sn-mini-preview');
    expect(root?.style.getPropertyValue('--sn-mini-preview-pct')).toBe('40%');
  });

  it('stops and releases the audio on unmount', async () => {
    const { unmount } = render(<MiniAudioPreview src="/clip.mp3" title="Bicep – Glue" />);
    await act(async () => { fireEvent.click(button(/Play preview/)); });
    const audio = FakeAudio.instances[0];
    unmount();
    expect(audio.paused).toBe(true);
    expect(audio.src).toBe('');
    expect(previewAudioManager.playingId).toBeNull();
  });

  it('shows the unavailable state when the clip fails to load', async () => {
    const { container } = render(<MiniAudioPreview src="/missing.mp3" title="Overmono – So U Kno" />);
    FakeAudio.failAll = true;
    await act(async () => { fireEvent.click(button(/Play preview/)); });
    expect(container.querySelector('.sn-mini-preview')?.getAttribute('data-state')).toBe('unavailable');
    expect(screen.getByText('No preview')).toBeTruthy();
    const b = button(/No preview for Overmono – So U Kno/);
    expect(b).toBeInstanceOf(HTMLButtonElement);
    expect(b instanceof HTMLButtonElement && b.disabled).toBe(true);
  });

  it('is unavailable without a clip and never creates audio', () => {
    render(<MiniAudioPreview src={null} title="Bicep – Atlas" />);
    const b = button(/No preview for Bicep – Atlas/);
    expect(b instanceof HTMLButtonElement && b.disabled).toBe(true);
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('plays one preview at a time', async () => {
    const { container } = render(
      <>
        <MiniAudioPreview src="/a.mp3" title="Track A" />
        <MiniAudioPreview src="/b.mp3" title="Track B" />
      </>,
    );
    await act(async () => { fireEvent.click(button(/Play preview of Track A/)); });
    await act(async () => { fireEvent.click(button(/Play preview of Track B/)); });
    const states = Array.from(container.querySelectorAll('.sn-mini-preview')).map((el) => el.getAttribute('data-state'));
    expect(states).toEqual(['paused', 'playing']);
    expect(FakeAudio.instances[0].paused).toBe(true);
  });
});
