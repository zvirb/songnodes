/**
 * FilterTabs Component
 * Sort order for the suggestions: a design-system SegmentedControl
 * (one view, three orderings), not tabs.
 */

import React from 'react';
import type { SortOption } from './types';
import { SegmentedControl } from '../ds';
import { SN } from '../../lib/songnodes';
import styles from './IntelligentBrowser.module.css';

interface FilterTabsProps {
  sortBy: SortOption;
  onSortChange: (sortBy: SortOption) => void;
  resultCount: number;
}

type SortChoice = Exclude<SortOption, 'key'>;

const OPTIONS: { value: SortChoice; label: string; info: string }[] = [
  { value: 'score', label: 'Best match', info: 'best match' },
  { value: 'energy', label: 'Energy', info: 'closest energy' },
  { value: 'bpm', label: 'Tempo', info: 'closest tempo' },
];

export const FilterTabs: React.FC<FilterTabsProps> = ({ sortBy, onSortChange, resultCount }) => {
  const current = OPTIONS.find((o) => o.value === sortBy) ?? OPTIONS[0];
  return (
    <div className={styles.sort}>
      <SegmentedControl<SortChoice>
        label="Sort suggestions by"
        size="sm"
        block
        value={current.value}
        onChange={onSortChange}
        options={OPTIONS.map(({ value, label }) => ({ value, label }))}
      />
      <div className={styles.sortInfo} role="status" aria-live="polite">
        {SN.format.count(resultCount)} {resultCount === 1 ? 'track' : 'tracks'} · sorted by {current.info}
      </div>
    </div>
  );
};
