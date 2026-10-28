/**
 * FilterRail for the crate (design-system FilterRail, FilterChip, SearchField, Checkbox):
 * a sticky rail from 1024px, a "Filters (n)" button with removable active-filter chips and a
 * modal side sheet below. Order: Search, Pillar, Energy tier, Rotation, Heard on, Tags, Track checks.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SN, SnIcon } from '../../../lib/songnodes';
import type { LibraryTrack } from '../data';
import {
  DEFAULT_FILTERS, PILLARS, ROT, TIERS, activeFilterCount, matchesFilters, sourceName, tierOf,
  type CrateFilters, type FilterGroup, type Tier,
} from '../setBuilder';
import { AutocompleteSearchField, type AutocompleteOption } from '../../../components/ds/AutocompleteSearchField';
import { LexiconTrie } from '../../../utils/lexiconTrie';

const TIER_LABEL: Record<Tier, string> = { low: 'Low 1–4', building: 'Building 5–7', high: 'High 8–10' };

/** Suggestion kinds: artists and titles fill the query; tags and sources apply that filter. */
type SuggestKind = 'artist' | 'track' | 'tag' | 'source';
const KIND_LABEL: Record<SuggestKind, string> = { artist: 'Artist', track: 'Title', tag: 'Tag', source: 'Source' };
interface Vocab { trie: LexiconTrie; counts: Map<string, number>; sourceIds: Map<string, string> }
const vocabKey = (kind: string, word: string) => `${kind}\u0000${word}`;

const SHEET_MQ = '(max-width: 1023.98px)';

interface Props {
  tracks: LibraryTrack[];
  filters: CrateFilters;
  onChange: (f: CrateFilters) => void;
  /** Search text as typed (filters.q follows it after a short debounce). */
  query: string;
  onQuery: (q: string) => void;
  shown: number;
  searchRef: React.RefObject<HTMLInputElement | null>;
  open: boolean;
  setOpen: (v: boolean) => void;
  rotationNote: React.ReactNode;
}

export const CrateFilterRail: React.FC<Props> = ({ tracks, filters: F, onChange, query, onQuery, shown, searchRef, open, setOpen, rotationNote }) => {
  const [sheet, setSheet] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(SHEET_MQ).matches);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Vocabulary for the search field, rebuilt when the tracks change.
  const vocab = useMemo<Vocab>(() => {
    const trie = new LexiconTrie();
    const counts = new Map<string, number>();
    const sourceIds = new Map<string, string>();
    const words = new Map<string, { kind: SuggestKind; word: string }>();
    const add = (kind: SuggestKind, word: string) => {
      const k = vocabKey(kind, word);
      words.set(k, { kind, word });
      counts.set(k, (counts.get(k) ?? 0) + 1);
    };
    for (const track of tracks) {
      if (track.a) add('artist', track.a);
      if (track.t) add('track', track.t);
      for (const tag of track.tags) add('tag', tag);
      for (const s of track.src) { sourceIds.set(sourceName(s), s); add('source', sourceName(s)); }
    }
    const base: Record<SuggestKind, number> = { artist: 50, tag: 40, source: 30, track: 10 };
    for (const [k, { kind, word }] of words) trie.insert(word, kind, base[kind] + (counts.get(k) ?? 0));
    return { trie, counts, sourceIds };
  }, [tracks]);

  const suggestions = useMemo<AutocompleteOption[]>(() => {
    const q = query.trim();
    if (!q) return [];
    // The trie also carries built-in keys and pillars; only offer what this crate can filter on.
    return vocab.trie.searchPrefix(q, 32)
      .filter((r): r is { word: string; category: SuggestKind } => !!r.category && r.category in KIND_LABEL)
      .slice(0, 8)
      .map((r) => ({
        id: vocabKey(r.category, r.word),
        value: r.word,
        meta: `${KIND_LABEL[r.category]} · ${SN.format.count(vocab.counts.get(vocabKey(r.category, r.word)) ?? 0)}`,
      }));
  }, [vocab, query]);

  const chooseSuggestion = (value: string, option?: AutocompleteOption) => {
    const kind = option?.id.split('\u0000')[0];
    if (kind === 'tag') {
      onQuery('');
      if (!F.tags.includes(value)) onChange({ ...F, tags: [...F.tags, value] });
    } else if (kind === 'source') {
      onQuery('');
      onChange({ ...F, src: vocab.sourceIds.get(value) ?? '' });
    } else {
      onQuery(value);
    }
  };

  // The field forwards its ref to the form; the page focuses and selects the input through searchRef.
  const fieldRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    searchRef.current = fieldRef.current?.querySelector('input') ?? null;
  });

  useEffect(() => {
    const mq = window.matchMedia?.(SHEET_MQ);
    if (!mq) return;
    const on = () => setSheet(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  // Sheet: focus in, Tab trapped, Escape closes and returns focus to the trigger.
  useEffect(() => {
    if (!sheet || !open) return;
    const panel = panelRef.current;
    if (!panel) return;
    if (!panel.contains(document.activeElement)) requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); return; }
      if (e.key !== 'Tab') return;
      const f = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,summary,a[href]')).filter((x) => x.offsetParent !== null);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet, open, setOpen]);

  const count = (group: FilterGroup, pred: (t: LibraryTrack) => boolean) => tracks.reduce((n, t) => n + (matchesFilters(t, F, group) && pred(t) ? 1 : 0), 0);
  const tags = useMemo(() => [...new Set(tracks.flatMap((t) => t.tags))].sort((a, b) => a.localeCompare(b, 'en-AU')), [tracks]);
  const sources = useMemo(() => [...new Set(tracks.flatMap((t) => t.src))].sort((a, b) => sourceName(a).localeCompare(sourceName(b), 'en-AU')), [tracks]);

  const toggle = <K extends 'pillar' | 'tier' | 'rot' | 'tags'>(key: K, v: CrateFilters[K][number]) => {
    const cur = F[key] as unknown[];
    onChange({ ...F, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const nActive = activeFilterCount(F);
  const clearAll = () => onChange({ ...DEFAULT_FILTERS, q: F.q });

  type Active = { label: string; remove: () => void };
  const active: Active[] = [
    ...F.pillar.map((p) => ({ label: PILLARS.find((x) => x.id === p)?.label ?? p, remove: () => toggle('pillar', p) })),
    ...F.tier.map((t) => ({ label: TIER_LABEL[t], remove: () => toggle('tier', t) })),
    ...(F.rot.join() !== DEFAULT_FILTERS.rot.join() ? [{ label: F.rot.length ? `Rotation: ${F.rot.map((r) => ROT[r]).join(', ')}` : 'Any rotation', remove: () => onChange({ ...F, rot: [...DEFAULT_FILTERS.rot] }) }] : []),
    ...(F.src ? [{ label: `Heard on ${sourceName(F.src)}`, remove: () => onChange({ ...F, src: '' }) }] : []),
    ...F.tags.map((t) => ({ label: t, remove: () => toggle('tags', t) })),
    ...(F.key ? [{ label: 'Has key and BPM', remove: () => onChange({ ...F, key: false }) }] : []),
    ...(F.rev ? [{ label: 'Needs an energy check', remove: () => onChange({ ...F, rev: false }) }] : []),
    ...(F.multi ? [{ label: 'Played on 2+ shows', remove: () => onChange({ ...F, multi: false }) }] : []),
  ];

  const group = (id: string, label: string, chips: { key: string; label: string; on: boolean; n: number; tier?: Tier; emph?: boolean; toggle: () => void }[], clear: () => void, after?: React.ReactNode) => {
    const on = chips.filter((c) => c.on).length;
    return (
      <div className="sn-filter-rail__section sn-filter-chip-group" role="group" aria-labelledby={`f-${id}`}>
        <div className="sn-filter-chip-group__head">
          <span className="sn-filter-chip-group__legend" id={`f-${id}`}>{label}</span>
          {on ? (
            <button className="sn-filter-chip-group__clear" type="button" aria-label={`Clear ${on} ${label.toLowerCase()} ${on === 1 ? 'filter' : 'filters'}`} onClick={() => { clear(); requestAnimationFrame(() => chipRefs.current[`${id}:${chips[0].key}`]?.focus()); }}>Clear ({on})</button>
          ) : null}
        </div>
        <ul className="sn-filter-chip-group__list">
          {chips.map((c) => (
            <li key={c.key}>
              <button
                ref={(el) => { chipRefs.current[`${id}:${c.key}`] = el; }}
                type="button"
                className={`sn-chip sn-filter-chip${c.emph ? ' sn-filter-chip--emph' : ''}`}
                aria-pressed={c.on}
                data-tier={c.tier}
                data-empty={c.n === 0 ? '' : undefined}
                onClick={c.toggle}
              >
                {c.tier ? <span className="sn-filter-chip__tier" aria-hidden="true"><i /><i /><i /></span> : null}
                <span>{c.label}</span>
                <span className="sn-filter-chip__count"><span className="sn-sr">, </span>{SN.format.count(c.n)}<span className="sn-sr"> tracks</span></span>
              </button>
            </li>
          ))}
        </ul>
        {after}
      </div>
    );
  };

  const check = (key: 'key' | 'rev' | 'multi', label: string, pred: (t: LibraryTrack) => boolean) => (
    <label className="sn-checkbox">
      <input type="checkbox" checked={F[key]} onChange={(e) => onChange({ ...F, [key]: e.target.checked })} />
      <span className="sn-checkbox__text"><span>{label}<span className="sn-checkbox__count">{SN.format.count(count(key, pred))}</span></span></span>
    </label>
  );

  return (
    <div className="sn-filter-rail" data-open={open ? '' : undefined}>
      <div className="sn-filter-rail__bar">
        <div className="sn-filter-rail__bar-row">
          <button ref={triggerRef} type="button" className="sn-btn" aria-haspopup="dialog" aria-expanded={open} aria-controls="crate-filters" onClick={() => setOpen(true)}>
            <SnIcon name="list-filter" />
            <span>{nActive ? `Filters (${nActive})` : 'Filters'}</span>
          </button>
          {nActive ? <button type="button" className="sn-btn sn-btn--quiet sn-btn--sm" onClick={clearAll}>Clear filters</button> : null}
        </div>
        {active.length ? (
          <ul className="sn-filter-rail__summary" aria-label="Active filters">
            {active.map((a, i) => (
              <li key={a.label}>
                <button
                  type="button"
                  className="sn-filter-rail__active"
                  aria-label={`Remove filter: ${a.label}`}
                  onClick={(e) => {
                    const next = (e.currentTarget.closest('li')?.nextElementSibling ?? e.currentTarget.closest('li')?.previousElementSibling)?.querySelector('button');
                    a.remove();
                    requestAnimationFrame(() => ((i < active.length - 1 || active.length > 1) && next ? next : triggerRef.current)?.focus());
                  }}
                >
                  {a.label}<SnIcon name="x" size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="sn-filter-rail__scrim" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} />
      <aside
        ref={panelRef}
        className="sn-filter-rail__panel"
        id="crate-filters"
        aria-labelledby="crate-filters-t"
        role={sheet ? 'dialog' : undefined}
        aria-modal={sheet ? true : undefined}
      >
        <div className="sn-filter-rail__head">
          <h2 className="sn-filter-rail__title" id="crate-filters-t">Filters</h2>
          {nActive ? <button type="button" className="sn-btn sn-btn--quiet sn-btn--sm" onClick={clearAll}>Clear filters</button> : null}
          <button ref={closeRef} type="button" className="sn-btn sn-btn--quiet sn-btn--icon sn-btn--sm sn-filter-rail__close" aria-label="Close filters" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>
            <SnIcon name="x" />
          </button>
        </div>
        <div className="sn-filter-rail__body">
          <div className="sn-filter-rail__section">
            <AutocompleteSearchField
              ref={fieldRef}
              label="Search tracks"
              placeholder="Search artist, title or label"
              value={query}
              onChange={onQuery}
              namespace="library-crate"
              shortcut
              suggestions={suggestions}
              suggestionsLabel="Matches"
              onSelect={chooseSuggestion}
              resultCount={{ shown, total: tracks.length, noun: 'tracks' }}
            />
          </div>
          {group('pillar', 'Pillar', PILLARS.map((p) => ({ key: p.id, label: p.label, on: F.pillar.includes(p.id), n: count('pillar', (t) => t.p === p.id), toggle: () => toggle('pillar', p.id) })), () => onChange({ ...F, pillar: [] }))}
          {group('tier', 'Energy tier', TIERS.map((t) => ({ key: t, label: TIER_LABEL[t], tier: t, on: F.tier.includes(t), n: count('tier', (x) => tierOf(x.e) === t), toggle: () => toggle('tier', t) })), () => onChange({ ...F, tier: [] }))}
          {group('rot', 'Rotation', [1, 2, 3].map((r) => ({ key: String(r), label: ROT[r], emph: r === 1, on: F.rot.includes(r), n: count('rot', (t) => t.rot === r), toggle: () => toggle('rot', r) })), () => onChange({ ...F, rot: [] }), rotationNote)}
          <div className="sn-filter-rail__section sn-field sn-select-field">
            <label htmlFor="crate-src">Heard on</label>
            <select className="sn-select" id="crate-src" value={F.src} onChange={(e) => onChange({ ...F, src: e.target.value })}>
              <option value="">Any show</option>
              {sources.map((s) => <option key={s} value={s}>{sourceName(s)} ({SN.format.count(count('src', (t) => t.src.includes(s)))})</option>)}
            </select>
          </div>
          {tags.length
            ? group('tags', 'Tags', tags.map((t) => ({ key: t, label: t, on: F.tags.includes(t), n: count('tags', (x) => x.tags.includes(t)), toggle: () => toggle('tags', t) })), () => onChange({ ...F, tags: [] }))
            : null}
          <div className="sn-filter-rail__section sn-checkbox-group" role="group" aria-labelledby="f-checks">
            <span className="sn-filter-chip-group__legend" id="f-checks">Track checks</span>
            <div className="sn-filter-rail__checks">
              {check('key', 'Has key and BPM', (t) => !!(t.k && t.bpm))}
              {check('rev', 'Needs an energy check', (t) => t.rev)}
              {check('multi', 'Played on 2+ shows', (t) => t.src.length >= 2)}
            </div>
          </div>
        </div>
        <div className="sn-filter-rail__foot">
          <button type="button" className="sn-btn sn-btn--primary" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>Show {SN.format.count(shown)} tracks</button>
        </div>
      </aside>
    </div>
  );
};
