/* eslint-disable jsx-a11y/prefer-tag-over-role */
/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/click-events-have-key-events */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unnecessary-type-assertion */
import React, { useState, useId, useEffect } from 'react';
import { Route, Search, ServerCrash, X } from 'lucide-react';
import { Title, Bpm, KeyBadge, EnergyBar, SN } from '../../lib/songnodes';
import { CompatibilityBadge, ErrorPanel, LoadingPanel } from '../../components/ds';
import { EmptyState } from '../../shell/PageParts';
import { usePageHeader } from '../../shell/AppShell';
import { Link } from 'react-router-dom';
import { usePathfinder } from '../../components/PathfinderPanel/hooks';
import { useUnifiedTracks } from '../../hooks/useUnifiedTracks';
import { UnifiedTrack } from '../../types/unifiedTrack';
import '../../components/PathfinderPanel.css';

export default function PathfinderPage({ onAddToSet }: { onAddToSet?: (trackIds: string[]) => void }) {
  const { tracks, source, isLoading, error } = useUnifiedTracks();
  usePageHeader({ lead: 'Pathfinder', title: 'Route finder', current: 'paths' });
  const pf = usePathfinder();
  const { send } = pf;
  const uid = useId().replace(/:/g, '');

  // Use local state for queries and max hops as they are specific to this page
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [maxHops, setMaxHops] = useState(3);

  const tracksWithoutKey = tracks.filter(t => !t.key);
  const routeableTracks = tracks.filter(t => !!t.key);

  // Sync maxHops with the state machine constraints whenever it changes
  useEffect(() => {
    send({
      type: 'UPDATE_CONSTRAINTS',
      constraints: {
         targetDuration: maxHops * 5 // approximate mapping
      }
    });
  }, [maxHops, send]);

  // Basic filtering for track pickers
  const getFilteredTracks = (query: string) => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return routeableTracks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q)
    ).slice(0, 5); // Limit results
  };

  const startResults = getFilteredTracks(startQuery);
  const endResults = getFilteredTracks(endQuery);

  const handleCalculate = () => {
    pf.send({ type: 'CALCULATE_PATH' });
  };

  const handleTrackSelect = (track: UnifiedTrack, type: 'start' | 'end') => {
    // We need to find the equivalent Track object from pf.availableTracks
    const fullTrack = pf.availableTracks.find(t => t.id === track.id);
    if (fullTrack) {
       // Ensure name property exists to satisfy TS Track requirement if it's missing on GraphNode
       const trackToUse = { ...fullTrack, name: fullTrack.name || (fullTrack as any).title || 'Unknown' };
       if (type === 'start') {
          pf.send({ type: 'SET_START_TRACK', track: trackToUse as any });
          setStartQuery('');
       } else {
          pf.send({ type: 'SET_END_TRACK', track: trackToUse as any });
          setEndQuery('');
       }
    }
  };

  return (
    <main className="sn-page__main sn-page pf-page" id="main" tabIndex={-1}>
      <div className="sn-page__head">
        <Title size="display-xl" as="h1">Pathfinder</Title>
        <p className="sn-lead">Find harmonic paths between tracks</p>
        <p>
          <Link className="sn-link sn-m-graph" to="/graph?tab=pathfinder">Open Pathfinder in Graph</Link>
        </p>
      </div>

      <div className="sn-page__body pf">

        {error && (
          <ErrorPanel title="Cannot load tracks" icon={ServerCrash}>
            {error}
          </ErrorPanel>
        )}

        {!error && !isLoading && tracks.length === 0 && (
          <EmptyState title="No tracks found" icon="route">
            There are no tracks to build a path from. Try adding tracks to the library.
          </EmptyState>
        )}

        {!error && tracks.length > 0 && (
          <div className="sn-inline-message" data-status={source === 'backend' ? 'ok' : 'warn'}>
            <span className="sn-inline-message__text">
              Using data from: {source === 'backend' ? 'Backend' : 'Library fixture'}.
              {tracksWithoutKey.length > 0 && ` ${SN.format.count(tracksWithoutKey.length)} tracks excluded due to missing keys.`}
            </span>
          </div>
        )}

        <div className="pf__facts">
          {/* Start Track Picker */}
          <div className="sn-field">
            <label htmlFor={`${uid}-start`}>Start track</label>

            {pf.state.startTrack ? (
              <div className="pf__selected">
                <strong className="pf__selected-name body-s">{pf.state.startTrack.artist} – {pf.state.startTrack.name || (pf.state.startTrack as any).title}</strong>
                <button type="button" className="sn-btn sn-btn--icon sn-btn--quiet" onClick={() => pf.send({ type: 'SET_START_TRACK', track: null as any })}>
                  <X size={16} aria-label="Clear start track" />
                </button>
              </div>
            ) : (
              <div className="sn-input-wrap" style={{ position: 'relative' }}>
                <Search className="sn-input-icon" size={16} aria-hidden="true" />
                <input
                  id={`${uid}-start`}
                  className="sn-input"
                  type="text"
                  placeholder="Search tracks…"
                  value={startQuery}
                  onChange={e => setStartQuery(e.target.value)}
                />

                {startQuery && startResults.length > 0 && (
                  <ul className="sn-dropdown" role="listbox">
                    {startResults.map(t => (
                      <li key={t.id} role="option" aria-selected="false" tabIndex={0} onClick={() => handleTrackSelect(t, 'start')}>
                        <span className="sn-track-cell__name">{t.artist} – {t.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* End Track Picker */}
          <div className="sn-field">
            <label htmlFor={`${uid}-end`}>End track (optional)</label>

            {pf.state.endTrack ? (
              <div className="pf__selected">
                <strong className="pf__selected-name body-s">{pf.state.endTrack.artist} – {pf.state.endTrack.name || (pf.state.endTrack as any).title}</strong>
                <button type="button" className="sn-btn sn-btn--icon sn-btn--quiet" onClick={() => pf.send({ type: 'SET_END_TRACK', track: null as any })}>
                  <X size={16} aria-label="Clear end track" />
                </button>
              </div>
            ) : (
              <div className="sn-input-wrap" style={{ position: 'relative' }}>
                <Search className="sn-input-icon" size={16} aria-hidden="true" />
                <input
                  id={`${uid}-end`}
                  className="sn-input"
                  type="text"
                  placeholder="Search tracks…"
                  value={endQuery}
                  onChange={e => setEndQuery(e.target.value)}
                />

                {endQuery && endResults.length > 0 && (
                  <ul className="sn-dropdown" role="listbox">
                    {endResults.map(t => (
                      <li key={t.id} role="option" aria-selected="false" tabIndex={0} onClick={() => handleTrackSelect(t, 'end')}>
                        <span className="sn-track-cell__name">{t.artist} – {t.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="sn-field">
            <label htmlFor={`${uid}-hops`}>Max hops: <span className="pf__value">{maxHops}</span></label>
            <input id={`${uid}-hops`} type="range" min="1" max="5" value={maxHops} onChange={e => setMaxHops(parseInt(e.target.value))} />
            <div className="pf__range caption">
              <span>1</span>
              <span>5</span>
            </div>
        </div>

        <div>
          <button type="button" className="sn-btn sn-btn--primary" onClick={handleCalculate} disabled={pf.isCalculating || !pf.state.startTrack}>
              {pf.isCalculating ? 'Calculating…' : 'Find path'}
          </button>
        </div>

        {/* Results section */}
        <div className="pf__result">
           {pf.hasError && (
             <ErrorPanel title="Pathfinding failed" icon={ServerCrash}>
                {pf.state.error}
             </ErrorPanel>
           )}
           {pf.isCalculating && <LoadingPanel message="Finding optimal route…" />}

           {!pf.isCalculating && !pf.hasError && !pf.hasResult && (
             <EmptyState title="Ready to find a path" icon="route">
                Select a start track to begin finding a route.
             </EmptyState>
           )}

           {pf.hasResult && pf.state.result && (
              <section>
                  <div className="pf__selected">
                    <Title size="title-m" as="h2">Found path</Title>
                    {onAddToSet && (
                      <button type="button" className="sn-btn sn-btn--sm" onClick={() => onAddToSet(pf.state.result!.path.map(s => s.track.id))}>
                         Add to set
                      </button>
                    )}
                  </div>

                  <dl className="pf__facts">
                    <div>
                      <dt className="caption">Total length</dt>
                      <dd className="data-strong">{SN.format.duration(pf.state.result.total_duration_ms / 1000)}</dd>
                    </div>
                    <div>
                      <dt className="caption">Tracks</dt>
                      <dd className="data-strong">{pf.state.result.path.length}</dd>
                    </div>
                  </dl>

                  <ol className="pf__path">
                    {pf.state.result.path.map((segment, index) => {
                       const prevSegment = index > 0 ? pf.state.result!.path[index - 1] : null;

                       // Calculate shift if we have a previous segment
                       let bpmShift = 0;
                       let energyChange = 0;
                       let transitionType = 'direct';

                       if (prevSegment) {
                         if (segment.track.bpm && prevSegment.track.bpm) {
                           bpmShift = segment.track.bpm - prevSegment.track.bpm;
                         }
                         if (segment.track.energy && prevSegment.track.energy) {
                           energyChange = segment.track.energy - prevSegment.track.energy;
                         }
                         if (segment.is_synthetic_edge) transitionType = 'synthetic';
                       }

                       return (
                         <li key={index} className="pf__step">
                            <strong className="pf__num data-s" aria-hidden="true">{index + 1}</strong>
                            <div className="sn-track-cell pf__step-main">
                               <span className="sn-track-cell__title">
                                 <span className="sn-track-cell__name">
                                   <span className="sn-track-cell__artist">{segment.track.artist} –</span> {segment.track.name || (segment.track as any).title}
                                 </span>
                               </span>

                               <div className="sn-track-cell__meta">
                                  <KeyBadge value={segment.track.camelot_key || (segment.track as any).camelotKey} />
                                  <Bpm value={segment.track.bpm} />
                                  <EnergyBar value={segment.track.energy} />

                                  {index > 0 && (
                                    <>
                                      <span className="sn-track-cell__sep" aria-hidden="true">·</span>
                                      <span>
                                         {transitionType === 'synthetic' ? 'Key link' : 'Sequential'}
                                      </span>
                                      <span className="sn-track-cell__sep" aria-hidden="true">·</span>
                                      <span>
                                         {bpmShift !== 0 && SN.bpmStep(prevSegment.track.bpm!, segment.track.bpm!).label}
                                         {bpmShift !== 0 && energyChange !== 0 && ', '}
                                         {energyChange !== 0 && SN.energyStep(prevSegment.track.energy!, segment.track.energy!).label}
                                      </span>

                                      <span className="sn-track-cell__sep" aria-hidden="true">·</span>
                                      <CompatibilityBadge
                                        level={segment.key_compatible ? 'compatible' : 'clash'}
                                        label={segment.key_compatible ? 'Key fits' : 'Key clash'}
                                        outline
                                      />
                                    </>
                                  )}
                               </div>
                            </div>
                         </li>
                       );
                    })}
                  </ol>
              </section>
           )}
        </div>
      </div>
    </main>
  );
}
