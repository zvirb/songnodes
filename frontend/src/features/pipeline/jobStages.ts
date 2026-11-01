/**
 * The stages of one scrape job (GET /api/v1/jobs/{job_id}/stages, JOBSTG) as StagedProgress steps.
 * The API sends done, running, waiting or failed and never "stalled": the running step gets
 * secondsSinceProgress from last_progress_at, and StagedProgress turns it stalled at 60 s.
 */
import type { StagedProgressStep } from '../../components/ds';
import { SN } from '../../lib/songnodes';
import { API_BASE_URL } from '../../lib/apiBase';

export interface JobStageProgress {
  pages: number;
  playlists: number;
  tracks: number;
  updated_at: string;
}

export interface JobStage {
  key: string;
  label: string;
  state: string;
  started_at: string | null;
  finished_at: string | null;
  detail: string | null;
  progress?: JobStageProgress | null;
}

export interface JobStagesResponse {
  job_id: string;
  kind: string;
  stages: JobStage[];
  last_progress_at: string | null;
}

export interface MappedJobStages {
  steps: StagedProgressStep[];
  elapsedSeconds: number;
  /** Every stage done, or one failed: nothing more will change, so polling stops. */
  finished: boolean;
}

type ApiState = 'done' | 'running' | 'waiting' | 'failed';
const isKnown = (state: string): state is ApiState => ['done', 'running', 'waiting', 'failed'].includes(state);

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};

const plural = (n: number, one: string, many: string) => `${SN.format.count(n)} ${n === 1 ? one : many}`;

/** "12 pages, 3 playlists and 140 tracks read so far", from the scraper's live record. */
export const progressText = (p: JobStageProgress): string =>
  `${plural(p.pages, 'page', 'pages')}, ${plural(p.playlists, 'playlist', 'playlists')} and ${plural(p.tracks, 'track', 'tracks')} read so far`;

export const mapJobStages = (res: JobStagesResponse, now: number = Date.now()): MappedJobStages => {
  const lastProgress = ms(res.last_progress_at);
  const steps = res.stages.map((s): StagedProgressStep => {
    const parts = [s.progress ? progressText(s.progress) : '', s.detail ?? ''].filter((t) => t !== '');
    if (!isKnown(s.state)) {
      // StagedProgress has no "unknown" state: the waiting glyph is the en dash, and the words say it is not known.
      return { name: s.label || '–', state: 'waiting', detail: `State not known: the stages API sent "${s.state || '–'}"` };
    }
    const step: StagedProgressStep = { name: s.label || '–', state: s.state };
    if (parts.length) step.detail = parts.join('. ');
    const started = ms(s.started_at);
    const ended = ms(s.finished_at);
    if ((s.state === 'done' || s.state === 'failed') && started != null && ended != null && ended >= started) {
      step.seconds = (ended - started) / 1000;
    }
    if (s.state === 'running' && lastProgress != null) {
      step.secondsSinceProgress = Math.max(0, (now - lastProgress) / 1000);
    }
    return step;
  });

  const finished = res.stages.length > 0
    && (res.stages.every((s) => s.state === 'done') || res.stages.some((s) => s.state === 'failed'));
  const starts = res.stages.map((s) => ms(s.started_at)).filter((t): t is number => t != null);
  const ends = res.stages.map((s) => ms(s.finished_at)).filter((t): t is number => t != null);
  const begin = starts.length ? Math.min(...starts) : null;
  const end = finished && ends.length ? Math.max(...ends) : now;
  const elapsedSeconds = begin != null ? Math.max(0, (end - begin) / 1000) : 0;
  return { steps, elapsedSeconds, finished };
};

const isStagesResponse = (data: unknown): data is JobStagesResponse =>
  typeof data === 'object' && data !== null && Array.isArray((data as { stages?: unknown }).stages);

/** Fetches the stages; a failure throws an Error whose message names the cause. */
export const fetchJobStages = async (jobId: string, signal?: AbortSignal): Promise<JobStagesResponse> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL || ''}/api/v1/jobs/${encodeURIComponent(jobId)}/stages`, { signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new Error('The REST API did not answer the stages request', { cause: e });
  }
  if (!response.ok) {
    let detail: unknown;
    try {
      detail = (await response.json())?.detail;
    } catch {
      detail = undefined;
    }
    throw new Error(typeof detail === 'string'
      ? `${detail} (HTTP ${response.status})`
      : `The stages request failed (HTTP ${response.status})`);
  }
  const data: unknown = await response.json();
  if (!isStagesResponse(data)) throw new Error('The stages API sent no stages');
  return data;
};
