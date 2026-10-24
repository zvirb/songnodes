import React, { useMemo } from 'react';
import { Users, ChevronDown, ChevronRight, Music, TrendingUp, Hash } from 'lucide-react';
import { Community } from '../utils/communityDetection';
import useStore from '../store/useStore';

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
      className="community-cluster rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-1)]/80 backdrop-blur-md shadow-md transition-all duration-200 hover:border-[var(--color-border-strong)]"
    >
      {/* Header */}
      <button
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg-elevated-2)]/60 transition-colors rounded-[var(--radius-lg)]"
        onClick={() => onToggle(community.id)}
        aria-expanded={isExpanded}
        aria-label={`Toggle community ${community.id}`}
      >
        <div className="flex items-center gap-3">
          {/* Expand/Collapse Icon */}
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          )}

          {/* Community Icon */}
          <div
            className="w-8 h-8 rounded-[var(--radius-full)] flex items-center justify-center font-bold text-xs"
            style={{ backgroundColor: community.color, color: '#000000' }}
          >
            <Users className="w-4 h-4 text-black" />
          </div>

          {/* Community Info */}
          <div className="text-left">
            <div className="font-semibold text-[var(--color-text-primary)] text-sm">
              Community {community.id}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {community.size} track{community.size !== 1 ? 's' : ''}
              {community.dominantGenre && ` • ${community.dominantGenre}`}
            </div>
          </div>
        </div>

        {/* Metadata Pills */}
        <div className="flex items-center gap-2">
          {community.averageBPM && (
            <div className="px-2.5 py-0.5 rounded-[var(--radius-badge)] bg-[var(--color-brand-secondary-muted)] text-[var(--color-brand-secondary)] text-xs font-semibold border border-[var(--color-brand-secondary)]/30">
              {Math.round(community.averageBPM)} BPM
            </div>
          )}
          <div className="px-2.5 py-0.5 rounded-[var(--radius-badge)] bg-[var(--color-bg-elevated-2)] text-[var(--color-text-secondary)] text-xs font-medium border border-[var(--color-border-subtle)]">
            {community.size} nodes
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[var(--color-border-subtle)]">
          {/* Metadata Section */}
          <div className="py-3 space-y-2">
            {bpmRange && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingUp className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <span className="text-[var(--color-text-secondary)]">BPM Range:</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{bpmRange}</span>
              </div>
            )}

            {topKeys && (
              <div className="flex items-center gap-2 text-xs">
                <Hash className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <span className="text-[var(--color-text-secondary)]">Top Keys:</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{topKeys}</span>
              </div>
            )}

            {community.dominantGenre && (
              <div className="flex items-center gap-2 text-xs">
                <Music className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <span className="text-[var(--color-text-secondary)]">Genre:</span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {community.dominantGenre}
                </span>
              </div>
            )}
          </div>

          {/* Nodes List */}
          <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
            <div className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
              Tracks in this community
            </div>
            {communityNodes.map(node => (
              <button
                key={node.id}
                className="w-full text-left px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-bg-elevated-2)]/40 hover:bg-[var(--color-bg-elevated-2)] transition-colors group border border-transparent hover:border-[var(--color-border-subtle)]"
                onClick={() => onNodeClick?.(node.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--color-text-primary)] truncate text-xs group-hover:text-[var(--color-brand-primary)] transition-colors">
                      {node.label || node.track?.name || node.name || 'Unknown Track'}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                      {node.track?.artist || node.artist || 'Unknown Artist'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {node.bpm && (
                      <span className="text-[11px] text-[var(--color-text-secondary)]">
                        {Math.round(node.bpm)} BPM
                      </span>
                    )}
                    {(node.key || node.camelot_key) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-badge)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)] font-semibold border border-[var(--color-brand-primary)]/30">
                        {node.camelot_key || node.key}
                      </span>
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
      <div className={`text-center py-8 text-[var(--color-text-tertiary)] bg-[var(--color-bg-elevated-1)]/60 backdrop-blur-md rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-6 ${className}`}>
        <Users className="w-10 h-10 mx-auto mb-2 opacity-40 text-[var(--color-text-tertiary)]" />
        <p className="font-medium text-sm text-[var(--color-text-primary)]">No communities detected</p>
        <p className="text-xs mt-1 text-[var(--color-text-secondary)]">Click "Detect Communities" to analyze the graph</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">
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
