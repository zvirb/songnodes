import React, { useState, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { SearchFilters } from '../types';
import { COMMON_GENRES } from '../utils/filterUtils';
import { DualRangeSlider } from './DualRangeSlider';
import { CamelotWheel } from './CamelotWheel';
import { MultiSelect } from './MultiSelect';
import { Sliders, Key, Music, Calendar, Zap, Mic2, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  onToggle: () => void;
  isExpanded: boolean;
  children: React.ReactNode;
  activeFilterCount?: number;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, icon, onToggle, isExpanded, children, activeFilterCount }) => (
  <div className="border-b border-gray-700 py-4">
    <button onClick={onToggle} className="w-full flex justify-between items-center text-left text-white font-semibold">
      <span className="flex items-center gap-3">
        {icon}
        {title}
        {activeFilterCount && activeFilterCount > 0 && (
          <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{activeFilterCount}</span>
        )}
      </span>
      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
    </button>
    {isExpanded && <div className="mt-4 space-y-4">{children}</div>}
  </div>
);

/**
 * A panel for applying detailed filters to the graph visualization.
 * It allows users to filter by BPM, key, genre, and other track attributes.
 */
export const FilterPanel: React.FC = () => {
  const { searchFilters, graphData, applyFilters, setSearchFilters } = useStore(state => ({
    searchFilters: state.search.filters,
    graphData: state.graphData,
    applyFilters: state.search.applyFilters,
    setSearchFilters: state.search.setSearchFilters,
  }));

  const [localFilters, setLocalFilters] = useState<SearchFilters>(searchFilters);
  const [expandedSections, setExpandedSections] = useState({
    bpm: true, key: true, genre: true, year: false, energy: false, artist: false,
  });

  const uniqueValues = useMemo(() => {
    const tracks = graphData.nodes.filter(n => n.type === 'track' && n.track).map(n => n.track!);
    const uniqueArtists = [...new Set(tracks.map(t => t.artist).filter(Boolean))].sort() as string[];
    const uniqueGenres = [...new Set([...tracks.map(t => t.genre).filter(Boolean), ...COMMON_GENRES])].sort() as string[];
    return { artists: uniqueArtists, genres: uniqueGenres };
  }, [graphData]);

  const handleFilterChange = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleApplyFilters = useCallback(() => {
    setSearchFilters(localFilters);
    applyFilters();
  }, [localFilters, setSearchFilters, applyFilters]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({...prev, [section]: !prev[section]}));
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold">Graph Filters</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <FilterSection title="BPM Range" icon={<Sliders size={18} />} onToggle={() => toggleSection('bpm')} isExpanded={expandedSections.bpm}>
          <DualRangeSlider min={60} max={200} value={localFilters.bpmRange || [60, 200]} onChange={value => handleFilterChange('bpmRange', value)} label="BPM" />
        </FilterSection>
        <FilterSection title="Musical Key" icon={<Key size={18} />} onToggle={() => toggleSection('key')} isExpanded={expandedSections.key}>
          <CamelotWheel size={200} onKeySelect={keys => handleFilterChange('keyRange', keys)} />
        </FilterSection>
        <FilterSection title="Genre" icon={<Music size={18} />} onToggle={() => toggleSection('genre')} isExpanded={expandedSections.genre}>
          <MultiSelect options={uniqueValues.genres} selectedValues={localFilters.genre || []} onChange={values => handleFilterChange('genre', values)} label="Genres" searchable />
        </FilterSection>
        <FilterSection title="Release Year" icon={<Calendar size={18} />} onToggle={() => toggleSection('year')} isExpanded={expandedSections.year}>
           <DualRangeSlider min={1980} max={new Date().getFullYear()} value={localFilters.yearRange || [1980, new Date().getFullYear()]} onChange={value => handleFilterChange('yearRange', value)} label="Year" />
        </FilterSection>
        <FilterSection title="Energy" icon={<Zap size={18} />} onToggle={() => toggleSection('energy')} isExpanded={expandedSections.energy}>
           <DualRangeSlider min={0} max={10} value={localFilters.energyRange || [0, 10]} onChange={value => handleFilterChange('energyRange', value)} label="Energy" />
        </FilterSection>
        <FilterSection title="Artist" icon={<Mic2 size={18} />} onToggle={() => toggleSection('artist')} isExpanded={expandedSections.artist}>
          <MultiSelect options={uniqueValues.artists} selectedValues={localFilters.artist || []} onChange={values => handleFilterChange('artist', values)} label="Artists" searchable />
        </FilterSection>
      </div>
      <div className="p-4 border-t border-gray-700">
        <button onClick={handleApplyFilters} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
          Apply Filters
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;