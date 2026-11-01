/**
 * Scheduled-scrape window on /pipeline (DS24C).
 *
 * The owner picks the Melbourne calendar days (both included) on which the hourly target scrape may queue jobs.
 * GET/PUT /api/v1/scrape/window (DS24B) stores {starts_on, ends_on, updated_at}; both null means every day and one
 * null end is open. Manual scrapes are never limited. The page's one primary button is "Queue scrape", so Save is
 * a default button and Clear is quiet.
 */
import React, { useEffect, useId, useState } from 'react';
import { SN } from '../../lib/songnodes';
import { API_BASE_URL } from '../../lib/apiBase';
import { Button, DateRangeField, ErrorPanel, LoadingPanel, SectionHeading, StatusPill, showToast } from '../../components/ds';

type Range = [string | null, string | null];

export interface ScrapeWindow {
  starts_on: string | null;
  ends_on: string | null;
  updated_at: string | null;
}

const WINDOW_URL = `${API_BASE_URL || ''}/api/v1/scrape/window`;

/** The API's error as a sentence: a string detail, the first validation message, or the HTTP status. */
async function errorOf(response: Response, action: string): Promise<string> {
  let detail: unknown;
  try {
    detail = (await response.json())?.detail;
  } catch {
    detail = undefined;
  }
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return String(detail[0].msg).replace(/^Value error, /, '');
  return `Could not ${action} the scrape window (HTTP ${response.status}).`;
}

/** "Scheduled scrapes run from Tue 1 – Thu 31 Dec 2026", open-ended, or every day. */
export function windowSentence(starts: string | null, ends: string | null): string {
  if (starts && ends) return `Scheduled scrapes run from ${SN.format.range(starts, ends)}.`;
  if (starts) return `Scheduled scrapes run from ${SN.format.range(starts, starts)}, with no end date.`;
  if (ends) return `Scheduled scrapes run until ${SN.format.range(ends, ends)}.`;
  return 'Scheduled scrapes run every day.';
}

/** Pill (glyph plus word through SN.status) for today in Melbourne, and why it is paused. */
function stateOf(starts: string | null, ends: string | null, today: string): { raw: string; label: string; note: string } {
  if (!starts && !ends) return { raw: 'healthy', label: 'Every day', note: '' };
  if (starts && today < starts) return { raw: 'disabled', label: 'Paused', note: `Paused until ${SN.format.dateOnly(starts)}.` };
  if (ends && today > ends) return { raw: 'disabled', label: 'Paused', note: `Paused: the window ended on ${SN.format.dateOnly(ends)}.` };
  return { raw: 'running', label: 'Running inside window', note: '' };
}

export const ScrapeWindowCard: React.FC = () => {
  const errId = useId();
  const [saved, setSaved] = useState<ScrapeWindow | null>(null);
  const [draft, setDraft] = useState<Range>([null, null]);
  const [loadError, setLoadError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(WINDOW_URL, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setLoadError(await errorOf(response, 'load'));
          return;
        }
        const data: ScrapeWindow = await response.json();
        setSaved(data);
        setDraft([data.starts_on, data.ends_on]);
      } catch {
        if (!controller.signal.aborted) setLoadError('Could not reach the REST API to load the scrape window.');
      }
    };
    void load();
    return () => controller.abort();
    // `attempt` is the retry key: "Try again" bumps it to load once more.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [attempt]);

  const retry = () => {
    setLoadError('');
    setAttempt((n) => n + 1);
  };

  const [from, to] = draft;
  const unchanged = saved != null && from === saved.starts_on && to === saved.ends_on;
  const disabledReason = from && to && from > to
    ? 'The From date must be on or before the To date.'
    : unchanged ? 'No changes to save.' : undefined;

  const edit = (next: Range) => {
    setDraft(next);
    setFieldError('');
  };

  const save = async () => {
    setIsSaving(true);
    setFieldError('');
    try {
      const response = await fetch(WINDOW_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starts_on: from, ends_on: to }),
      });
      if (!response.ok) {
        setFieldError(await errorOf(response, 'save'));
        return;
      }
      const data: ScrapeWindow = await response.json();
      setSaved(data);
      setDraft([data.starts_on, data.ends_on]);
      showToast(data.starts_on || data.ends_on ? 'Scrape window saved' : 'Scrape window cleared');
    } catch {
      setFieldError('Could not reach the REST API to save the scrape window. Try saving again.');
    } finally {
      setIsSaving(false);
    }
  };

  const state = saved ? stateOf(saved.starts_on, saved.ends_on, SN.calendar.today()) : null;

  return (
    <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
      <SectionHeading title="Scheduled scrape window" />
      {loadError ? (
        <ErrorPanel panel title="Could not load the scrape window" actions={<Button onClick={retry}>Try again</Button>}>
          {loadError}
        </ErrorPanel>
      ) : !saved || !state ? (
        <LoadingPanel rows={3} message="Loading the scrape window…" />
      ) : (
        <div className="sn-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }} aria-live="polite">
            <StatusPill raw={state.raw} label={state.label} />
            <span className="body">{windowSentence(saved.starts_on, saved.ends_on)}{state.note ? ` ${state.note}` : ''}</span>
          </div>
          <DateRangeField
            label="Run scheduled scrapes between"
            value={draft}
            onChange={edit}
            presets={[]}
            aria-describedby={fieldError ? errId : undefined}
            aria-invalid={fieldError ? true : undefined}
          />
          {fieldError ? <span className="sn-field__error" id={errId}>{fieldError}</span> : null}
          <p className="caption" style={{ margin: 0 }}>
            Melbourne calendar days, both included. Leave a date empty for no limit on that side. Manual scrapes from Queue a scrape are not limited.
            {saved.updated_at ? ` Saved ${SN.format.dateTime(saved.updated_at)}.` : ''}
          </p>
          <div className="sn-card__foot" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <Button onClick={() => void save()} busy={isSaving} busyLabel="Saving…" disabledReason={disabledReason}>
              Save window
            </Button>
            <Button kind="quiet" onClick={() => edit([null, null])} disabled={from === null && to === null}>
              Clear dates
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ScrapeWindowCard;
