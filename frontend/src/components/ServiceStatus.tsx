import React from 'react';
import { SN, StatusPill } from '../lib/songnodes';

export interface ServiceStatusProps {
  /** The connected service. */
  service: 'Spotify' | 'TIDAL' | 'Beatport';
  /** Connection state. */
  state: 'connected' | 'expired' | 'not-connected' | 'error';
  /** Account name when connected. */
  account?: string;
  /** Expiry as an ISO date or timestamp number. */
  expiresAt?: string | number;
  /** What happened and what to do next (expired, error). */
  detail?: string;
  /** Connect or reconnect handler. */
  onConnect?: () => void;
  /** Disconnect handler. */
  onDisconnect?: () => void;
  className?: string;
}

const formatExpiry = (exp?: string | number) => {
  if (!exp) return null;
  try {
    const d = typeof exp === 'number' ? new Date(exp) : new Date(exp);
    if (Number.isNaN(d.getTime())) return null;
    return SN.format.dateTime(d);
  } catch {
    return null;
  }
};

export const ServiceStatus: React.FC<ServiceStatusProps> = ({
  service,
  state,
  account,
  expiresAt,
  detail,
  onConnect,
  onDisconnect,
  className = '',
}) => {
  const mark =
    service === 'Spotify'
      ? 'Sp'
      : service === 'TIDAL'
      ? 'Ti'
      : 'Bp';

  const formattedExpiry = formatExpiry(expiresAt);

  const renderStatusPill = () => {
    switch (state) {
      case 'connected':
        return <StatusPill raw="ok" label="Connected" />;
      case 'expired':
        return <StatusPill raw="warn" label="Expired" />;
      case 'not-connected':
        return <StatusPill raw="idle" label="Not connected" />;
      case 'error':
        return <StatusPill raw="failed" label="Error" />;
      default:
        return null;
    }
  };

  const renderDetail = () => {
    if (detail) {
      return <div className="sn-service-status__detail">{detail}</div>;
    }

    switch (state) {
      case 'connected':
        return (
          <div className="sn-service-status__detail">
            {account ? (
              <>
                Signed in as <span className="sn-mono">{account}</span>
                {formattedExpiry ? ` · expires ${formattedExpiry} and renews itself` : ''}
              </>
            ) : formattedExpiry ? (
              `Connected · expires ${formattedExpiry} and renews itself`
            ) : (
              'Connected and active'
            )}
          </div>
        );
      case 'expired':
        return (
          <div className="sn-service-status__detail">
            {formattedExpiry ? `Sign-in expired ${formattedExpiry}. ` : 'Sign-in expired. '}
            Sunday’s “Send to {service}” run will skip until you reconnect.
          </div>
        );
      case 'not-connected':
        return (
          <div className="sn-service-status__detail">
            {service === 'Beatport'
              ? 'Connect to check matches and pull genre and label data.'
              : 'Connect to export setlists, match audio tracks, and sync playlists.'}
          </div>
        );
      case 'error':
        return (
          <div className="sn-service-status__detail">
            Connection error. Reconnect to resume sync.
          </div>
        );
      default:
        return null;
    }
  };

  const renderAction = () => {
    if (state === 'connected') {
      return onDisconnect ? (
        <button
          type="button"
          className="sn-btn sn-btn--quiet sn-btn--sm"
          onClick={onDisconnect}
        >
          Disconnect
        </button>
      ) : null;
    }

    const btnClass =
      service === 'Spotify'
        ? 'sn-btn sn-btn--sm sn-service-status__btn--spotify'
        : service === 'TIDAL'
        ? 'sn-btn sn-btn--sm sn-service-status__btn--tidal'
        : 'sn-btn sn-btn--sm';

    const label =
      state === 'expired' || state === 'error'
        ? `Reconnect ${service}`
        : `Connect ${service}`;

    return onConnect ? (
      <button
        type="button"
        className={btnClass}
        onClick={onConnect}
      >
        {label}
      </button>
    ) : null;
  };

  return (
    <section
      className={`sn-service-status ${className}`.trim()}
      aria-label={`${service} connection`}
    >
      <span className="sn-service-status__mark" aria-hidden="true">
        {mark}
      </span>
      <div className="sn-service-status__main">
        <div className="sn-service-status__name">
          {service} {renderStatusPill()}
        </div>
        {renderDetail()}
      </div>
      <div className="sn-service-status__act">
        {renderAction()}
      </div>
    </section>
  );
};
