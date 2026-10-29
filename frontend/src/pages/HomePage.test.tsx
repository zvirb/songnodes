/**
 * Tests for HomePage.
 */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';
import React from 'react';
import '../lib/songnodes';

describe('HomePage', () => {
  it('renders and does not contain old pipeline summary text', () => {
    window.SongNodes = {
      format: {
        count: (n: number) => n.toString(),
        dateOnly: (d: string) => d,
        relative: () => '',
        stamp: () => '',
      },
      camelot: () => '',
      modules: [
        { key: 'graph', icon: 'test', label: 'Graph' },
        { key: 'library', icon: 'test', label: 'Library' },
        { key: 'sets', icon: 'test', label: 'Sets' },
        { key: 'paths', icon: 'test', label: 'Paths' },
        { key: 'harmony', icon: 'test', label: 'Harmony' },
        { key: 'sources', icon: 'test', label: 'Sources' },
        { key: 'pipeline', icon: 'test', label: 'Pipeline' },
        { key: 'services', icon: 'test', label: 'Services' },
      ],
    } as any;

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    const oldText = screen.queryByText(/live job and worker telemetry is not connected/i);
    expect(oldText).toBeNull();

    const newText = screen.getByText(/Queue scrapes and watch jobs, workers and the medallion stages live/i);
    expect(newText).toBeTruthy();

    const oldSourcesText = screen.queryByText(/Tracklists, radio, targets and imports/i);
    expect(oldSourcesText).toBeNull();

    const newSourcesText = screen.getByText(/Target tracks, tracklist imports and AI setlists/i);
    expect(newSourcesText).toBeTruthy();
  });
});
