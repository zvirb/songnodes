/**
 * FilterTabs Component
 * Tabbed interface for sorting recommendations
 */

import React from 'react';
import type { SortOption } from './types';
import styles from './IntelligentBrowser.module.css';

interface FilterTabsProps {
  sortBy: SortOption;
  onSortChange: (sortBy: SortOption) => void;
  resultCount: number;
}

interface TabConfig {
  id: SortOption;
  label: string;
  title: string;
  colorVar: string;
  borderColorVar: string;
}

const TABS: TabConfig[] = [
  {
    id: 'score',
    label: 'Best Match',
    title: 'Sort by overall compatibility score (harmonic + energy + BPM + playlist history)',
    colorVar: 'var(--color-brand-secondary)',
    borderColorVar: 'var(--color-brand-secondary)'
  },
  {
    id: 'energy',
    label: 'Energy Flow',
    title: 'Sort by energy level similarity (smooth transitions)',
    colorVar: 'var(--color-brand-primary)',
    borderColorVar: 'var(--color-brand-primary)'
  },
  {
    id: 'bpm',
    label: 'Tempo Match',
    title: 'Sort by BPM similarity (closest tempo first)',
    colorVar: 'var(--color-warning)',
    borderColorVar: 'var(--color-warning)'
  }
];

export const FilterTabs: React.FC<FilterTabsProps> = ({ sortBy, onSortChange, resultCount }) => {
  return (
    <div className={styles.filterTabs} role="tablist" aria-label="Sort options" data-testid="filter-tabs">
      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSortChange(tab.id)}
            title={tab.title}
            className={`${styles.tab} ${sortBy === tab.id ? styles.tabActive : ''}`}
            role="tab"
            aria-selected={sortBy === tab.id}
            aria-controls="recommendations-list"
            data-testid={`filter-tab-${tab.id}`}
            style={{
              backgroundColor: sortBy === tab.id ? tab.colorVar : 'transparent',
              borderColor: tab.borderColorVar,
              color: sortBy === tab.id ? 'var(--color-text-inverse)' : 'var(--color-text-primary)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Info */}
      <div className={styles.filterInfo} role="status" aria-live="polite">
        {resultCount} track{resultCount !== 1 ? 's' : ''} • Sorted by{' '}
        {sortBy === 'score' ? 'Best Match' :
         sortBy === 'energy' ? 'Energy Similarity' :
         'Tempo Similarity'}
      </div>
    </div>
  );
};
