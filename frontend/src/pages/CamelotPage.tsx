import React, { useState, useMemo, useCallback } from 'react';
import { Disc3, Activity, Music, Sparkles, Layers, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { CamelotWheel } from '../components/CamelotWheel';
import { KeyMoodPanel } from '../components/KeyMoodPanel';
import { HarmonicCompatibility, HarmonicSet } from '../components/HarmonicCompatibility';
import { KeyBadge, SN, Title } from '../lib/songnodes';
import { KeyCompat } from '../components/ds';
import { getModulationTargets, getTrackKey, getTracksByKey } from '../utils/camelotUtils';
import { CAMELOT_KEYS } from '../utils/camelotData';
import { GraphNode } from '../types';
import { usePageHeader } from '../shell/AppShell';

export const CamelotPage: React.FC = () => {
  usePageHeader({ lead: 'Key & mood', title: 'Harmonic Modulation Explorer', current: 'harmony' });
  const [activeKey, setActiveKey] = useState<string>('8A');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Library/Graph Store access
  const graphData = useStore((state) => state.graphData);
  const selectNode = useStore((state) => state.graph.selectNode);

  // Group nodes by Camelot key
  const tracksByKey = useMemo(() => getTracksByKey(graphData.nodes || []), [graphData.nodes]);
  const totalTracks = graphData.nodes?.length || 0;

  // Key stats
  const activeKeyTracks = useMemo(() => tracksByKey[activeKey] || [], [tracksByKey, activeKey]);
  const keyInfo = useMemo(() => CAMELOT_KEYS.find((k) => k.id === activeKey), [activeKey]);
  const modInfo = useMemo(() => getModulationTargets(activeKey), [activeKey]);

  // Handle active key selection from wheel or cards
  const handleKeySelect = useCallback((keys: string[]) => {
    setSelectedKeys(keys);
    if (keys.length > 0) {
      const matchingNodes = keys.flatMap((k) => tracksByKey[k] || []);
      matchingNodes.forEach((node) => selectNode(node.id));
    }
  }, [tracksByKey, selectNode]);

  const handleActiveKeyChange = useCallback((key: string) => {
    setActiveKey(key);
  }, []);

  // Format tracks for HarmonicSet
  const activeTracksForSet = useMemo(() => {
    return activeKeyTracks.map((node: GraphNode) => ({
      id: node.id,
      key: getTrackKey(node) || activeKey,
      name: node.label || node.name || node.title || 'Untitled Track',
    }));
  }, [activeKeyTracks, activeKey]);

  return (
    <main
      className="camelot-explorer-page"
      id="main"
      tabIndex={-1}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        padding: 'var(--space-6)',
        maxWidth: 'var(--content-max)',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          borderBottom: '1px solid var(--line)',
          paddingBottom: 'var(--space-4)',
        }}
      >
        <div>
          <Title lead="Camelot" size="display-xl" as="h1">
            Harmonic Modulation Explorer
          </Title>
          <p className="body-l" style={{ margin: 'var(--space-2) 0 0', color: 'var(--fg-2)' }}>
            Interactive 12-hue Camelot wheel and harmonic transition analyzer for seamless set mixing.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            background: 'var(--surface-2)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--line)',
          }}
        >
          <div>
            <span className="caption" style={{ color: 'var(--fg-3)', display: 'block' }}>Active Key</span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--fg)' }}>
              <KeyBadge value={activeKey} withName />
            </span>
          </div>
          <div style={{ width: '1px', height: '32px', background: 'var(--line)' }} />
          <div>
            <span className="caption" style={{ color: 'var(--fg-3)', display: 'block' }}>Library Tracks</span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--fg)' }}>
              {SN.format.count(activeKeyTracks.length)} / {SN.format.count(totalTracks)}
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Interactive Camelot Wheel */}
        <section
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="title-m" style={{ margin: 0, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Disc3 size={20} style={{ color: 'var(--brand)' }} />
              Camelot Wheel
            </h2>
            <span className="data-s" style={{ color: 'var(--fg-3)' }}>12-Hue Palette</span>
          </div>

          <CamelotWheel
            size={380}
            activeKey={activeKey}
            selectedKeys={selectedKeys}
            showHarmonicSuggestions={true}
            onKeySelect={handleKeySelect}
            onActiveKeyChange={handleActiveKeyChange}
          />

          <div
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-2)',
              fontSize: '0.75rem',
              color: 'var(--fg-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--fg)', border: '1px solid var(--line)' }} />
              <span>Solid Ring: Active Key</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px dashed var(--brand)' }} />
              <span>Dashed: Relative Swap</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--status-ok)' }} />
              <span>Green: Adjacent (+1/-1)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--status-warn)' }} />
              <span>Amber: Energy Boost (+2/+7)</span>
            </div>
          </div>
        </section>

        {/* Right Column: Modulation Targets & Mood Profiles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Active Key Profile & Modulation Matrix */}
          <section
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="title-m" style={{ margin: 0, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Sparkles size={20} style={{ color: 'var(--brand)' }} />
                Harmonic Modulations
              </h2>
              <span style={{ fontFamily: 'var(--font-data)', fontWeight: 600, color: 'var(--brand-strong)' }}>
                From {activeKey}
              </span>
            </div>

            {keyInfo && (
              <div
                style={{
                  background: 'var(--surface-2)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-control)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span className="caption" style={{ color: 'var(--fg-3)' }}>Acoustic Mood</span>
                  <p className="body-strong" style={{ margin: 0, color: 'var(--fg)' }}>{keyInfo.mood}</p>
                </div>
                <div>
                  <span className="caption" style={{ color: 'var(--fg-3)' }}>Base Energy</span>
                  <p className="data-strong" style={{ margin: 0, color: 'var(--fg)' }}>{keyInfo.energy} / 10</p>
                </div>
              </div>
            )}

            {/* Modulation Cards */}
            {modInfo && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                {/* Exact Match */}
                <button
                  type="button"
                  onClick={() => setActiveKey(modInfo.exactMatch)}
                  style={{
                    textAlign: 'left',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-control)',
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                  }}
                >
                  <span className="caption" style={{ color: 'var(--fg-3)', display: 'block' }}>Exact Match</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                    <KeyBadge value={modInfo.exactMatch} withName />
                    <KeyCompat from={activeKey} to={modInfo.exactMatch} />
                  </div>
                </button>

                {/* Relative Major / Minor */}
                <button
                  type="button"
                  onClick={() => setActiveKey(modInfo.relative)}
                  style={{
                    textAlign: 'left',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-control)',
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                  }}
                >
                  <span className="caption" style={{ color: 'var(--fg-3)', display: 'block' }}>Relative Modulation (A ↔ B)</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                    <KeyBadge value={modInfo.relative} withName />
                    <KeyCompat from={activeKey} to={modInfo.relative} />
                  </div>
                </button>

                {/* Adjacent Step +1 */}
                <button
                  type="button"
                  onClick={() => setActiveKey(modInfo.adjacentPlus1)}
                  style={{
                    textAlign: 'left',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-control)',
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                  }}
                >
                  <span className="caption" style={{ color: 'var(--fg-3)', display: 'block' }}>Adjacent (+1 Step)</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                    <KeyBadge value={modInfo.adjacentPlus1} withName />
                    <KeyCompat from={activeKey} to={modInfo.adjacentPlus1} />
                  </div>
                </button>

                {/* Adjacent Step -1 */}
                <button
                  type="button"
                  onClick={() => setActiveKey(modInfo.adjacentMinus1)}
                  style={{
                    textAlign: 'left',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-control)',
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                  }}
                >
                  <span className="caption" style={{ color: 'var(--fg-3)', display: 'block' }}>Adjacent (-1 Step)</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                    <KeyBadge value={modInfo.adjacentMinus1} withName />
                    <KeyCompat from={activeKey} to={modInfo.adjacentMinus1} />
                  </div>
                </button>

                {/* Energy Boost +2 */}
                <button
                  type="button"
                  onClick={() => setActiveKey(modInfo.energyBoostPlus2)}
                  style={{
                    textAlign: 'left',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-control)',
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                  }}
                >
                  <span className="caption" style={{ color: 'var(--fg-3)', display: 'block' }}>Energy Boost (+2 Steps)</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                    <KeyBadge value={modInfo.energyBoostPlus2} withName />
                    <HarmonicCompatibility currentKey={activeKey} targetKey={modInfo.energyBoostPlus2} />
                  </div>
                </button>

                {/* Energy Lift +7 */}
                <button
                  type="button"
                  onClick={() => setActiveKey(modInfo.energyBoostPlus7)}
                  style={{
                    textAlign: 'left',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-control)',
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                  }}
                >
                  <span className="caption" style={{ color: 'var(--fg-3)', display: 'block' }}>Harmonic Lift (+7 Semitones)</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                    <KeyBadge value={modInfo.energyBoostPlus7} withName />
                    <HarmonicCompatibility currentKey={activeKey} targetKey={modInfo.energyBoostPlus7} />
                  </div>
                </button>
              </div>
            )}
          </section>

          {/* Key Distribution Buckets */}
          <section
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <h2 className="title-m" style={{ margin: 0, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Layers size={20} style={{ color: 'var(--brand)' }} />
              Library Key Bucket Distribution
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 'var(--space-2)' }}>
              {CAMELOT_KEYS.map((k) => {
                const count = tracksByKey[k.id]?.length || 0;
                const isActive = activeKey === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setActiveKey(k.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: 'var(--space-2)',
                      background: isActive ? 'var(--brand-soft)' : 'var(--surface-2)',
                      border: `1px solid ${isActive ? 'var(--brand)' : 'var(--line)'}`,
                      borderRadius: 'var(--radius-control)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: '0.875rem', color: 'var(--fg)' }}>
                      {k.id}
                    </span>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.75rem', color: 'var(--fg-2)' }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Key Mood Panel Integration */}
      <section
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-6)',
        }}
      >
        <h2 className="title-m" style={{ marginBottom: 'var(--space-4)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Activity size={20} style={{ color: 'var(--brand)' }} />
          Acoustic Mood & Energy Profile
        </h2>
        <KeyMoodPanel defaultExpanded={true} />
      </section>

      {/* Tracks in Active Key */}
      {activeTracksForSet.length > 0 && (
        <section
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-6)',
          }}
        >
          <h2 className="title-m" style={{ marginBottom: 'var(--space-4)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
