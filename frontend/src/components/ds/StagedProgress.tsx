/**
 * StagedProgress (design system 1.2.0, Feedback).
 *
 * A long or multi-step job as ordered steps with honest state, the running step's detail and
 * meter, elapsed time, an estimate only when known, and Cancel only where the job allows it.
 * Markup and behaviour: design-system/components/StagedProgress/README.md.
 */
import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { GLYPH, SN } from '../../lib/songnodes';

export interface StagedProgressStep {
  /** Step name, verb first: "Match plays to tracks". */
  name: string;
  /** done ●, running ↻, waiting –, failed ✕, cancelled –. */
  state: 'done' | 'running' | 'waiting' | 'failed' | 'cancelled';
  /** Current detail: "Matching 312 of 500 tracks", or the failure reason. */
  detail?: string;
  /** Items done for the running step; shows a neutral meter when total is known too. */
  done?: number;
  /** Total items for the running step. */
  total?: number;
  /** Seconds the step took (done/failed). */
  seconds?: number;
  /** Step-level actions after a failure ("Retry this step", "Skip MixesDB"). */
  actions?: React.ReactNode;
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
}

function stateLabel(s: StagedProgressStep): string {
  const took = s.seconds != null ? ` · ${SN.format.duration(s.seconds)}` : '';
  switch (s.state) {
    case 'done': return `${GLYPH.ok} Done${took}`;
    case 'running': return 'Running';
    case 'failed': return `Failed${took}`;
    case 'cancelled': return 'Cancelled';
    default: return 'Waiting';
  }
}

/** What the live region says: step changes, failures and completion only, never count ticks. */
function announcement(lead: string, steps: StagedProgressStep[]): string {
  const failed = steps.find((s) => s.state === 'failed');
  if (failed) return `Failed: ${failed.name}.${failed.detail ? ` ${failed.detail}` : ''}`;
  if (steps.some((s) => s.state === 'cancelled')) return `${lead} cancelled.`;
  const i = steps.findIndex((s) => s.state === 'running');
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
  className = '',
  ...props
}, ref) => {
  const signature = steps.map((s) => `${s.name}:${s.state}`).join('|');
  const [prevSignature, setPrevSignature] = useState(signature);
  const [said, setSaid] = useState('');
  // Announce only when a step changes state (derived during render, no effect needed).
  if (prevSignature !== signature) {
    setPrevSignature(signature);
    setSaid(announcement(lead, steps));
  }

  const failed = steps.some((s) => s.state === 'failed');
  const cancelled = steps.some((s) => s.state === 'cancelled');
  const active = !failed && !cancelled && steps.some((s) => s.state === 'running' || s.state === 'waiting');
  const elapsed = SN.format.duration(elapsedSeconds);

  return (
    <div ref={ref} className={['sn-staged-progress', className].filter(Boolean).join(' ')} {...props}>
      <div className="sn-staged-progress__head">
        <h2 className="sn-title title-s"><span className="sn-lead">{lead}:</span> {title}</h2>
        <div className="sn-staged-progress__time">
          <span>{failed || cancelled ? 'Stopped after' : 'Elapsed'} <b>{elapsed}</b></span>
          {cancelled ? <span>Cancelled</span>
            : active && remainingSeconds != null && remainingSeconds > 0
              ? <span>About {Math.max(1, Math.ceil(remainingSeconds / 60))} min left</span>
              : null}
        </div>
      </div>
      <ol className="sn-staged-progress__steps">
        {steps.map((s, i) => {
          const running = s.state === 'running';
          const meter = running && s.done != null && s.total != null && s.total > 0;
          const pct = meter ? Math.min(100, (100 * (s.done ?? 0)) / (s.total ?? 1)) : 0;
          const fill: React.CSSProperties & { '--p': string } = { '--p': `${pct.toFixed(1)}%` };
          return (
            <li key={`${i}-${s.name}`} className="sn-staged-progress__step" data-state={s.state} aria-current={running ? 'step' : undefined}>
              <span className="sn-staged-progress__glyph" aria-hidden="true" />
              <span className="sn-staged-progress__name">{s.name}</span>
              <span className="sn-staged-progress__state">{stateLabel(s)}</span>
              {s.detail ? <p className="sn-staged-progress__detail">{s.detail}</p> : null}
              {meter ? (
                <div
                  className="sn-staged-progress__meter"
                  role="progressbar"
                  aria-label={s.name}
                  aria-valuemin={0}
                  aria-valuemax={s.total}
                  aria-valuenow={s.done}
                  aria-valuetext={`${SN.format.count(s.done ?? 0)} of ${SN.format.count(s.total ?? 0)}`}
                >
                  <i style={fill} />
                </div>
              ) : null}
              {s.actions ? <div className="sn-staged-progress__actions">{s.actions}</div> : null}
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
      {onCancel && active ? (
        <div className="sn-staged-progress__foot">
          <button type="button" className="sn-btn" onClick={onCancel}>{cancelLabel}</button>
        </div>
      ) : null}
    </div>
  );
});
StagedProgress.displayName = 'StagedProgress';
