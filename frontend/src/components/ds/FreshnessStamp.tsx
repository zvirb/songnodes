import React, { useEffect, useId } from 'react';
import { SN, SnIcon } from '../../lib/songnodes';

export interface FreshnessStampProps {
  /** Verb or lead-in naming the stamp ("Library as of", "Built", "Saved", "Updated"). */
  label?: string;
  /** The stamp timestamp. */
  at?: Date | string | null;
  /** True when the stamp was expected but never loaded / unknown. */
  unknown?: boolean;
  /** Days after which data is considered stale (default 7 for data pages). */
  staleAfterDays?: number;
  /** Custom warning message for the InfoTip when stale. */
  staleMessage?: string;
  /** True while new data is being fetched/updated in background. */
  refreshing?: boolean;
  className?: string;
}

export const FreshnessStamp: React.FC<FreshnessStampProps> = ({
  label = 'Updated',
  at,
  unknown,
  staleAfterDays = 7,
  staleMessage = 'Data is more than 7 days old; run a weekly sync',
  refreshing,
  className = '',
}) => {
  const autoId = useId().replace(/:/g, '');
  const tipId = `freshness-tip-${autoId}`;

  const d = at ? new Date(at) : null;
  const validDate = d != null && !Number.isNaN(d.getTime());
  const ageMs = validDate ? Date.now() - d.getTime() : 0;
  const isStale = validDate && ageMs > staleAfterDays * 86400000;

  useEffect(() => {
    if (isStale && typeof window !== 'undefined' && window.SongNodes?.infoTips) {
      window.SongNodes.infoTips();
    }
  }, [isStale]);

  if (!validDate) {
    if (unknown) {
      return (
        <span className={`sn-freshness-stamp ${className}`.trim()} role="status">
          <SnIcon name="clock" size={14} />
          <span>{label} <span className="sn-none">–</span></span>
        </span>
      );
    }
    return null;
  }

  const tipHtml = isStale && typeof window !== 'undefined' && window.SongNodes?.infoTip
    ? window.SongNodes.infoTip({
        id: tipId,
        about: 'Data freshness',
        text: staleMessage,
      })
    : '';

  const staleStyle = isStale ? { color: 'var(--fg-3)' } : undefined;

  return (
    <span
      className={`sn-freshness-stamp ${isStale ? 'sn-freshness-stamp--stale' : ''} ${className}`.trim()}
      style={staleStyle}
      data-refreshing={refreshing ? '' : undefined}
      role="status"
    >
      <SnIcon name="clock" size={14} />
      <span>
        {label}{' '}
        <time
          dateTime={d.toISOString()}
          title={SN.format ? SN.format.relative(d) : undefined}
          style={staleStyle}
        >
          {SN.format ? SN.format.stamp(d) : d.toLocaleString()}
        </time>
      </span>
      {refreshing ? (
        <span className="sn-freshness-stamp__busy">
          <span className="sn-spinner" aria-hidden="true" />
          Updating…
        </span>
      ) : (
        <>
          <span className="sn-freshness-stamp__rel" style={staleStyle}>
            ({SN.format ? SN.format.relative(d) : 'ago'})
          </span>
          {tipHtml ? (
            <span
              dangerouslySetInnerHTML={{ __html: tipHtml }}
            />
          ) : null}
        </>
      )}
    </span>
  );
};
