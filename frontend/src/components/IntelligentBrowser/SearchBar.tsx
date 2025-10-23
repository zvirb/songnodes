/**
 * SearchBar Component
 * Accessible search input with clear functionality
 */

import React, { useRef } from 'react';
import styles from './IntelligentBrowser.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search tracks, artists...',
  resultCount
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={styles.searchContainer} role="search">
      <label htmlFor="track-search" className="sr-only">
        Search tracks and artists
      </label>

      <input
        ref={inputRef}
        id="track-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.searchInput}
        aria-label="Search tracks and artists"
        aria-describedby="search-hint"
        autoComplete="off"
      />

      {value && (
        <button
          className={styles.clearButton}
          onClick={handleClear}
          aria-label="Clear search"
          type="button"
        >
          ×
        </button>
      )}

      {/* Search icon */}
      <div className={styles.searchIcon} aria-hidden="true">
        🔍
      </div>

      {/* Search hint */}
      <span id="search-hint" className="sr-only">
        Type to filter tracks by name, artist, or genre. Press Escape to clear.
      </span>

      {/* Result count */}
      {resultCount !== undefined && value && (
        <div className={styles.resultCount} role="status" aria-live="polite">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </div>
      )}
    </div>
  );
};
