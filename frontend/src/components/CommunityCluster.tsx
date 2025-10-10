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
      className="community-cluster rounded-lg border shadow-sm transition-all duration-200 hover:shadow-md"
      style={{
        borderColor: community.color,
        backgroundColor: `${community.color}10`
      }}
    >
      {/* Header */}
      <button
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        onClick={() => onToggle(community.id)}
        aria-expanded={isExpanded}
        aria-label={`Toggle community ${community.id}`}
      >
        <div className="flex items-center gap-3">
          {/* Expand/Collapse Icon */}
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}

          {/* Community Icon */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: community.color }}
          >
            <Users className="w-4 h-4 text-white" />
          </div>

          {/* Community Info */}
          <div className="text-left">
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              Community {community.id}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {community.size} track{community.size !== 1 ? 's' : ''}
              {community.dominantGenre && ` • ${community.dominantGenre}`}
            </div>
          </div>
        </div>

        {/* Metadata Pills */}
        <div className="flex items-center gap-2">
          {community.averageBPM && (
            <div className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-xs font-medium">
              {Math.round(community.averageBPM)} BPM
            </div>
          )}
          <div className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium">
            {community.size} nodes
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: `${community.color}40` }}>
          {/* Metadata Section */}
          <div className="py-3 space-y-2">
            {bpmRange && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">BPM Range:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{bpmRange}</span>
              </div>
            )}

            {topKeys && (
              <div className="flex items-center gap-2 text-sm">
                <Hash className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">Top Keys:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{topKeys}</span>
              </div>
            )}

            {community.dominantGenre && (
              <div className="flex items-center gap-2 text-sm">
                <Music className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">Genre:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {community.dominantGenre}
                </span>
              </div>
            )}
          </div>

          {/* Nodes List */}
          <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Tracks in this community
            </div>
            {communityNodes.map(node => (
              <button
                key={node.id}
                className="w-full text-left px-3 py-2 rounded hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors group"
                onClick={() => onNodeClick?.(node.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                      {node.label || node.track?.name || node.name || 'Unknown Track'}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {node.track?.artist || node.artist || 'Unknown Artist'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {node.bpm && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Math.round(node.bpm)} BPM
                      </span>
                    )}
                    {(node.key || node.camelot_key) && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100">
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
      <div className={`text-center py-8 text-gray-500 dark:text-gray-400 ${className}`}>
        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No communities detected</p>
        <p className="text-sm mt-1">Click "Detect Communities" to analyze the graph</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
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
