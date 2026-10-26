/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, act, waitFor } from '@testing-library/react';
import React, { Suspense } from 'react';

// Use types safely instead of 'any' to appease oxlint
globalThis.window.SongNodes = {
  format: {
    dateOnly: (d: string) => d,
    count: (c: number) => c.toString(),
    bpm: (b: number) => b.toString()
  },
  camelot: () => '8A',
  status: () => ({ status: 'ok', label: 'ok' }),
  icon: () => '<svg></svg>',
  html: { energy: () => '', key: () => '' }
} as unknown as typeof window.SongNodes;

globalThis.window.SongNodes.modules = [
  { key: 'paths', label: 'Paths', icon: 'route', summary: '' },
  { key: 'sources', label: 'Sources', icon: 'list', summary: '' },
  { key: 'graph', label: 'Graph', icon: 'git-merge', summary: '' },
  { key: 'library', label: 'Library', icon: 'library', summary: '' },
  { key: 'sets', label: 'Sets', icon: 'disc', summary: '' },
  { key: 'harmony', label: 'Harmony', icon: 'music', summary: '' },
  { key: 'pipeline', label: 'Pipeline', icon: 'server', summary: '' },
  { key: 'services', label: 'Settings', icon: 'settings', summary: '' }
] as typeof window.SongNodes.modules;

vi.mock('../features/musicLibrary/data', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    loadLibrary: vi.fn(() => Promise.resolve({ tracks: [], runs: [], generated: '2024-01-01' }))
  };
});

const localStorageMock = (() => {
  let store: Record<string, string> = {
    'sn-saved-sets': '[]'
  };
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(document, 'getElementById', { value: () => document.createElement('div') });

import { getAppRoutes } from './registry';

describe('registry', () => {
  it('loads static routes and discovered routes, rendering expected headings', async () => {
    const routes = getAppRoutes();
    const paths = routes.map(r => r.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/graph');
    expect(paths).toContain('/library');
    expect(paths).toContain('/sets');
    expect(paths).toContain('/paths');
    expect(paths).toContain('/harmony');
    expect(paths).toContain('/sources');
    expect(paths).toContain('/sources/targets');
    expect(paths).toContain('/pipeline');
    expect(paths).toContain('/settings');
    expect(paths).toContain('*');

    const TestApp = ({ url }: { url: string }) => (
      <MemoryRouter initialEntries={[url]}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            {routes.map(r => {
               const p = r.path.startsWith('/') && r.path !== '/' ? r.path.slice(1) : r.path;
               return <Route key={p} path={p} element={r.element} />;
            })}
          </Routes>
        </Suspense>
      </MemoryRouter>
    );

    let comp: any;
    await act(async () => {
      comp = render(<TestApp url="/" />);
    });
    await waitFor(() => {
      expect(screen.getByText(/Jump into a module/i)).toBeDefined();
    });
    comp.unmount();

    let notFound: any;
    await act(async () => {
      notFound = render(<TestApp url="/does-not-exist" />);
    });
    await waitFor(() => {
      expect(screen.getByText(/There is no page here/i)).toBeDefined();
    });
    notFound.unmount();
  });
});
