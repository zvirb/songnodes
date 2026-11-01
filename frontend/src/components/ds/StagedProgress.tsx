/**
 * StagedProgress (design system 1.4.0, Feedback).
 *
 * A long or multi-step job as ordered steps with honest state, the running step's detail and
 * meter, elapsed time, an estimate only when known, and Cancel only where the job allows it.
 * 1.4.0: a step that sends no progress for `stallSeconds` is `stalled` (▲, status-warn), never
 * failed by elapsed time; its actions are Try again (resumes from that step) and Cancel.
 * Markup and behaviour: design-system/components/StagedProgress/README.md.
 */
import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { GLYPH, SN } from '../../lib/songnodes';

export interface StagedProgressStep {
  /** Step name, verb first: "Match plays to tracks". */
  name: string;
  /** done ●, running ↻, waiting –, failed ✕, cancelled –, stalled ▲ (no progress for `stallSeconds`). */
  state: 'done' | 'running' | 'waiting' | 'failed' | 'cancelled' | 'stalled';
  /** Current detail: "Matching 312 of 500 tracks", or the failure reason. */
  detail?: string;
  /** Items done for the running step; shows a neutral meter when total is known too. */
  done?: number;
  /** Total items for the running step. */
  total?: number;
  /** Seconds the step took (done/failed). */
  seconds?: number;
  /** Step-level actions after a failure or a stall ("Retry this step", "Skip MixesDB"). */
  actions?: React.ReactNode;
  /** Seconds since this step last reported progress; a running step turns `stalled` at `stallSeconds`. */
  secondsSinceProgress?: number;
}

export interface StagedProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Thin part of the title: "Weekly build". */
  lead: string;
  /** Bold part of the title: "Sat 24 Oct". */
  title: string;
  /** Ordered steps. */
  steps: StagedProgressStep[];
  /** Seconds since start; rendered as "Elapsed 4:18". */
  elapsedSeconds: number;
  /** Seconds left, only when the job can estimate honestly ("About 3 min left"). */
  remainingSeconds?: number;
  /** Cancels the job; omit when the job cannot be cancelled. */
  onCancel?: () => void;
  /** Cancel button label, named for the job ("Cancel build"). Default "Cancel". */
  cancelLabel?: string;
  /** The job runs on the server and survives navigation: shows the "You can leave this page" notice. */
  runsInBackground?: boolean;
  /** Seconds without progress from the current step before it turns `stalled`. Default 60. */
  stallSeconds?: number;
  /** Resumes from the stalled step (its "Try again"); done steps are kept. */
  onResume?: (stepIndex: number) => void;
}

type StepState = StagedProgressStep['state'];

/** A running step that has sent nothing for `stallSeconds` is stalled; elapsed time alone never is. */
function effectiveState(s: StagedProgressStep, stallSeconds: number): StepState {
  if (s.state === 'running' && s.secondsSinceProgress != null && s.secondsSinceProgress >= stallSeconds) return 'stalled';
  return s.state;
}

/** Seconds shown in "No progress for N s": the measured gap when known, otherwise the threshold. */
function stallFor(s: StagedProgressStep, stallSeconds: number): string {
  return SN.format.count(Math.floor(s.secondsSinceProgress ?? stallSeconds));
}

function stateLabel(s: StagedProgressStep, state: StepState, stallSeconds: number): string {
  const took = s.seconds != null ? ` · ${SN.format.duration(s.seconds)}` : '';
  switch (state) {
    case 'done': return `${GLYPH.ok} Done${took}`;
    case 'running': return 'Running';
    case 'failed': return `Failed${took}`;
    case 'cancelled': return 'Cancelled';
    case 'stalled': return `${GLYPH.warn} No progress for ${stallFor(s, stallSeconds)} s`;
    default: return 'Waiting';
  }
}

/** What the live region says: step changes, failures, a stall once and completion, never count ticks. */
function announcement(lead: string, steps: StagedProgressStep[], states: StepState[], prev: StepState[], stallSeconds: number): string {
  const failed = steps.find((_, i) => states[i] === 'failed');
  if (failed) return `Failed: ${failed.name}.${failed.detail ? ` ${failed.detail}` : ''}`;
  if (states.includes('cancelled')) return `${lead} cancelled.`;
  const stalled = states.indexOf('stalled');
  if (stalled >= 0) return `${steps[stalled].name}: no progress for ${SN.format.count(stallSeconds)} s. Try again carries on from this step.`;
  const i = states.indexOf('running');
  if (i >= 0 && prev[i] === 'stalled') return `${steps[i].name} is moving again.`;
  if (i >= 0) return `Step ${i + 1} of ${steps.length}: ${steps[i].name}.`;
  if (steps.length > 0 && steps.every((s) => s.state === 'done')) return `${lead} finished.`;
  return '';
}

export const StagedProgress = React.forwardRef<HTMLDivElement, StagedProgressProps>(({
  lead,
  title,
  steps,
  elapsedSeconds,
  remainingSeconds,
  onCancel,
  cancelLabel = 'Cancel',
  runsInBackground = false,
  stallSeconds = 60,
  onResume,
  className = '',
  ...props
}, ref) => {
  const states = steps.map((s) => effectiveState(s, stallSeconds));
  const signature = steps.map((s, i) => `${s.name}:${states[i]}`).join('|');
  const [prev, setPrev] = useState({ signature, states });
  const [said, setSaid] = useState('');
  // Announce only when a step changes state (derived during render, no effect needed).
  if (prev.signature !== signature) {
    setPrev({ signature, states });
    setSaid(announcement(lead, steps, states, prev.states, stallSeconds));
  }

  const failed = states.includes('failed');
  const cancelled = states.includes('cancelled');
  const stalled = states.includes('stalled');
  const active = !failed && !cancelled && states.some((s) => s === 'running' || s === 'waiting' || s === 'stalled');
  const elapsed = SN.format.duration(elapsedSeconds);

  return (
    <div ref={ref} className={['sn-staged-progress', className].filter(Boolean).join(' ')} {...props}>
      <div className="sn-staged-progress__head">
        <h2 className="sn-title title-s"><span className="sn-lead">{lead}:</span> {title}</h2>
        <div className="sn-staged-progress__time">
          <span>{failed || cancelled ? 'Stopped after' : 'Elapsed'} <b>{elapsed}</b></span>
          {cancelled ? <span>Cancelled</span>
            : active && !stalled && remainingSeconds != null && remainingSeconds > 0
              ? <span>About {Math.max(1, Math.ceil(remainingSeconds / 60))} min left</span>
              : null}
        </div>
      </div>
      <ol className="sn-staged-progress__steps">
        {steps.map((s, i) => {
          const state = states[i];
          const running = state === 'running';
          const isStalled = state === 'stalled';
          // A stalled step keeps its meter where it stopped.
          const meter = (running || isStalled) && s.done != null && s.total != null && s.total > 0;
          const pct = meter ? Math.min(100, (100 * (s.done ?? 0)) / (s.total ?? 1)) : 0;
          const fill: React.CSSProperties & { '--p': string } = { '--p': `${pct.toFixed(1)}%` };
          return (
            <li key={`${i}-${s.name}`} className="sn-staged-progress__step" data-state={state} aria-current={running || isStalled ? 'step' : undefined}>
              <span className="sn-staged-progress__glyph" aria-hidden="true" />
              <span className="sn-staged-progress__name">{s.name}</span>
              <span className="sn-staged-progress__state">{stateLabel(s, state, stallSeconds)}</span>
              {s.detail ? <p className="sn-staged-progress__detail">{s.detail}</p> : null}
              {meter ? (
                <div
                  className="sn-staged-progress__meter"
                  role="progressbar"
                  aria-label={s.name}
                  aria-valuemin={0}
                  aria-valuemax={s.total}
                  aria-valuenow={s.done}
                  aria-valuetext={`${SN.format.count(s.done ?? 0)} of ${SN.format.count(s.total ?? 0)}${isStalled ? `, no progress for ${stallFor(s, stallSeconds)} s` : ''}`}
                >
                  <i style={fill} />
                </div>
              ) : null}
              {isStalled && (onResume || onCancel || s.actions) ? (
                <div className="sn-staged-progress__actions">
                  {onResume ? (
                    <button type="button" className="sn-btn sn-btn--sm" aria-label={`Try again from ${s.name}`} onClick={() => onResume(i)}>Try again</button>
                  ) : null}
                  {onCancel ? (
                    <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={onCancel}>{cancelLabel}</button>
                  ) : null}
                  {s.actions}
                </div>
              ) : s.actions ? <div className="sn-staged-progress__actions">{s.actions}</div> : null}
            </li>
          );
        })}
      </ol>
      <p className="sn-sr" role="status" aria-live="polite">{said}</p>
      {runsInBackground ? (
        <p className="sn-staged-progress__notice">
          <Info className="sn-icon" size={16} strokeWidth={2} aria-hidden />
          <span>You can leave this page. The job keeps running and finishes on its own.</span>
        </p>
      ) : null}
      {onCancel && active && !stalled ? (
        <div className="sn-staged-progress__foot">
          <button type="button" className="sn-btn" onClick={onCancel}>{cancelLabel}</button>
        </div>
      ) : null}
    </div>
  );
});
StagedProgress.displayName = 'StagedProgress';
