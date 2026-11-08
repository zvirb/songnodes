/**
 * Tests for HomePage.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { SN } from '../lib/songnodes';
import { loadLibrary } from '../features/musicLibrary/data';
import HomePage from './HomePage';

describe('HomePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders and does not contain old pipeline summary text', () => {
    expect(SN).toBeDefined();

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

    // Every card renders figure labels even before async data finishes loading
    expect(screen.getByText('nodes')).toBeTruthy();
    expect(screen.getAllByText('edges').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('longest set')).toBeTruthy();
    expect(screen.getByText('routeable tracks')).toBeTruthy();
    expect(screen.getByText('missing key')).toBeTruthy();
    expect(screen.getByText('active targets')).toBeTruthy();
    expect(screen.getByText('running or queued')).toBeTruthy();
    expect(screen.getByText('streaming connected')).toBeTruthy();
    expect(screen.getByText('API keys saved')).toBeTruthy();
  });

  it('populates module launcher cards with live graph, library, pipeline, and target data', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/v1/library/search')) {
        return new Response(
          JSON.stringify([
            { id: 't1', a: 'Bicep', t: 'Glue', k: '8A', e: 6, bpm: 130, rev: true },
            { id: 't2', a: 'Overmono', t: 'So U Kno', k: '8A', e: 7, bpm: 130, rev: false },
            { id: 't3', a: 'Four Tet', t: 'Baby', k: null, e: 5, bpm: 128, rev: false },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/v1/library/sets')) {
        return new Response(
          JSON.stringify([
            { id: 1, name: 'Friday peak', minutes: 90, updated: '2026-10-25T10:00:00Z', tracks: [{ id: 't1', tgt: 6 }, { id: 't2', tgt: 7 }] },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/graph/stats')) {
        return new Response(
          JSON.stringify({
            graph_stats: {
              nodes: { total_nodes: 1420 },
              edges: { total_edges: 8903, total_occurrences: 12400 },
            },
            database_stats: { total_playlists: 312 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/v1/target-tracks')) {
        return new Response(
          JSON.stringify([
            { track_id: 'tg1', artist: 'Joy Orbison', title: 'flight fm', priority: 'high', is_active: true, last_searched: null, search_jobs: null },
            {
              track_id: 'tg2',
              artist: 'Skee Mask',
              title: 'Flyby VFR',
              priority: 'medium',
              is_active: true,
              last_searched: '2026-10-24T00:00:00Z',
              playlists_found: 4,
              search_jobs: { queued: 0, running: 0, succeeded: 2, dead: 0, finished_at: '2026-10-24T00:05:00Z', last_error: null },
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/v1/jobs')) {
        return new Response(
          JSON.stringify([
            { job_id: 'j1', kind: 'scrape', status: 'running' },
            { job_id: 'j2', kind: 'scrape', status: 'succeeded' },
            { job_id: 'j3', kind: 'projection_consume', status: 'running' },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/v1/api-keys/requirements')) {
        return new Response(
          JSON.stringify([
            { service_name: 'discogs', key_name: 'token', display_order: 1 },
            { service_name: 'spotify', key_name: 'client_id', display_order: 2 },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/v1/api-keys')) {
        return new Response(
          JSON.stringify([
            { id: 'k1', service_name: 'discogs', key_name: 'token', masked_value: '***' },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    // Force-refresh module-level library cache so it uses the mocked fetch
    await loadLibrary(true);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Graph card updated with nodes, edges, and summary
      expect(screen.getByText(/8,903 connections/)).toBeTruthy();
      expect(screen.getByText('1,420')).toBeTruthy();
      expect(screen.getAllByText('8,903').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/1,420 tracks and 8,903 adjacency edges across 312 sets/i)).toBeTruthy();

      // Library & Key & mood & Pathfinder
      expect(screen.getByText(/3 tracks/)).toBeTruthy();
      expect(screen.getByText('1 need an energy check')).toBeTruthy();
      expect(screen.getByText(/2 routeable tracks/)).toBeTruthy();
      expect(screen.getByText(/1 keys in use/)).toBeTruthy();
      expect(screen.getByText('tracks in 8A')).toBeTruthy();

      // Set builder
      expect(screen.getByText(/1 saved sets/)).toBeTruthy();
      expect(screen.getByText('1 h 30 min')).toBeTruthy();

      // Sources & Pipeline
      expect(screen.getByText(/2 target tracks/)).toBeTruthy();
      expect(screen.getByText(/1 active jobs/)).toBeTruthy();
    });
  });
});
