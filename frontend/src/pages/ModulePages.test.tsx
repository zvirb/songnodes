/**
 * Tests for ModulePages.
 */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SourcesPage } from './ModulePages';
import React from 'react';
import '../lib/songnodes';

describe('ModulePages', () => {
  it('SourcesPage has a link to import a tracklist with AI', () => {
    window.SongNodes = {
      format: {
        count: (n: number) => n.toString(),
        dateOnly: (d: string) => d,
        relative: () => '',
        stamp: () => '',
      },
      camelot: () => '',
      modules: [
        { key: 'sources', icon: 'test', label: 'Sources' },
      ],
    } as any;

    render(
      <MemoryRouter>
        <SourcesPage />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: /import a tracklist with ai/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/sources/import');
  });
});
