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

const matchingAfter = (gap: number): StagedProgressStep[] => [
  { name: 'Match plays to tracks', state: 'running', done: 10, total: 50, secondsSinceProgress: gap },
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

  it('renders a stalled step as a warning with its meter kept where it stopped', () => {
    const steps: StagedProgressStep[] = [
      { name: 'Read the library', state: 'done', seconds: 9, detail: '2,410 tracks' },
      { name: 'Look up key and BPM', state: 'stalled', done: 1204, total: 2410, detail: 'Stopped at 1,204 of 2,410 tracks.' },
      { name: 'Draw the crate', state: 'waiting' },
    ];
    render(<StagedProgress lead="Loading the library" title="2,410 tracks" steps={steps} elapsedSeconds={167} remainingSeconds={120} onCancel={() => {}} />);
    const step = stepOf('Look up key and BPM');
    expect(step.getAttribute('data-state')).toBe('stalled');
    expect(step.getAttribute('aria-current')).toBe('step');
    expect(step.querySelector('.sn-staged-progress__state')?.textContent).toBe('▲ No progress for 60 s');
    const meter = screen.getByRole('progressbar', { name: 'Look up key and BPM' });
    expect(meter.getAttribute('aria-valuenow')).toBe('1204');
    expect(meter.getAttribute('aria-valuetext')).toBe('1,204 of 2,410, no progress for 60 s');
    expect(meter.querySelector('i')?.getAttribute('style')).toContain('--p: 50.0%');
    expect(screen.getByText(/Elapsed/).textContent).toBe('Elapsed 2:47');
    expect(screen.queryByText(/min left/)).toBeNull();
    expect(stepOf('Read the library').textContent).toContain('● Done · 0:09');
  });

  it('turns a running step stalled after stallSeconds without progress, never on elapsed time', () => {
    const { rerender } = render(<StagedProgress lead="Import" title="Set" steps={matchingAfter(59)} elapsedSeconds={3600} />);
    expect(stepOf('Match plays to tracks').getAttribute('data-state')).toBe('running');
    rerender(<StagedProgress lead="Import" title="Set" steps={matchingAfter(75)} elapsedSeconds={3600} />);
    expect(stepOf('Match plays to tracks').getAttribute('data-state')).toBe('stalled');
    expect(stepOf('Match plays to tracks').textContent).toContain('▲ No progress for 75 s');
    rerender(<StagedProgress lead="Import" title="Set" steps={matchingAfter(75)} elapsedSeconds={3600} stallSeconds={90} />);
    expect(stepOf('Match plays to tracks').getAttribute('data-state')).toBe('running');
  });

  it('puts Try again and Cancel in the stalled step and calls them', () => {
    const onResume = vi.fn<(i: number) => void>();
    const onCancel = vi.fn<() => void>();
    const steps: StagedProgressStep[] = [
      STEPS[0],
      { name: 'Match plays to tracks', state: 'stalled', done: 312, total: 500 },
      STEPS[2],
    ];
    render(<StagedProgress lead="Weekly build" title="Sat 24 Oct" steps={steps} elapsedSeconds={90} onResume={onResume} onCancel={onCancel} cancelLabel="Cancel build" />);
    const actions = stepOf('Match plays to tracks').querySelector('.sn-staged-progress__actions');
    expect(actions).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again from Match plays to tracks' }));
    expect(onResume).toHaveBeenCalledWith(1);
    const cancel = screen.getAllByRole('button', { name: 'Cancel build' });
    expect(cancel).toHaveLength(1);
    expect(cancel[0].className).toContain('sn-btn--quiet');
    fireEvent.click(cancel[0]);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.sn-staged-progress__foot')).toBeNull();
  });

  it('announces a stall once, politely, and says when the step moves again', () => {
    const running: StagedProgressStep[] = [{ name: 'Look up key and BPM', state: 'running', done: 1, total: 9, secondsSinceProgress: 5 }];
    const { rerender } = render(<StagedProgress lead="Load" title="Library" steps={running} elapsedSeconds={5} />);
    const live = screen.getByRole('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    rerender(<StagedProgress lead="Load" title="Library" steps={[{ ...running[0], secondsSinceProgress: 60 }]} elapsedSeconds={60} />);
    expect(live.textContent).toBe('Look up key and BPM: no progress for 60 s. Try again carries on from this step.');
    rerender(<StagedProgress lead="Load" title="Library" steps={[{ ...running[0], secondsSinceProgress: 70 }]} elapsedSeconds={70} />);
    expect(live.textContent).toBe('Look up key and BPM: no progress for 60 s. Try again carries on from this step.');
    rerender(<StagedProgress lead="Load" title="Library" steps={[{ ...running[0], done: 2, secondsSinceProgress: 0 }]} elapsedSeconds={71} />);
    expect(live.textContent).toBe('Look up key and BPM is moving again.');
  });

  it('leaves the other states unchanged when no stall data is given', () => {
    const onCancel = vi.fn<() => void>();
    render(<StagedProgress lead="Weekly build" title="Sat 24 Oct" steps={STEPS} elapsedSeconds={258} remainingSeconds={150} onCancel={onCancel} onResume={() => {}} />);
    expect(document.querySelector('[data-state="stalled"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /Try again/ })).toBeNull();
    expect(screen.getByText('About 3 min left')).toBeTruthy();
    expect(document.querySelector('.sn-staged-progress__foot button')?.textContent).toBe('Cancel');
  });
});
