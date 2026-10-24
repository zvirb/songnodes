/**
 * FilterTabs Component
 * Tabbed interface for sorting recommendations using design tokens
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
  color: string;
  borderColor: string;
}

const TABS: TabConfig[] = [
  {
    id: 'score',
    label: 'Best Match',
    title: 'Sort by overall compatibility score (harmonic + energy + BPM + playlist history)',
    color: 'var(--color-brand-primary)',
    borderColor: 'var(--color-brand-primary)'
  },
  {
    id: 'energy',
    label: 'Energy Flow',
    title: 'Sort by energy level similarity (smooth transitions)',
    color: 'var(--color-brand-secondary)',
    borderColor: 'var(--color-brand-secondary)'
  },
  {
    id: 'bpm',
    label: 'Tempo Match',
    title: 'Sort by BPM similarity (closest tempo first)',
    color: 'var(--color-warning)',
    borderColor: 'var(--color-warning)'
  }
];

export const FilterTabs: React.FC<FilterTabsProps> = ({ sortBy, onSortChange, resultCount }) => {
  return (
    <div className={styles.filterTabs} role="tablist" aria-label="Sort options">
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
            style={{
              backgroundColor: sortBy === tab.id ? tab.color : 'transparent',
              borderColor: sortBy === tab.id ? tab.color : 'var(--color-border-default)',
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
