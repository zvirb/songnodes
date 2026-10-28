/**
 * AutocompleteSearchField (design system 1.2.0, Inputs).
 *
 * A SearchField whose input is a WAI-ARIA combobox with a grouped listbox popup:
 * recent searches (newest first, at most 5) and suggestions (best first, at most 8).
 * Markup and behaviour: design-system/components/AutocompleteSearchField/README.md.
 *
 * Focus never leaves the input: the active option is tracked with aria-activedescendant.
 * ArrowDown/ArrowUp move (and wrap), Enter chooses the active option or searches the typed
 * text, Escape closes an open popup and otherwise clears, Tab closes.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { SnIcon, SN } from '../../lib/songnodes';
import { clearRecentSearches, getRecentSearches, saveRecentSearch } from '../../utils/recentSearches';

export interface AutocompleteOption {
  /** Stable id (unique within the field). */
  id: string;
  /** Text inserted into the field when chosen. */
  value: string;
  /** Shown text if it differs from value; the typed prefix is marked bold. */
  label?: string;
  /** Right-hand meta in mono ("Artist · 41"). */
  meta?: string;
}

export interface AutocompleteSearchFieldProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onChange' | 'onSelect'> {
  value: string;
  onChange: (value: string) => void;
  /** Visually hidden label ("Search tracks"). */
  label: string;
  placeholder?: string;
  /** Matching count and total, rendered "42 of 1,284 tracks". */
  resultCount?: { shown: number; total: number; noun?: string };
  /** Typo-tolerant suggestion shown when there are no results. */
  suggestion?: string;
  onSuggestion?: (s: string) => void;
  /** Register the "/" shortcut and show its hint. */
  shortcut?: boolean;
  /** Completions for the current query, best first; at most 8 are shown. */
  suggestions: AutocompleteOption[];
  /** Recent queries, newest first. When omitted and `namespace` is set, the field manages them. */
  recent?: string[];
  /** Called with the chosen option, or the typed text on Enter with no active option. */
  onSelect: (value: string, option?: AutocompleteOption) => void;
  /** Clears the recent list; shows "Clear recent searches" in the popup foot. */
  onClearRecent?: () => void;
  /** Group label for suggestions; default "Suggestions". */
  suggestionsLabel?: string;
  /** Recent-search store key ("library-crate"); used when `recent` is not given. */
  namespace?: string;
}

const MAX_RECENT = 5;
const MAX_SUGGESTIONS = 8;

interface Row {
  key: string;
  kind: 'recent' | 'suggestion';
  value: string;
  text: string;
  meta?: string;
  option?: AutocompleteOption;
}

/** Bold the typed prefix when the text starts with it (case-insensitive). */
function Marked({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (q && text.toLowerCase().startsWith(q.toLowerCase())) {
    return (
      <>
        <mark>{text.slice(0, q.length)}</mark>
        {text.slice(q.length)}
      </>
    );
  }
  return <>{text}</>;
}

export const AutocompleteSearchField = React.forwardRef<HTMLFormElement, AutocompleteSearchFieldProps>(({
  value,
  onChange,
  label,
  placeholder = 'Search…',
  resultCount,
  suggestion,
  onSuggestion,
  shortcut = false,
  suggestions,
  recent,
  onSelect,
  onClearRecent,
  suggestionsLabel = 'Suggestions',
  namespace,
  className = '',
  ...props
}, ref) => {
  const uid = useId().replace(/:/g, '');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [stored, setStored] = useState<string[]>(() => (namespace && !recent ? getRecentSearches(namespace) : []));
  const recentList = recent ?? stored;
  const managed = !recent && Boolean(namespace);

  const rows = useMemo<Row[]>(() => {
    const q = value.trim().toLowerCase();
    const r: Row[] = recentList
      .filter((x) => !q || x.toLowerCase().startsWith(q))
      .slice(0, MAX_RECENT)
      .map((x, i) => ({ key: `r${i}`, kind: 'recent', value: x, text: x }));
    const s: Row[] = q
      ? suggestions.slice(0, MAX_SUGGESTIONS).map((o) => ({ key: `s-${o.id}`, kind: 'suggestion', value: o.value, text: o.label ?? o.value, meta: o.meta, option: o }))
      : [];
    return [...r, ...s];
  }, [recentList, suggestions, value]);

  const recentRows = rows.filter((r) => r.kind === 'recent');
  const suggestionRows = rows.filter((r) => r.kind === 'suggestion');
  const expanded = open && rows.length > 0;
  const activeIdx = Math.min(active, rows.length - 1);
  const optionId = useCallback((i: number) => `${uid}-opt-${i}`, [uid]);

  // Keep the active option in view inside the popup.
  useEffect(() => {
    if (!expanded || activeIdx < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(activeIdx))}`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIdx, expanded, optionId]);

  // "/" focuses the field from anywhere except other text fields.
  useEffect(() => {
    if (!shortcut) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);

  const choose = useCallback((row?: Row) => {
    const chosen = row ? row.value : value.trim();
    if (!chosen) return;
    if (row) onChange(row.value);
    if (managed && namespace) setStored(saveRecentSearch(namespace, chosen));
    setOpen(false);
    setActive(-1);
    onSelect(chosen, row?.option);
  }, [managed, namespace, onChange, onSelect, value]);

  const clearRecent = () => {
    if (managed && namespace) {
      clearRecentSearches(namespace);
      setStored([]);
    }
    onClearRecent?.();
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!expanded) {
        setOpen(true);
        setActive(e.key === 'ArrowDown' ? 0 : rows.length - 1);
        return;
      }
      const n = rows.length;
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % n : i <= 0 ? n - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(expanded && activeIdx >= 0 ? rows[activeIdx] : undefined);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (expanded) {
        setOpen(false);
        setActive(-1);
      } else if (value) {
        onChange('');
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
      setActive(-1);
    }
  };

  const renderGroup = (title: string, list: Row[], gid: string, icon: string) => (
    list.length ? (
      <div className="sn-autocomplete__group" role="group" aria-labelledby={gid}>
        <span className="sn-autocomplete__group-label" id={gid}>{title}</span>
        <div className="sn-autocomplete__options">
          {list.map((row) => {
            const i = rows.indexOf(row);
            return (
              <div
                key={row.key}
                id={optionId(i)}
                className="sn-autocomplete__option"
                role="option"
                tabIndex={-1}
                aria-selected={i === activeIdx}
                onMouseDown={(e) => { e.preventDefault(); choose(row); }}
                onMouseMove={() => { if (activeIdx !== i) setActive(i); }}
              >
                <span className="sn-autocomplete__icon" aria-hidden="true"><SnIcon name={icon} size={16} /></span>
                <span className="sn-autocomplete__text"><Marked text={row.text} query={value} /></span>
                {row.meta ? <span className="sn-autocomplete__meta">{row.meta}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    ) : null
  );

  const noun = resultCount?.noun ?? 'tracks';
  const metaId = `${uid}-meta`;
  const hasMeta = Boolean(resultCount || (suggestion && onSuggestion));

  return (
    <form
      ref={ref}
      role="search"
      className={['sn-search-field', 'sn-autocomplete', className].filter(Boolean).join(' ')}
      data-empty={value ? undefined : ''}
      onSubmit={(e) => e.preventDefault()}
      {...props}
    >
      <label className="sn-sr" htmlFor={uid}>{label}</label>
      <div className="sn-search-field__box">
        <span className="sn-search-field__icon" aria-hidden="true"><SnIcon name="search" size={16} /></span>
        <input
          ref={inputRef}
          id={uid}
          type="search"
          className="sn-input sn-search-field__input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={`${uid}-list`}
          aria-activedescendant={expanded && activeIdx >= 0 ? optionId(activeIdx) : undefined}
          aria-describedby={hasMeta ? metaId : undefined}
          aria-keyshortcuts={shortcut ? '/' : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { setOpen(false); setActive(-1); }}
          onKeyDown={onKeyDown}
        />
        <span className="sn-search-field__end">
          {shortcut ? <kbd className="sn-search-field__kbd" aria-hidden="true">/</kbd> : null}
          <button
            type="button"
            className="sn-search-field__clear"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(''); inputRef.current?.focus(); }}
          >
            <SnIcon name="x" size={14} />
          </button>
        </span>
        <div className="sn-autocomplete__popup" hidden={!expanded}>
          <div className="sn-autocomplete__list" role="listbox" id={`${uid}-list`} aria-label={`${label}: suggestions`} ref={listRef}>
            {renderGroup('Recent searches', recentRows, `${uid}-g-recent`, 'history')}
            {renderGroup(suggestionsLabel, suggestionRows, `${uid}-g-sugg`, 'search')}
          </div>
          {recentRows.length && (managed || onClearRecent) ? (
            <div className="sn-autocomplete__foot">
              <button type="button" className="sn-autocomplete__clear" onMouseDown={(e) => e.preventDefault()} onClick={clearRecent}>
                Clear recent searches
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {hasMeta ? (
        <div className="sn-search-field__meta" id={metaId}>
          {resultCount ? (
            <span className="sn-search-field__count" role="status">
              <b>{SN.format.count(resultCount.shown)}</b> of {SN.format.count(resultCount.total)} {noun}
            </span>
          ) : null}
          {suggestion && onSuggestion ? (
            <span className="sn-search-field__suggest">
              Did you mean <button type="button" onClick={() => onSuggestion(suggestion)}>{suggestion}</button>?
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
});
AutocompleteSearchField.displayName = 'AutocompleteSearchField';
