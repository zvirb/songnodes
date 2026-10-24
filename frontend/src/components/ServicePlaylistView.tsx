/**
 * Shared design-system view for the Plan-mode TIDAL and Spotify tabs.
 * Service colours appear only on the Connect button (design-system rule);
 * everything else is neutral. Data logic stays in the managers.
 */
import React from 'react';
import { Plug, RefreshCw, ListMusic, ExternalLink } from 'lucide-react';
import { SN, StatusPill } from '../lib/songnodes';
import { EmptyPanel } from './ds';
import './ServicePlaylistView.css';

export interface ServicePlaylistRow {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
  /** Seconds, when the service reports it. */
  duration?: number;
  url?: string;
  tags?: string[];
}

interface Props {
  service: 'TIDAL' | 'Spotify';
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setlistName?: string;
  stats?: { total: number; available: number; unavailable: number; checked: boolean };
  playlistName: string;
  playlistDescription: string;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onConnect: () => void;
  onCreateEmpty: () => void;
  onCreateFromSetlist?: () => void;
  onRefresh: () => void;
  playlists: ServicePlaylistRow[];
  /** Extra form fields (e.g. Spotify's public toggle). */
  extraFields?: React.ReactNode;
}

export const ServicePlaylistView: React.FC<Props> = ({
  service, isAuthenticated, isLoading, error, setlistName, stats,
  playlistName, playlistDescription, onNameChange, onDescriptionChange,
  onConnect, onCreateEmpty, onCreateFromSetlist, onRefresh, playlists, extraFields,
}) => {
  const svcClass = service === 'TIDAL' ? 'sn-service-status__btn--tidal' : 'sn-service-status__btn--spotify';
  const idBase = service.toLowerCase();

  if (!isAuthenticated) {
    return (
      <div className="svc">
        <EmptyPanel
          compact
          icon={Plug}
          title={`Connect ${service} to see your playlists`}
          actions={
            <button type="button" className={`sn-btn ${svcClass}`} onClick={onConnect}>
              Connect {service}
            </button>
          }
        >
          {service} connects in Settings. Once connected, you can send a set to {service} as a playlist.
        </EmptyPanel>
      </div>
    );
  }

  return (
    <div className="svc">
      <div className="svc__status">
        <StatusPill raw="ok" label={`${service} connected`} />
      </div>

      {error && (
        <p className="sn-inline-message sn-inline-message--boxed" data-status="bad" role="alert">{error}</p>
      )}

      {setlistName && stats && (
        <section className="svc__card" aria-labelledby={`${idBase}-set`}>
          <h3 className="svc__label" id={`${idBase}-set`}>Current set: {setlistName}</h3>
          {stats.checked ? (
            <div className="sn-progress-bar">
              <div className="sn-progress-bar__head">
                <span className="sn-progress-bar__label" id={`${idBase}-avail`}>On {service}</span>
                <span className="sn-progress-bar__value">{stats.available} of {stats.total}</span>
              </div>
              <div
                className="sn-progress-bar__track"
                role="progressbar"
                aria-labelledby={`${idBase}-avail`}
                aria-valuemin={0}
                aria-valuemax={stats.total}
                aria-valuenow={stats.available}
                aria-valuetext={`${stats.available} of ${stats.total} tracks on ${service}`}
                style={{ ['--p' as string]: `${stats.total ? (stats.available / stats.total) * 100 : 0}%` } as React.CSSProperties}
              >
                <div className="sn-progress-bar__fill" />
              </div>
            </div>
          ) : (
            <p className="svc__meta">{SN.format.count(stats.total)} tracks</p>
          )}
        </section>
      )}

      <section className="svc__card" aria-labelledby={`${idBase}-new`}>
        <h3 className="svc__label" id={`${idBase}-new`}>New playlist</h3>
        <div className="sn-field">
          <label htmlFor={`${idBase}-name`}>Playlist name</label>
          <input id={`${idBase}-name`} className="sn-input" type="text" value={playlistName} onChange={(e) => onNameChange(e.target.value)} placeholder="Peak time Friday" />
        </div>
        <div className="sn-field">
          <label htmlFor={`${idBase}-desc`}>Description (optional)</label>
          <textarea id={`${idBase}-desc`} className="sn-input" rows={2} value={playlistDescription} onChange={(e) => onDescriptionChange(e.target.value)} placeholder="Made with SongNodes" />
        </div>
        {extraFields}
        <div className="svc__actions">
          <button type="button" className="sn-btn sn-btn--sm" onClick={onCreateEmpty} disabled={isLoading || !playlistName.trim()} aria-busy={isLoading || undefined}>
            {isLoading ? <span className="sn-spinner" aria-hidden="true" /> : null}
            {isLoading ? 'Creating…' : 'Create empty playlist'}
          </button>
          {onCreateFromSetlist && (
            <button type="button" className="sn-btn sn-btn--sm" onClick={onCreateFromSetlist} disabled={isLoading} aria-busy={isLoading || undefined}>
              {isLoading ? 'Sending…' : `Send set to ${service}`}
            </button>
          )}
        </div>
      </section>

      <section className="svc__card" aria-labelledby={`${idBase}-lists`}>
        <div className="svc__row">
          <h3 className="svc__label" id={`${idBase}-lists`}>Your {service} playlists</h3>
          <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw size={16} strokeWidth={2} aria-hidden="true" />
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {playlists.length === 0 ? (
          <EmptyPanel compact icon={ListMusic} title="No playlists yet">
            Playlists you make here or in {service} appear in this list.
          </EmptyPanel>
        ) : (
          <ul className="svc__list">
            {playlists.map((p) => (
              <li key={p.id} className="svc__item">
                <div className="svc__item-main">
                  <span className="svc__item-name">{p.name}</span>
                  {p.tags?.map((t) => <span key={t} className="sn-tag">{t}</span>)}
                  <span className="svc__meta">
                    {SN.format.count(p.trackCount)} {p.trackCount === 1 ? 'track' : 'tracks'}
                    {p.duration ? <> · {SN.format.duration(p.duration)}</> : null}
                  </span>
                  {p.description ? <span className="svc__desc">{p.description}</span> : null}
                </div>
                {p.url && (
                  <a className="sn-link sn-link--ext" href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p.name} in ${service}`}>
                    {service}
                    <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
