import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Play, Copy, Check, ExternalLink, ArrowLeft, Radio, Disc, Music, Layers, Share2 } from 'lucide-react';
import { SN, Bpm, KeyBadge, EnergyBar } from '../../lib/songnodes';
import { Button, StatusPill, EmptyPanel, SectionHeading } from '../../components/ds';
import { HarmonicCompatibility } from '../../components/HarmonicCompatibility';
import { useGraphNodes, useGraphEdges } from '../../store/useStore';
import { fetchLibraryTracks } from '../../services/unifiedTrackService';
import type { UnifiedTrack } from '../../types/unifiedTrack';
import { usePageHeader } from '../../shell/AppShell';
import { PageHeader } from '../../shell/PageParts';

function getCompatibleKeys(key: string | null): string[] {
  if (!key) return [];
  const m = key.match(/^(\d{1,2})([AB])$/i);
  if (!m) return [];
  const num = parseInt(m[1], 10);
  const letter = m[2].toUpperCase();
  const otherLetter = letter === 'A' ? 'B' : 'A';
  const prevNum = num === 1 ? 12 : num - 1;
  const nextNum = num === 12 ? 1 : num + 1;
  return [`${prevNum}${letter}`, `${nextNum}${letter}`, `${num}${otherLetter}`];
}

const CopyField: React.FC<{ value?: string | null; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="sn-none">–</span>;

  const handleCopy = () => {
    void navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
      <code className="data">{value}</code>
      <button
        type="button"
        className="sn-btn sn-btn--quiet sn-btn--icon sn-btn--sm"
        aria-label={`Copy ${label} ${value}`}
        onClick={handleCopy}
        title={copied ? 'Copied' : `Copy ${label}`}
      >
        {copied ? <Check size={14} color="var(--status-ok)" /> : <Copy size={14} />}
      </button>
    </div>
  );
};

export const TrackDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const graphNodes = useGraphNodes();
  const graphEdges = useGraphEdges();

  const [libraryTrack, setLibraryTrack] = useState<UnifiedTrack | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Look up track in library or graph
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchLibraryTracks()
      .then((data) => {
        if (cancelled) return;
        const found = data.tracks.find((t) => t.id === id);
        if (found) {
          setLibraryTrack(found);
        }
      })
      .catch((err) => {
        console.error('Failed to load library:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const graphNode = useMemo(() => {
    if (!id) return null;
    return graphNodes.find((n) => n.id === id || n.track?.id === id) ?? null;
  }, [graphNodes, id]);

  const artist = libraryTrack?.artist || graphNode?.track?.artist || graphNode?.artist || '–';
  const title = libraryTrack?.title || graphNode?.track?.name || graphNode?.title || graphNode?.label || '–';
  const bpm = libraryTrack?.bpm ?? graphNode?.track?.bpm ?? graphNode?.bpm ?? null;
  const rawKey = libraryTrack?.key ?? graphNode?.track?.key ?? graphNode?.key ?? null;
  const key = rawKey ? (SN.camelot ? SN.camelot(rawKey) : rawKey) : null;
  const energy = libraryTrack?.energy ?? graphNode?.track?.energy ?? null;
  const durationSec = libraryTrack?.durationSec ?? graphNode?.track?.duration ?? null;
  const genre = libraryTrack?.genre ?? graphNode?.track?.genre ?? null;
  const label = libraryTrack?.label ?? null;
  const source = libraryTrack?.source || (graphNode ? 'Graph' : 'Library');
  const tidalUrl = libraryTrack?.tidalUrl || null;

  usePageHeader({ lead: 'Track', title: `${artist} – ${title}`, current: 'library' });

  // Connected edges / transitions
  const connectedEdges = useMemo(() => {
    if (!id) return [];
    return graphEdges.filter((e) => e.source === id || e.target === id);
  }, [graphEdges, id]);

  const transitions = useMemo(() => {
    return connectedEdges.map((e, idx) => {
      const neighborId = e.source === id ? e.target : e.source;
      const neighbor = graphNodes.find((n) => n.id === neighborId);
      return {
        id: e.id || `edge-${idx}`,
        neighborId,
        artist: neighbor?.track?.artist || neighbor?.artist || '–',
        name: neighbor?.track?.name || neighbor?.title || neighbor?.label || '–',
        key: neighbor?.track?.key || neighbor?.key || null,
        bpm: neighbor?.track?.bpm || neighbor?.bpm || null,
        energy: neighbor?.track?.energy || null,
        type: e.type || 'Proven transition',
        weight: e.weight || 1,
      };
    });
  }, [connectedEdges, graphNodes, id]);

  const compatibleKeys = useMemo(() => getCompatibleKeys(key), [key]);

  if (isLoading && !libraryTrack && !graphNode) {
    return (
      <main className="sn-page__main sn-page-track" id="main" tabIndex={-1}>
        <div className="sn-page__section">
          <PageHeader mod="library" lead="Track" title="Loading track…" />
          <div className="sn-skel" style={{ height: '120px', borderRadius: 'var(--radius-card)', marginTop: 'var(--space-4)' }} />
        </div>
      </main>
    );
  }

  if (!libraryTrack && !graphNode) {
    return (
      <main className="sn-page__main sn-page-track" id="main" tabIndex={-1}>
        <div className="sn-page__section">
          <PageHeader mod="library" lead="Track" title="Track not found" />
          <div style={{ marginTop: 'var(--space-6)' }}>
            <EmptyPanel icon={Disc} title="Track not found in library">
              No track matching ID <code>{id}</code> was found in the library or current graph session.
              <span style={{ display: 'block', marginTop: 'var(--space-4)' }}>
                <Link to="/library" className="sn-btn sn-btn--primary">
                  Return to Library
                </Link>
              </span>
            </EmptyPanel>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="sn-page__main sn-page-track" id="main" tabIndex={-1}>
      <div className="sn-page__section">
        {/* Trail / Breadcrumbs */}
        <nav className="sn-breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: 'var(--space-2)' }}>
          <ol className="sn-breadcrumbs__list" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', listStyle: 'none', padding: 0, margin: 0, fontSize: '0.875rem' }}>
            <li>
              <Link to="/library" className="sn-link sn-m-library" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <ArrowLeft size={14} />
                <span>Library</span>
              </Link>
            </li>
            <li className="sn-dim">/</li>
            <li><span>{artist}</span></li>
            <li className="sn-dim">/</li>
            <li aria-current="page"><span className="body-strong">{title}</span></li>
          </ol>
        </nav>

        {/* Header */}
        <PageHeader
          mod="library"
          lead="Track"
          title={`${artist} – ${title}`}
          actions={
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Link to={`/graph?select=${id}`} className="sn-btn sn-btn--quiet sn-btn--sm">
                Open in graph
              </Link>
              <Button
                kind="primary"
                size="sm"
                onClick={() => {
                  navigate(`/sets?add=${id}`);
                }}
              >
                Add to set
              </Button>
            </div>
          }
        />

        {/* Identity card row */}
        <div
          className="sn-card sn-page-track__identity"
          role="group"
          aria-label="Key, tempo, energy and length"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 'var(--space-4)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            margin: 'var(--space-4) 0 var(--space-6)',
          }}
        >
          {/* Key */}
          <div>
            <span className="label caption" style={{ color: 'var(--fg-3)', display: 'block', marginBottom: 'var(--space-1)' }}>
              Musical key
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {key ? <KeyBadge value={key} /> : <span className="sn-none">–</span>}
              <span className="body-strong">{key && SN.keyName(key) ? SN.keyName(key) : '–'}</span>
            </div>
          </div>

          {/* BPM */}
          <div>
            <span className="label caption" style={{ color: 'var(--fg-3)', display: 'block', marginBottom: 'var(--space-1)' }}>
              Tempo
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {bpm ? <Bpm value={bpm} /> : <span className="sn-none">–</span>}
            </div>
          </div>

          {/* Energy */}
          <div>
            <span className="label caption" style={{ color: 'var(--fg-3)', display: 'block', marginBottom: 'var(--space-1)' }}>
              Energy tier
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {energy !== null ? (
                <>
                  <EnergyBar value={energy} />
                  <span className="body-strong">{energy} / 10</span>
                </>
              ) : (
                <span className="sn-none">–</span>
              )}
            </div>
          </div>

          {/* Duration */}
          <div>
            <span className="label caption" style={{ color: 'var(--fg-3)', display: 'block', marginBottom: 'var(--space-1)' }}>
              Length
            </span>
            <span className="data body-strong">
              {durationSec ? SN.format.duration(durationSec) : <span className="sn-none">–</span>}
            </span>
          </div>

          {/* Source */}
          <div>
            <span className="label caption" style={{ color: 'var(--fg-3)', display: 'block', marginBottom: 'var(--space-1)' }}>
              Source
            </span>
            <StatusPill raw="info" label={source} />
          </div>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div
        className="sn-page__cols"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Transitions, Heard on, Raw data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Transitions / Connected tracks */}
          <section className="sn-card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <SectionHeading
                title="Plays well with: Connected tracks"
                count={`${transitions.length} ${transitions.length === 1 ? 'connection' : 'connections'}`}
              />
              <Link to={`/graph?select=${id}`} className="sn-link sn-m-graph" style={{ fontSize: '0.875rem' }}>
                Open in the graph
              </Link>
            </div>

            {transitions.length > 0 ? (
              <div className="sn-tablebox">
                <table className="sn-table">
                  <caption className="sn-sr">Tracks connected to {artist} – {title}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Connected track</th>
                      <th scope="col">Relation</th>
                      <th scope="col" className="num">Weight</th>
                      <th scope="col">Key</th>
                      <th scope="col" className="num">BPM</th>
                      <th scope="col">Energy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transitions.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <div className="sn-track-cell">
                            <span className="sn-track-cell__title">
                              <Link to={`/tracks/${t.neighborId}`} className="sn-track-cell__name" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
                                <span className="sn-track-cell__artist">{t.artist} –</span> {t.name}
                              </Link>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="sn-tag">{t.type}</span>
                        </td>
                        <td className="num data">{t.weight.toFixed(1)}</td>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                            {t.key ? <KeyBadge value={t.key} /> : <span className="sn-none">–</span>}
                            {key && t.key && <HarmonicCompatibility currentKey={key} targetKey={t.key} />}
                          </div>
                        </td>
                        <td className="num data">{t.bpm ? Math.round(t.bpm) : <span className="sn-none">–</span>}</td>
                        <td>
                          {t.energy !== null ? <EnergyBar value={t.energy} /> : <span className="sn-none">–</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyPanel compact icon={Music} title="No proven connections yet">
                No recorded DJ transitions link this track to another in the library. Import a tracklist containing this track to build edges.
              </EmptyPanel>
            )}
          </section>

          {/* Heard on / Sources */}
          <section className="sn-card" style={{ padding: 'var(--space-4)' }}>
            <SectionHeading title="Heard on" count={source} />
            <div className="sn-tablebox" style={{ marginTop: 'var(--space-3)' }}>
              <table className="sn-table">
                <caption className="sn-sr">Sources and plays for {artist} – {title}</caption>
                <thead>
                  <tr>
                    <th scope="col">Source</th>
                    <th scope="col">Feed / Origin</th>
                    <th scope="col" className="num">Rotation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className="body-strong">{source}</span>
                    </td>
                    <td>{libraryTrack ? 'Melbourne DJ Library ledger' : 'Scraped tracklist network'}</td>
                    <td className="num data">
                      <StatusPill raw="ok" label="Active" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Raw data disclosure */}
          <details className="sn-disclosure sn-disclosure--boxed">
            <summary>
              <h2 className="sn-title title-s" style={{ margin: 0, display: 'inline' }}>Raw stored data</h2>
              <span className="sn-disclosure__hint">Metadata attributes as ingested</span>
            </summary>
            <div className="sn-disclosure__body" style={{ marginTop: 'var(--space-3)' }}>
              <dl className="sn-key-value-grid" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: 'var(--space-2) var(--space-4)' }}>
                <dt style={{ color: 'var(--fg-3)' }}>Track ID</dt>
                <dd><CopyField value={id} label="Track ID" /></dd>
                <dt style={{ color: 'var(--fg-3)' }}>Artist</dt>
                <dd>{artist}</dd>
                <dt style={{ color: 'var(--fg-3)' }}>Title</dt>
                <dd>{title}</dd>
                <dt style={{ color: 'var(--fg-3)' }}>Genre</dt>
                <dd>{genre || <span className="sn-none">–</span>}</dd>
                <dt style={{ color: 'var(--fg-3)' }}>Record label</dt>
                <dd>{label || <span className="sn-none">–</span>}</dd>
                <dt style={{ color: 'var(--fg-3)' }}>TIDAL URL</dt>
                <dd>
                  {tidalUrl ? (
                    <a href={tidalUrl} target="_blank" rel="noopener noreferrer" className="sn-link sn-link--ext">
                      {tidalUrl}
                    </a>
                  ) : (
                    <span className="sn-none">–</span>
                  )}
                </dd>
              </dl>
            </div>
          </details>
        </div>

        {/* Right Column / Aside */}
        <aside className="sn-page-track__aside" aria-label="Key, identifiers and links" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Key harmony card */}
          <section className="sn-card sn-m-harmony" style={{ padding: 'var(--space-4)' }}>
            <h2 className="sn-title title-s" style={{ marginBottom: 'var(--space-2)' }}>
              <span className="sn-lead">Key:</span> {key || '–'}{key && SN.keyName(key) ? `, ${SN.keyName(key)}` : ''}
            </h2>
            <div style={{ marginTop: 'var(--space-3)' }}>
              <span className="label caption" style={{ color: 'var(--fg-3)', display: 'block', marginBottom: 'var(--space-1)' }}>
                Compatible keys:
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {compatibleKeys.length > 0 ? (
                  compatibleKeys.map((ck) => (
                    <div key={ck} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      <KeyBadge value={ck} />
                      <span className="caption">{SN.keyName(ck) || ck}</span>
                    </div>
                  ))
                ) : (
                  <span className="sn-none">–</span>
                )}
              </div>
            </div>
          </section>

          {/* Identifiers card */}
          <section className="sn-card" style={{ padding: 'var(--space-4)' }}>
            <h2 className="sn-title title-s" style={{ marginBottom: 'var(--space-3)' }}>
              Identifiers
            </h2>
            <dl className="sn-key-value-grid" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: 'var(--space-2) var(--space-3)', margin: 0 }}>
              <dt style={{ color: 'var(--fg-3)' }}>ISRC</dt>
              <dd><CopyField value={null} label="ISRC" /></dd>
              <dt style={{ color: 'var(--fg-3)' }}>SongNodes ID</dt>
              <dd><CopyField value={id} label="ID" /></dd>
              <dt style={{ color: 'var(--fg-3)' }}>TIDAL ID</dt>
              <dd><CopyField value={tidalUrl ? tidalUrl.split('/').pop() : null} label="TIDAL ID" /></dd>
              <dt style={{ color: 'var(--fg-3)' }}>Beatport ID</dt>
              <dd><span className="sn-none">–</span></dd>
            </dl>
          </section>

          {/* Listen and buy */}
          <section className="sn-card" style={{ padding: 'var(--space-4)' }}>
            <h2 className="sn-title title-s" style={{ marginBottom: 'var(--space-3)' }}>
              Listen and buy
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {tidalUrl ? (
                <a href={tidalUrl} target="_blank" rel="noopener noreferrer" className="sn-link sn-link--ext" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <span>Open on TIDAL</span>
                  <ExternalLink size={14} />
                </a>
              ) : (
                <a
                  href={`https://listen.tidal.com/search?q=${encodeURIComponent(`${artist} ${title}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sn-link sn-link--ext"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
                >
                  <span>Search on TIDAL</span>
                  <ExternalLink size={14} />
                </a>
              )}
              <a
                href={`https://www.beatport.com/search?q=${encodeURIComponent(`${artist} ${title}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="sn-link sn-link--ext"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
              >
                <span>Search on Beatport</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
};

export default TrackDetailPage;
