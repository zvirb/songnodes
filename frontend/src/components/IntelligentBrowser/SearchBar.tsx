/**
 * SearchBar Component
 * Accessible search input with clear button, keyboard handling (Escape to clear),
 * and Design System input tokens.
 */

import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';
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
  placeholder = 'Search tracks, artists, genres...',
  resultCount
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && value) {
      e.preventDefault();
      e.stopPropagation();
      handleClear();
    }
  };

  return (
    <div className={styles.search} role="search">
      <span className={styles.searchIcon} aria-hidden="true">
        <Search size={16} strokeWidth={2} />
      </span>
      <input
        ref={inputRef}
        id="track-search"
        type="search"
        className="sn-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search suggestions by track, artist or genre"
        aria-describedby="search-hint"
        autoComplete="off"
      />

      {value ? (
        <button
          className={styles.clear}
          onClick={handleClear}
          aria-label="Clear search"
          title="Clear search"
          type="button"
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}

      <span id="search-hint" className="sn-sr">
        Type to filter by track, artist or genre. Press Escape to clear.
      </span>

      {resultCount !== undefined && value ? (
        <span className="sn-sr" role="status" aria-live="polite">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </span>
      ) : null}
    </div>
  );
};
