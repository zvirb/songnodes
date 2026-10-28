/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StagedProgress, type StagedProgressStep } from './StagedProgress';

afterEach(cleanup);

const STEPS: StagedProgressStep[] = [
  { name: 'Fetch radio plays', state: 'done', seconds: 42, detail: '1,912 plays from PBS Soul Time' },
  { name: 'Match plays to tracks', state: 'running', done: 312, total: 500, detail: 'Matching 312 of 500 tracks' },
  { name: 'Look up key and BPM', state: 'waiting' },
];

const stepOf = (name: string) => screen.getByText(name).closest('li');

describe('StagedProgress', () => {
  it('renders each step state with its glyph word and the running meter', () => {
    render(<StagedProgress lead="Weekly build" title="Sat 24 Oct" steps={STEPS} elapsedSeconds={258} />);
    expect(screen.getByRole('heading').textContent).toBe('Weekly build: Sat 24 Oct');
    expect(stepOf('Fetch radio plays').getAttribute('data-state')).toBe('done');
    expect(stepOf('Fetch radio plays').textContent).toContain('● Done · 0:42');
    const running = stepOf('Match plays to tracks');
    expect(running.getAttribute('aria-current')).toBe('step');
    expect(running.textContent).toContain('Running');
    const meter = screen.getByRole('progressbar', { name: 'Match plays to tracks' });
    expect(meter.getAttribute('aria-valuenow')).toBe('312');
    expect(meter.getAttribute('aria-valuetext')).toBe('312 of 500');
    expect(meter.querySelector('i')?.getAttribute('style')).toContain('--p: 62.4%');
    expect(stepOf('Look up key and BPM').textContent).toContain('Waiting');
    expect(stepOf('Look up key and BPM').hasAttribute('aria-current')).toBe(false);
  });

  it('shows elapsed time and an estimate only when given, rounded up', () => {
    const { rerender } = render(<StagedProgress lead="Weekly build" title="Sat 24 Oct" steps={STEPS} elapsedSeconds={258} />);
    expect(screen.getByText(/Elapsed/).textContent).toBe('Elapsed 4:18');
    expect(screen.queryByText(/min left/)).toBeNull();
    rerender(<StagedProgress lead="Weekly build" title="Sat 24 Oct" steps={STEPS} elapsedSeconds={258} remainingSeconds={150} />);
    expect(screen.getByText('About 3 min left')).toBeTruthy();
  });

  it('shows Cancel only when the job can be cancelled', () => {
    const onCancel = vi.fn<() => void>();
    const { rerender } = render(<StagedProgress lead="Weekly build" title="Sat 24 Oct" steps={STEPS} elapsedSeconds={10} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<StagedProgress lead="Weekly build" title="Sat 24 Oct" steps={STEPS} elapsedSeconds={10} onCancel={onCancel} cancelLabel="Cancel build" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel build' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('marks a failed step, stops the clock and announces it in the live region', () => {
    const { rerender } = render(<StagedProgress lead="Import" title="Ben UFO at Sub Club" steps={STEPS} elapsedSeconds={30} onCancel={() => {}} />);
    const live = screen.getByRole('status');
    expect(live.textContent).toBe('');
    const failed: StagedProgressStep[] = [
      STEPS[0],
      { name: 'Match plays to tracks', state: 'failed', seconds: 35, detail: 'MixesDB did not answer within 30 s.', actions: <button type="button" className="sn-btn sn-btn--sm">Retry this step</button> },
      STEPS[2],
    ];
    rerender(<StagedProgress lead="Import" title="Ben UFO at Sub Club" steps={failed} elapsedSeconds={41} onCancel={() => {}} />);
    expect(stepOf('Match plays to tracks').textContent).toContain('Failed · 0:35');
    expect(screen.getByText(/Stopped after/).textContent).toBe('Stopped after 0:41');
    expect(live.textContent).toBe('Failed: Match plays to tracks. MixesDB did not answer within 30 s.');
    expect(screen.getByRole('button', { name: 'Retry this step' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('shows the background notice when the job survives navigation', () => {
    render(<StagedProgress lead="Weekly build" title="Sat 24 Oct" steps={STEPS} elapsedSeconds={1} runsInBackground />);
    expect(screen.getByText(/You can leave this page/)).toBeTruthy();
  });
});
