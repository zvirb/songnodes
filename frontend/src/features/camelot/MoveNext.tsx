import React from 'react';
import { EmptyPanel, SectionHeading, KeyCompat } from '../../components/ds';
import { KeyBadge, SN } from '../../lib/songnodes';
import { Music } from 'lucide-react';
import { moveTargets } from './camelotLogic';
import './camelot.css';

interface MoveNextProps {
  activeKey: string | null;
  counts: Record<string, number>;
  onMove: (key: string) => void;
}

export const MoveNext: React.FC<MoveNextProps> = ({ activeKey, counts, onMove }) => {
  if (!activeKey) {
    return (
      <EmptyPanel icon={Music} title="No key selected" compact>
        Pick a key on the wheel to see where you can move next.
      </EmptyPanel>
    );
  }

  const moves = moveTargets(activeKey);

  return (
    <section className="sn-camelot-page__moves" style={{ marginBottom: 'var(--space-6)' }}>
      <SectionHeading title="Where can I move next" size="title-m" style={{ marginBottom: 'var(--space-4)' }} />
      <div className="sn-camelot-page__moves-grid">
        {moves.map(move => {
          const count = counts[move.key] || 0;
          return (
            <button
              key={move.id}
              className="sn-card sn-card--list sn-card--compact sn-camelot-page__move-btn"
              onClick={() => onMove(move.key)}
              aria-label={`Move to ${SN.keyName ? SN.keyName(move.key) : move.key}`}
            >
              <div className="sn-camelot-page__move-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span className="body-m" style={{ fontWeight: 600 }}>{move.label}</span>
                  {move.hint && <span className="body-s" style={{ color: 'var(--fg-2)' }}>{move.hint}</span>}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                  <KeyBadge value={move.key} withName />
                  <KeyCompat from={activeKey} to={move.key} />
                </div>
                <div className="body-s" style={{ color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
                  {count > 0 ? `${SN.format.count(count)} tracks` : '0 tracks'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
