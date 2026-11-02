/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GraphControlsDock, zoomLabel, zoomStep, type GraphControlsDockProps } from './GraphControlsDock';

afterEach(cleanup);

const props = (over: Partial<GraphControlsDockProps> = {}): GraphControlsDockProps => ({
  zoom: 1, paused: false, nodes: 1284, links: 5210, announcement: '',
  onZoomIn: vi.fn(), onZoomOut: vi.fn(), onFit: vi.fn(), onReset: vi.fn(), onTogglePause: vi.fn(), ...over,
});

describe('zoomStep', () => {
  it('steps ×1.25 and stays inside 25–400%', () => {
    expect(zoomStep(1, 1)).toBeCloseTo(1.25);
    expect(zoomStep(1, -1)).toBeCloseTo(0.8);
    expect(zoomStep(3.5, 1)).toBe(4);
    expect(zoomStep(0.3, -1)).toBe(0.25);
  });

  it('labels zoom as a whole percent', () => {
    expect(zoomLabel(1.25)).toBe('125%');
  });
});

describe('GraphControlsDock', () => {
  it('names every control and shows the count and zoom', () => {
    render(<GraphControlsDock {...props()} />);
    for (const name of ['Zoom in', 'Zoom out', 'Fit graph to screen', 'Reset view', 'Pause layout']) {
      expect(screen.getByRole('button', { name }).getAttribute('title')).toBe(name);
    }
    expect(screen.getByText('1,284 nodes · 5,210 links')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Graph controls' })).toBeTruthy();
  });

  it('calls the matching handler for each button', () => {
    const p = props();
    render(<GraphControlsDock {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fit graph to screen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause layout' }));
    [p.onZoomIn, p.onZoomOut, p.onFit, p.onReset, p.onTogglePause].forEach((fn) => expect(fn).toHaveBeenCalledTimes(1));
  });

  it('disables zoom in at 400% and zoom out at 25%', () => {
    const { rerender } = render(<GraphControlsDock {...props({ zoom: 4 })} />);
    expect((screen.getByRole<HTMLButtonElement>('button', { name: 'Zoom in' })).disabled).toBe(true);
    expect((screen.getByRole<HTMLButtonElement>('button', { name: 'Zoom out' })).disabled).toBe(false);
    rerender(<GraphControlsDock {...props({ zoom: 0.25 })} />);
    expect((screen.getByRole<HTMLButtonElement>('button', { name: 'Zoom out' })).disabled).toBe(true);
  });

  it('shows the paused state with a Resume label, an idle pill and the live line', () => {
    render(<GraphControlsDock {...props({ paused: true, announcement: 'Layout paused' })} />);
    expect(screen.getByRole('button', { name: 'Resume layout' })).toBeTruthy();
    expect(screen.getByText('Layout paused', { selector: '.sn-pill' }).getAttribute('data-status')).toBe('idle');
    expect(screen.getByText('Layout paused', { selector: 'p' }).getAttribute('aria-live')).toBe('polite');
  });

  it('keeps pointer and wheel events on the dock away from the canvas zoom', () => {
    const outer = vi.fn();
    render(<div onPointerDown={outer} onWheel={outer} onClick={outer}><GraphControlsDock {...props()} /></div>);
    const button = screen.getByRole('button', { name: 'Zoom in' });
    fireEvent.pointerDown(button);
    fireEvent.wheel(button);
    fireEvent.click(button);
    expect(outer).not.toHaveBeenCalled();
  });

  it('switches the view with a named segmented control', () => {
    const onViewChange = vi.fn<(v: 'neighbourhood' | 'library') => void>();
    render(<GraphControlsDock {...props({ view: 'neighbourhood', onViewChange })} />);
    expect(screen.getByRole('group', { name: 'View' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Neighbourhood' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Whole library' }));
    expect(onViewChange).toHaveBeenCalledWith('library');
  });

  it('counts a cut neighbourhood against the library, with a note saying why', () => {
    const { container } = render(<GraphControlsDock {...props({ nodes: 200, links: 312, ofNodes: 1284 })} />);
    expect(screen.getByText(/200 of 1,284 nodes · 312 links/)).toBeTruthy();
    expect(container.querySelector('.sn-infotip')).toBeTruthy();
  });

  it('lets zoom out go down to a fitted limit below 25%', () => {
    const { rerender } = render(<GraphControlsDock {...props({ zoom: 0.1, minZoom: 0.05 })} />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Zoom out' }).disabled).toBe(false);
    rerender(<GraphControlsDock {...props({ zoom: 0.05, minZoom: 0.05 })} />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Zoom out' }).disabled).toBe(true);
  });

  it('steps zoom against the limits it is given', () => {
    expect(zoomStep(0.05, -1, { min: 0.04, max: 4 })).toBe(0.04);
    expect(zoomStep(0.05, 1, { min: 0.04, max: 4 })).toBeCloseTo(0.0625);
  });
});

