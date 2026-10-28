import React, { useMemo, useState } from 'react';
import { Music, Layers } from 'lucide-react';
import { useUnifiedTracks } from '../../hooks/useUnifiedTracks';
import { PageHeader } from '../../shell/PageParts';
import { usePageHeader } from '../../shell/AppShell';
import { EmptyPanel } from '../../components/ds';
import { SN, Bpm, KeyBadge, EnergyBar } from '../../lib/songnodes';
import { compatibleKeys } from './camelotLogic';
import { CamelotWheel } from '../../components/CamelotWheel';
import { KeyMoodPanel } from '../../components/KeyMoodPanel';
import { HarmonicSet } from '../../components/HarmonicCompatibility';
import { MoveNext } from './MoveNext';
import './camelot.css';

const CODES: string[] = (['B', 'A'] as const).flatMap((L) => Array.from({ length: 12 }, (_, i) => `${i + 1}${L}`));

const CamelotPage: React.FC = () => {
  usePageHeader({ lead: 'Key & mood', title: 'Camelot wheel', current: 'harmony' });
  const { tracks, isLoading, source } = useUnifiedTracks();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const { counts, tracksWithoutKey } = useMemo(() => {
    const counts: Record<string, number> = {};
    let tracksWithoutKey = 0;

    for (const track of tracks) {
      if (!track.key) {
        tracksWithoutKey++;
      } else {
        counts[track.key] = (counts[track.key] || 0) + 1;
      }
    }

    return { counts, tracksWithoutKey };
  }, [tracks]);

  const displayedTracks = useMemo(() => {
    if (selectedKeys.length === 0) return tracks;

    let keysToShow = [...selectedKeys];

    selectedKeys.forEach(key => {
        const compat = compatibleKeys(key);
        compat.forEach(c => {
            if (!keysToShow.includes(c)) keysToShow.push(c);
        });
    });

    return tracks.filter(t => t.key && keysToShow.includes(t.key));
  }, [tracks, selectedKeys]);

  const handleSelectedChange = (keys: string[]) => {
    setSelectedKeys(keys);
    if (keys.length > 0) {
      const newKey = keys.find(k => !selectedKeys.includes(k));
      if (newKey) setActiveKey(newKey);
    } else {
      setActiveKey(null);
    }
  };

  let wheelKeys = [...selectedKeys];
  selectedKeys.forEach(k => {
      const compat = compatibleKeys(k);
      compat.forEach(c => {
          if (!wheelKeys.includes(c)) wheelKeys.push(c);
      });
  });

  const activeTracksForSet = useMemo(() => {
    if (!activeKey) return [];
    return tracks
      .filter(t => t.key === activeKey)
      .map(t => ({
        id: t.id,
        key: t.key!,
        name: `${t.artist} - ${t.title}`
      }));
  }, [tracks, activeKey]);

  return (
    <main className="sn-page__main" id="main" tabIndex={-1}>
      <PageHeader
        mod="harmony"
        lead="Music"
        title="Camelot wheel"
        desc="Keys, mood and energy across the library."
      />

      <div className="sn-camelot-page__grid" style={{ marginBottom: 'var(--space-6)' }}>
        <section className="sn-card sn-camelot-page__wheel-card">
          <div style={{ position: 'relative' }}>
            <CamelotWheel
              selectedKeys={wheelKeys}
              onKeySelect={handleSelectedChange}
              activeKey={activeKey}
              onActiveKeyChange={setActiveKey}
              size={420}
              showHarmonicSuggestions={true}
            />

            {/* Custom SVG Overlay for sector density */}
            <svg
              style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', overflow: 'visible' }}
              viewBox="0 0 420 420"
              width="100%"
              height="100%"
              aria-hidden="true"
            >
              <g>
                {CODES.map(code => {
                  const count = counts[code] || 0;
                  if (count === 0) return null;

                  // Helper for radial coordinates matches CamelotWheel logic
                  const C = 210;
                  const deg = (parseInt(code, 10) * 30);
                  const a = ((deg - 90) * Math.PI) / 180;
                  const r = code.endsWith('B') ? 220 : 85;
                  // Render outside the main rings slightly for density labels

                  const x = C + r * Math.cos(a);
                  const y = C + r * Math.sin(a);

                  return (
                    <text
                      key={`count-${code}`}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      className="data-s"
                      style={{ fill: 'var(--fg)', textShadow: 'var(--shadow-1)' }}
                    >
                      {SN.format.count(count)}
                    </text>
                  );
                })}
              </g>
            </svg>

            <div className="sn-camelot-page__stats body-s">
              <p>Data source: {source === 'library-fixture' ? 'Music library' : source}</p>
              <p>{SN.format.count(tracksWithoutKey)} tracks without key</p>
            </div>
          </div>
        </section>

        <section className="sn-card">
          <h2 className="title-s" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Layers size={18} />
            {selectedKeys.length > 0
              ? `${SN.format.count(displayedTracks.length)} tracks compatible with selected keys`
              : `${SN.format.count(displayedTracks.length)} tracks total`}
          </h2>

          {/* The table can scroll sideways, so its box takes focus and has a name (axe scrollable-region-focusable). */}
          <section className="sn-tablebox" tabIndex={0} aria-label="Tracks by key">
            <table className="sn-table">
              <thead>
                <tr>
                  <th>Track</th>
                  <th className="sn-num">BPM</th>
                  <th>Key</th>
                  <th>Energy</th>
                </tr>
              </thead>
              <tbody>
                {displayedTracks.map(track => (
                  <tr key={track.id}>
                    <td>
                      <div className="sn-track-cell">
                        <div className="sn-track-cell__title">
                          <span className="sn-track-cell__name"><span className="sn-track-cell__artist">{track.artist} –</span> {track.title}</span>
                        </div>
                        <div className="sn-track-cell__meta">
                          {track.mix ? <span className="sn-track-cell__mix">{track.mix}</span> : null}
                          {track.mix && track.label ? <span className="sn-track-cell__sep" aria-hidden="true">·</span> : null}
                          {track.label ? <span>{track.label}</span> : (!track.mix ? <span className="sn-none">–</span> : null)}
                        </div>
                      </div>
                    </td>
                    <td className="sn-num"><Bpm value={track.bpm} /></td>
                    <td><KeyBadge value={track.key} /></td>
                    <td><EnergyBar value={track.energy} /></td>
                  </tr>
                ))}
                {displayedTracks.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyPanel icon={Music} title="No tracks found" compact>
                        No tracks match the selected keys.
                      </EmptyPanel>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </section>
      </div>

      <MoveNext activeKey={activeKey} counts={counts} onMove={setActiveKey} />

      <section className="sn-card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 className="title-m" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          Acoustic mood and energy profile
        </h2>
        <KeyMoodPanel defaultExpanded={true} />
      </section>

      {activeKey && activeTracksForSet.length > 0 && (
        <section className="sn-card">
          <h2 className="title-m" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Music size={20} style={{ color: 'var(--brand)' }} />
            Tracks in <KeyBadge value={activeKey} withName />
          </h2>
          <HarmonicSet currentKey={activeKey} tracks={activeTracksForSet} />
        </section>
      )}
    </main>
  );
};

export default CamelotPage;
