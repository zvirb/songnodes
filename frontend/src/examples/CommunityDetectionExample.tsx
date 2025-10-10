import React, { useEffect } from 'react';
import useStore from '../store/useStore';
import { CommunityClusterList } from '../components/CommunityCluster';
import { Users, Zap, AlertCircle } from 'lucide-react';

/**
 * Example component demonstrating community detection and neighborhood highlighting
 *
 * USAGE:
 *
 * 1. Detect Communities:
 *    - Click "Detect Communities" button
 *    - Adjust resolution slider for more/fewer communities (default: 1.0)
 *    - Higher resolution = more smaller communities
 *    - Lower resolution = fewer larger communities
 *
 * 2. Explore Communities:
 *    - Click community card to expand/collapse
 *    - View tracks in each community
 *    - See metadata: avg BPM, dominant genre, key distribution
 *
 * 3. Neighborhood Highlighting:
 *    - Click any node in the graph
 *    - Node and immediate neighbors highlight
 *    - Other nodes dim to 0.2 opacity
 *    - Double-click for 2-hop neighborhood
 *
 * 4. Filter by Communities:
 *    - Select one or more communities
 *    - Graph shows only nodes from selected communities
 */
export const CommunityDetectionExample: React.FC = () => {
  const communityState = useStore(state => state.communityState);
  const detectCommunities = useStore(state => state.community.detectCommunities);
  const toggleExpanded = useStore(state => state.community.toggleCommunityExpanded);
  const filterByCommunities = useStore(state => state.community.filterByCommunities);
  const resetCommunities = useStore(state => state.community.resetCommunities);
  const navigateToNode = useStore(state => state.view.navigateToNode);

  const [resolution, setResolution] = React.useState(1.0);
  const [selectedCommunities, setSelectedCommunities] = React.useState<Set<number>>(new Set());

  const handleDetect = async () => {
    await detectCommunities(resolution);
  };

  const handleNodeClick = (nodeId: string) => {
    navigateToNode(nodeId, { highlight: true, selectNode: true });
  };

  const handleCommunitySelect = (communityId: number) => {
    setSelectedCommunities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(communityId)) {
        newSet.delete(communityId);
      } else {
        newSet.add(communityId);
      }
      return newSet;
    });
  };

  const handleApplyFilter = async () => {
    if (selectedCommunities.size > 0) {
      await filterByCommunities(Array.from(selectedCommunities));
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Community Detection
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Discover clusters of similar tracks using the Louvain algorithm
          </p>
        </div>
      </div>

      {/* Detection Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Resolution (more = smaller communities)
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={resolution}
            onChange={(e) => setResolution(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0.5 (fewer)</span>
            <span className="font-medium">{resolution.toFixed(1)}</span>
            <span>2.0 (more)</span>
          </div>
        </div>

        <button
          onClick={handleDetect}
          disabled={communityState.isDetecting}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {communityState.isDetecting ? (
            <>
              <Zap className="w-4 h-4 animate-spin" />
              Detecting...
            </>
          ) : (
            <>
              <Users className="w-4 h-4" />
              Detect Communities
            </>
          )}
        </button>

        {communityState.lastDetectionTime && (
          <button
            onClick={resetCommunities}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Reset Detection
          </button>
        )}
      </div>

      {/* Results Summary */}
      {communityState.communities.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {communityState.communityCount}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Communities</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {communityState.modularity.toFixed(3)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Modularity</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {Math.round(
                  communityState.communities.reduce((sum, c) => sum + c.size, 0) /
                    communityState.communities.length
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg Size</div>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Modularity Score:</strong> {communityState.modularity.toFixed(3)}{' '}
              {communityState.modularity > 0.3
                ? '(Strong community structure)'
                : communityState.modularity > 0.2
                ? '(Moderate community structure)'
                : '(Weak community structure)'}
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      {selectedCommunities.size > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {selectedCommunities.size} communit{selectedCommunities.size !== 1 ? 'ies' : 'y'}{' '}
              selected
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCommunities(new Set())}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Clear
              </button>
              <button
                onClick={handleApplyFilter}
                className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Community List */}
      <CommunityClusterList
        communities={communityState.communities}
        expandedCommunities={communityState.expandedCommunities}
        onToggle={toggleExpanded}
        onNodeClick={handleNodeClick}
      />

      {/* Usage Guide */}
      {communityState.communities.length === 0 && !communityState.isDetecting && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border p-6 text-sm text-gray-600 dark:text-gray-400">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            How to Use Community Detection
          </h3>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                1
              </span>
              <span>
                <strong>Adjust Resolution:</strong> Higher values create more smaller communities,
                lower values create fewer larger communities
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                2
              </span>
              <span>
                <strong>Detect:</strong> Click the button to run the Louvain algorithm on your
                graph
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                3
              </span>
              <span>
                <strong>Explore:</strong> Click communities to expand and see member tracks,
                metadata, and patterns
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                4
              </span>
              <span>
                <strong>Navigate:</strong> Click track names to navigate to and highlight them on
                the graph
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default CommunityDetectionExample;
