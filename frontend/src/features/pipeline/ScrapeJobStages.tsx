/**
 * One scrape job as StagedProgress, polled from GET /api/v1/jobs/{job_id}/stages until every
 * stage is done or one has failed. There is no cancel API and a running scrape cannot be
 * retried (retry is for dead jobs only), so the card offers neither Cancel nor Try again.
 */
import React, { useEffect, useState } from 'react';
import { ErrorPanel, LoadingPanel, StagedProgress } from '../../components/ds';
import { fetchJobStages, mapJobStages, type JobStagesResponse } from './jobStages';

export const STAGES_POLL_MS = 5000;
const SOURCE_NAMES: Record<string, string> = { mixesdb: 'MixesDB', '1001tracklists': '1001Tracklists' };

export interface ScrapeJobStagesProps {
  jobId: string;
  /** The search query, shown as the bold title; an en dash when missing. */
  query: string;
  source: string;
}

export const ScrapeJobStages: React.FC<ScrapeJobStagesProps> = ({ jobId, query, source }) => {
  const [data, setData] = useState<JobStagesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let stopped = false;

    const load = async () => {
      window.clearTimeout(timer);
      if (document.hidden) return; // the visibility listener picks it up again
      try {
        const res = await fetchJobStages(jobId, controller.signal);
        if (controller.signal.aborted) return;
        setData(res);
        setError(null);
        setNow(Date.now());
        stopped = mapJobStages(res).finished;
      } catch (e) {
        if (controller.signal.aborted) return;
        setData(null); // never show stages we could not read
        setError(e instanceof Error && e.message ? e.message : 'The stages request failed');
      }
      if (!stopped) timer = window.setTimeout(load, STAGES_POLL_MS);
    };
    const onVisible = () => { if (!document.hidden && !stopped) void load(); };

    void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [jobId]);

  const label = `Stages of the scrape for ${query || 'a job with no search'}`;
  if (error) {
    return (
      <ErrorPanel panel title="Could not read the stages of this scrape" aria-label={label}
        retry="Trying again every few seconds.">
        {error}
      </ErrorPanel>
    );
  }
  if (!data) return <LoadingPanel rows={4} message="Reading the stages of this scrape…" aria-label={label} />;

  const mapped = mapJobStages(data, now);
  return (
    <section className="sn-card sn-m-pipeline" aria-label={label}>
      <StagedProgress
        lead={source ? `Scrape on ${SOURCE_NAMES[source] ?? source}` : 'Scrape'}
        title={query || '–'}
        steps={mapped.steps}
        elapsedSeconds={mapped.elapsedSeconds}
        runsInBackground={!mapped.finished}
      />
    </section>
  );
};

export default ScrapeJobStages;
