import React, { useMemo } from 'react';
import { Users, ChevronDown, ChevronRight, Music, TrendingUp, Hash } from 'lucide-react';
import { Community } from '../utils/communityDetection';
import useStore from '../store/useStore';
import { KeyBadge, Bpm, EnergyBar, SN } from '../lib/songnodes';

interface CommunityClusterProps {
  community: Community;
  isExpanded: boolean;
  onToggle: (communityId: number) => void;
  onNodeClick?: (nodeId: string) => void;
}

/**
 * CommunityCluster component for displaying collapsible super-nodes
 * Shows community metadata and allows expansion to view individual nodes
 */
export const CommunityCluster: React.FC<CommunityClusterProps> = ({
  community,
  isExpanded,
  onToggle,
  onNodeClick
}) => {
  const graphData = useStore(state => state.graphData);

  // Get actual node data for the community
  const communityNodes = useMemo(() => {
    const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
    return community.nodes
      .map(nodeId => nodeMap.get(nodeId))
      .filter(node => node !== undefined);
  }, [community.nodes, graphData.nodes]);

  // Format BPM range
  const bpmRange = useMemo(() => {
    const bpms = communityNodes
      .map(n => n.bpm)
      .filter((bpm): bpm is number => bpm !== undefined);

    if (bpms.length === 0) return null;

    const minBPM = Math.min(...bpms);
    const maxBPM = Math.max(...bpms);

    return minBPM === maxBPM
      ? `${Math.round(minBPM)} BPM`
      : `${Math.round(minBPM)}-${Math.round(maxBPM)} BPM`;
  }, [communityNodes]);

  // Format key distribution
  const topKeys = useMemo(() => {
    if (!community.keyDistribution) return null;

    return Object.entries(community.keyDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([key, count]) => `${key} (${count})`)
      .join(', ');
  }, [community.keyDistribution]);

  return (
    <div
      className="community-cluster"
      style={{
        borderRadius: 'var(--radius-control)',
        border: `1px solid ${community.color || 'var(--line)'}`,
        boxShadow: 'var(--shadow-1)',
        backgroundColor: 'var(--surface-1)',
        transition: 'all var(--duration-base) var(--ease-standard)'
      }}
    >
      {/* Header */}
      <button
        style={{
          width: '100%',
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--fg)'
        }}
        onClick={() => onToggle(community.id)}
        aria-expanded={isExpanded}
        aria-label={`Toggle community ${community.id}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {/* Expand/Collapse Icon */}
          {isExpanded ? (
            <ChevronDown size={20} style={{ color: 'var(--fg-3)' }} />
          ) : (
            <ChevronRight size={20} style={{ color: 'var(--fg-3)' }} />
          )}

          {/* Community Icon */}
          <div
            style={{
              width: 'var(--space-8)',
              height: 'var(--space-8)',
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: community.color || 'var(--brand)',
              color: 'var(--on-brand)'
            }}
          >
            <Users size={16} />
          </div>

          {/* Community Info */}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, color: 'var(--fg)', fontSize: '0.9375rem' }}>
              Community {community.id}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--fg-2)' }}>
              {community.size} track{community.size !== 1 ? 's' : ''}
              {community.dominantGenre && ` • ${community.dominantGenre}`}
            </div>
          </div>
        </div>

        {/* Metadata Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {community.averageBPM && (
            <div style={{
              padding: 'var(--space-0.5) var(--space-2)',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--mod-graph-bg)',
              color: 'var(--mod-graph)',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {Math.round(community.averageBPM)} BPM
            </div>
          )}
          <div style={{
            padding: 'var(--space-0.5) var(--space-2)',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--surface-2)',
            color: 'var(--fg-2)',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            {community.size} nodes
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{
          padding: '0 var(--space-4) var(--space-4) var(--space-4)',
          borderTop: `1px solid var(--line)`
        }}>
          {/* Metadata Section */}
          <div style={{ padding: 'var(--space-3) 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {bpmRange && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8125rem' }}>
                <TrendingUp size={16} style={{ color: 'var(--fg-3)' }} />
                <span style={{ color: 'var(--fg-2)' }}>BPM Range:</span>
                <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{bpmRange}</span>
              </div>
            )}

            {topKeys && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8125rem' }}>
                <Hash size={16} style={{ color: 'var(--fg-3)' }} />
                <span style={{ color: 'var(--fg-2)' }}>Top Keys:</span>
                <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{topKeys}</span>
              </div>
            )}

            {community.dominantGenre && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8125rem' }}>
                <Music size={16} style={{ color: 'var(--fg-3)' }} />
                <span style={{ color: 'var(--fg-2)' }}>Genre:</span>
                <span style={{ fontWeight: 600, color: 'var(--fg)' }}>
                  {community.dominantGenre}
                </span>
              </div>
            )}
          </div>

          {/* Nodes List */}
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxHeight: '16rem', overflowY: 'auto' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-2)' }}>
              Tracks in this community
            </div>
            {communityNodes.map(node => (
              <button
                key={node.id}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-chip)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--fg)',
                  display: 'block'
                }}
                onClick={() => onNodeClick?.(node.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--fg)', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.label || node.track?.name || node.name || 'Unknown Track'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.track?.artist || node.artist || 'Unknown Artist'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'var(--space-2)' }}>
                    {node.bpm && (
                      <Bpm value={node.bpm} />
                    )}
                    {(node.key || node.camelot_key) && (
                      <KeyBadge value={(node.camelot_key || node.key) as string} />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * CommunityClusterList component for displaying multiple communities
 */
interface CommunityClusterListProps {
  communities: Community[];
  expandedCommunities: Set<number>;
  onToggle: (communityId: number) => void;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

export const CommunityClusterList: React.FC<CommunityClusterListProps> = ({
  communities,
  expandedCommunities,
  onToggle,
  onNodeClick,
  className = ''
}) => {
  // Sort communities by size (largest first)
  const sortedCommunities = useMemo(() => {
    return [...communities].sort((a, b) => b.size - a.size);
  }, [communities]);

  if (communities.length === 0) {
    return (
      <div className={className} style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--fg-3)' }}>
        <Users size={48} style={{ margin: '0 auto var(--space-2) auto', opacity: 0.5 }} />
        <p style={{ margin: 0, fontWeight: 600 }}>No communities detected</p>
        <p style={{ margin: 'var(--space-1) 0 0 0', fontSize: '0.8125rem' }}>Click "Detect Communities" to analyze the graph</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--fg-2)', marginBottom: 'var(--space-1)' }}>
        Found {communities.length} communit{communities.length !== 1 ? 'ies' : 'y'} in the graph
      </div>
      {sortedCommunities.map(community => (
        <CommunityCluster
          key={community.id}
          community={community}
          isExpanded={expandedCommunities.has(community.id)}
          onToggle={onToggle}
          onNodeClick={onNodeClick}
        />
      ))}
    </div>
  );
};

export default CommunityCluster;
