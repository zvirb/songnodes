/**
 * Library: Melbourne crate (/library), design-system LibraryPage.
 * Figure tiles, keyed-coverage banner, FilterRail, sortable crate DataTable (stacked cards on
 * phones), ShowMore batching, add-to-set into the Set builder draft, and "Build set from crate".
 * Filters persist on this device (sn-filters-library) and in the URL; a shared URL wins.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePageHeader } from '../../shell/AppShell';
import { PageHeader, EmptyState } from '../../shell/PageParts';
import { SN, SnIcon, EnergyBar, KeyBadge, Bpm } from '../../lib/songnodes';
import { loadLibrary, type LibraryFile, type LibraryTrack } from './data';
import {
  DEFAULT_FILTERS, ROT, activeFilterCount, addTrack, filterTracks, filtersFromParams, filtersToParams, hasFilterParams,
  pillarLabel, sanitiseFilters, sortTracks, sourceName, type CrateFilters, type SortDir, type SortKey,
} from './setBuilder';
import { FILTERS_KEY, bannerKey, lsGet, lsSet, melbourneStamp, normaliseTracks, readDraft, writeDraft } from './storage';
import { Banner, TrackCell, useAnnouncer, useToaster } from './components/ui';
import { CrateFilterRail } from './components/CrateFilterRail';
import './musicLibrary.css';

const FIRST_BATCH = 150;
const NEXT_BATCH = 300;

interface Stored { filters: CrateFilters; sort: { key: SortKey; dir: SortDir } }
const DEFAULT_SORT = { key: 'e' as SortKey, dir: 'descending' as SortDir };

const COLS: { id: SortKey; label: string; num?: boolean }[] = [
  { id: 'e', label: 'Energy' },
  { id: 'track', label: 'Track' },
  { id: 'bpm', label: 'BPM', num: true },
  { id: 'k', label: 'Key' },
  { id: 'p', label: 'Pillar' },
  { id: 'rot', label: 'Rotation' },
  { id: 'src', label: 'Heard', num: true },
  { id: 'last', label: 'Last heard', num: true },
];

const RotationTag: React.FC<{ rot: number | null }> = ({ rot }) =>
  rot == null ? <span className="sn-none">–</span>
    : <span className={`sn-tag sn-category-tag${rot === 1 ? ' sn-category-tag--high' : rot === 3 ? ' sn-category-tag--vault' : ''}`}>{rot === 1 ? 'High rotation' : ROT[rot]}</span>;

const Heard: React.FC<{ t: LibraryTrack }> = ({ t }) => {
  const names = t.src.map(sourceName).join(', ');
  return (
    <span className="sn-source-badge">
      <span className="sn-source-badge__name" title={names}>
        <SnIcon name="radio-tower" size={14} />{SN.format.count(t.src.length)}
        <span className="sn-sr"> {t.src.length === 1 ? 'show' : 'shows'}: {names}</span>
        {t.chart ? <span className="sn-source-badge__detail" title={`ARIA Club Chart: number ${t.chart.rank}, ${t.chart.weeks} weeks in`}>#{t.chart.rank} · {t.chart.weeks}w</span> : null}
      </span>
    </span>
  );
};

/** "Last heard" is a calendar date: say today, yesterday or "3 d ago" for the past week, else the date; the date is always in the tooltip. */
const LastHeard: React.FC<{ d: string | null }> = ({ d }) => {
  if (!d) return <span className="sn-none">–</span>;
  const noon = melbourneStamp(d, SN.format.time);
  const days = noon ? Math.floor((Date.now() - (noon.getTime() - 12 * 3600000)) / 86400000) : null;
  const label = days == null || days < 0 || days >= 7 ? SN.format.date(d) : days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} d ago`;
  return <time dateTime={d} title={`Last heard ${SN.format.date(d)}`}>{label}</time>;
};

const LibraryPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [lib, setLib] = useState<LibraryFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const stored = useMemo(() => lsGet<Partial<Stored> | null>(FILTERS_KEY, null), []);
  const [filters, setFilters] = useState<CrateFilters>(() => (hasFilterParams(params) ? filtersFromParams(params) : sanitiseFilters(stored?.filters ?? DEFAULT_FILTERS)));
  const [query, setQuery] = useState(filters.q);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>(() => {
    const s = params.get('sort');
    if (s) { const key = s.replace(/^-/, '') as SortKey; if (COLS.some((c) => c.id === key)) return { key, dir: s.startsWith('-') ? 'descending' : 'ascending' }; }
    return stored?.sort && COLS.some((c) => c.id === stored.sort!.key) ? stored.sort : DEFAULT_SORT;
  });
  const [limit, setLimit] = useState(FIRST_BATCH);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const [newFrom, setNewFrom] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bannerGone, setBannerGone] = useState<number | null>(() => lsGet<number | null>(bannerKey('library'), null));
  const searchRef = useRef<HTMLInputElement>(null);
  const { toast, region } = useToaster();
  const { say, node: liveNode } = useAnnouncer();

  useEffect(() => {
    setError(null);
    const t = window.setTimeout(() => setSlow(true), 1000);
    loadLibrary().then(setLib).catch(() => setError('load')).finally(() => window.clearTimeout(t));
    return () => window.clearTimeout(t);
  }, [attempt]);

  const tracks = useMemo(() => (lib ? normaliseTracks(lib.tracks, SN.camelot) : []), [lib]);
  const generated = useMemo(() => melbourneStamp(lib?.generated, SN.format.time), [lib]);
  usePageHeader({ lead: 'Library', title: 'Melbourne crate', current: 'library', updatedAt: generated ?? undefined });

  // Search text follows typing after 150 ms (SearchField).
  useEffect(() => {
    if (query === filters.q) return;
    const t = window.setTimeout(() => { setFilters((f) => ({ ...f, q: query })); setLimit(FIRST_BATCH); }, 150);
    return () => window.clearTimeout(t);
  }, [query, filters.q]);

  // Persist per device and mirror into the URL.
  useEffect(() => {
    lsSet(FILTERS_KEY, { filters, sort });
    const next = filtersToParams(filters);
    if (sort.key !== DEFAULT_SORT.key || sort.dir !== DEFAULT_SORT.dir) next.set('sort', `${sort.dir === 'descending' ? '-' : ''}${sort.key}`);
    if (params.get('focus')) next.set('focus', params.get('focus')!);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort]);

  // A link into this page with filters (figure tile "Review", Set builder "Change filters") wins.
  useEffect(() => {
    if (!hasFilterParams(params)) return;
    const fromUrl = filtersFromParams(params);
    if (filtersToParams(fromUrl).toString() !== filtersToParams(filters).toString()) { setFilters(fromUrl); setQuery(fromUrl.q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // AppHeader search and "/" land here with ?focus=search.
  useEffect(() => {
    if (params.get('focus') !== 'search') return;
    const sheet = window.matchMedia?.('(max-width: 1023.98px)').matches;
    if (sheet) setSheetOpen(true);
    const t = window.setTimeout(() => { searchRef.current?.focus(); searchRef.current?.select(); }, sheet ? 60 : 0);
    const next = new URLSearchParams(params);
    next.delete('focus');
    setParams(next, { replace: true });
    return () => window.clearTimeout(t);
  }, [params, setParams]);

  const rows = useMemo(() => sortTracks(filterTracks(tracks, filters), sort.key, sort.dir), [tracks, filters, sort]);
  const visible = rows.slice(0, limit);

  useEffect(() => {
    if (focusRow == null) return;
    document.querySelector<HTMLElement>(`[data-row="${focusRow}"]`)?.focus();
    setFocusRow(null);
  }, [focusRow, limit]);

  const changeFilters = useCallback((f: CrateFilters) => { setFilters(f); setQuery(f.q); setLimit(FIRST_BATCH); setNewFrom(null); }, []);
  const onSort = (key: SortKey, label: string) => {
    const dir: SortDir = sort.key === key ? (sort.dir === 'ascending' ? 'descending' : 'ascending') : 'ascending';
    setSort({ key, dir });
    say(`Sorted by ${label}, ${dir}, then by artist`);
  };

  const addToSet = (t: LibraryTrack) => {
    const before = readDraft();
    const { draft, result } = addTrack(before, t);
    const name = before.name || 'Untitled set';
    if (result === 'exists') { toast(<>Already in <q>{name}</q></>); return; }
    writeDraft(draft);
    toast(<>Added <q>{t.a} – {t.t}</q> to <q>{name}</q></>, { label: 'Undo', run: () => writeDraft(before) });
  };

  const buildFromCrate = () => {
    const p = filtersToParams(filters);
    p.set('pool', 'crate');
    navigate(`/sets?${p.toString()}`);
  };

  /* ---- figures ---- */
  const keyed = tracks.filter((t) => t.k && t.bpm).length;
  const review = tracks.filter((t) => t.rev).length;
  const lastRun = lib?.runs?.[lib.runs.length - 1];
  const weekAgo = generated ? new Date(generated.getTime() - 7 * 86400000) : null;
  const thisWeek = weekAgo ? tracks.filter((t) => { const d = melbourneStamp(t.last, SN.format.time); return d && d >= weekAgo; }) : [];
  const weekShows = new Set(thisWeek.flatMap((t) => t.src)).size;
  const highRot = tracks.filter((t) => t.rot === 1).length, stdRot = tracks.filter((t) => t.rot === 2).length, vault = tracks.filter((t) => t.rot === 3).length;
  const firstPlay = tracks.reduce<string | null>((a, t) => (t.first && (!a || t.first < a) ? t.first : a), null);
  const historyDays = firstPlay && lib?.ledger_updated ? Math.round((Date.parse(lib.ledger_updated) - Date.parse(firstPlay)) / 86400000) : null;
  const showBanner = !!lib && tracks.length > 0 && keyed < tracks.length * 0.5 && bannerGone !== keyed;
  const nActive = activeFilterCount(filters);

  const rotationNote = (
    <details className="sn-disclosure">
      <summary><span className="sn-disclosure__chev"><SnIcon name="chevron-right" size={16} /></span>How rotation is worked out</summary>
      <div className="sn-disclosure__body">
        <p>High rotation and Vault are worked out by the weekly run from the library’s own play data.</p>
        <p>High: heard on 2 or more different shows in the run window, or on the ARIA Club Chart for 4 weeks or fewer. Everything else heard is Standard. This run: {SN.format.count(highRot)} High, {SN.format.count(stdRot)} Standard.</p>
        <p>Vault: learned once there are 8 weeks of plays{historyDays != null ? ` (${SN.format.count(historyDays)} days so far)` : ''}, so {vault ? `${SN.format.count(vault)} tracks are` : 'no track is'} in the Vault yet.</p>
      </div>
    </details>
  );

  const hidden = tracks.length - rows.length;
  const hiddenBy = [
    ...filters.pillar.map((p) => `Pillar: ${pillarLabel(p)}`),
    ...filters.tier.map((t) => `Energy ${t === 'low' ? '1–4' : t === 'building' ? '5–7' : '8–10'}`),
    filters.q ? `search “${filters.q}”` : null,
  ].filter(Boolean).join(' and ');

  return (
    <main className="sn-page__main sn-page-library sn-ml-library" id="main" tabIndex={-1}>
      <PageHeader
        mod="library"
        lead="Library"
        title="Melbourne crate"
        desc={lib ? <>{SN.format.count(tracks.length)} tracks heard on PBS, 3RRR and triple j, plus the ARIA Club Chart, with TIDAL and Beatport links.</> : 'Every track heard on PBS, 3RRR and triple j, plus the ARIA Club Chart.'}
        stampVerb="Built"
        stamp={generated}
        actions={
          <button className="sn-btn sn-btn--primary" type="button" onClick={buildFromCrate} disabled={!lib}>
            <SnIcon name="list-music" />Build set from crate
          </button>
        }
      />

      {lib ? (
        <div className="sn-figure-tile-row" role="list" aria-label="Library at a glance">
          <div className="sn-figure-tile" role="listitem">
            <span className="sn-figure-tile__figure">{SN.format.count(tracks.length)}</span>
            <span className="sn-figure-tile__label">Tracks in the library</span>
            {lastRun ? <span className="sn-figure-tile__delta">+{SN.format.count(lastRun.added)} added last run</span> : null}
          </div>
          <div className="sn-figure-tile" role="listitem">
            <span className="sn-figure-tile__figure">{SN.format.count(thisWeek.length)}</span>
            <span className="sn-figure-tile__label">Heard this week</span>
            <span className="sn-figure-tile__delta">on {SN.format.count(weekShows)} {weekShows === 1 ? 'show' : 'shows'}</span>
          </div>
          <div className="sn-figure-tile" role="listitem">
            <span className="sn-figure-tile__figure">{SN.format.count(review)}</span>
            <span className="sn-figure-tile__label">Need an energy check</span>
            {review ? (
              <div className="sn-figure-tile__foot">
                <span className="sn-pill sn-status-pill" data-status="warn">To check</span>
                <Link className="sn-link sn-m-library" to={`/library?${filtersToParams({ ...filters, rev: true }).toString()}`}>Review</Link>
              </div>
            ) : null}
          </div>
          <div className="sn-figure-tile" role="listitem">
            <span className="sn-figure-tile__figure">{SN.format.percent(tracks.length ? keyed / tracks.length : 0)}</span>
            <span className="sn-figure-tile__label">Have key and BPM</span>
            <span className="sn-figure-tile__delta">{SN.format.count(keyed)} of {SN.format.count(tracks.length)}</span>
          </div>
        </div>
      ) : (
        <div className="sn-figure-tile-row" role="list" aria-label="Library at a glance" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div className="sn-figure-tile sn-figure-tile--skeleton" role="listitem" key={i}>
              <span className="sn-skel" style={{ ['--w' as string]: '64px', ['--h' as string]: '28px' }} />
              <span className="sn-skel" style={{ ['--w' as string]: '120px', ['--h' as string]: '12px' }} />
            </div>
          ))}
        </div>
      )}

      {showBanner ? (
        <Banner status="warn" title="Sets are shaped on energy alone." dismissLabel="key and BPM notice" onDismiss={() => { setBannerGone(keyed); lsSet(bannerKey('library'), keyed); document.querySelector<HTMLElement>('#main h1')?.focus(); }}>
          {keyed === 0 ? 'None of the' : `Only ${SN.format.count(keyed)} of the`} {SN.format.count(tracks.length)} tracks {keyed === 0 ? 'has' : 'have'} a key and BPM yet, so key moves show as unknown. TIDAL and Deezer don’t supply key or BPM; they fill in once a key and BPM source is added to the weekly run.
        </Banner>
      ) : null}

      <div className="sn-page-library__body">
        <CrateFilterRail
          tracks={tracks}
          filters={filters}
          onChange={changeFilters}
          query={query}
          onQuery={setQuery}
          shown={rows.length}
          searchRef={searchRef}
          open={sheetOpen}
          setOpen={setSheetOpen}
          rotationNote={rotationNote}
        />
        <div className="sn-page-library__crate">
          <div className="sn-data-table sn-data-table--stack">
            <div className="sn-data-table__bar">
              <span className="sn-data-table__count" aria-live="polite">
                {lib ? `${SN.format.count(rows.length)} of ${SN.format.count(tracks.length)} tracks · showing ${SN.format.count(visible.length)}` : 'Loading the crate…'}
              </span>
            </div>
            <div className="sn-tablebox sn-data-table__box">
              <table className="sn-table" aria-busy={!lib && !error ? true : undefined}>
                <caption className="sn-sr">Crate, {SN.format.count(visible.length)} of {SN.format.count(rows.length)} matching tracks. Column headers with buttons are sortable.</caption>
                <thead>
                  <tr>
                    {COLS.map((c) => (
                      <th key={c.id} scope="col" className={c.num ? 'num' : undefined} data-sortable="" aria-sort={sort.key === c.id ? sort.dir : undefined}>
                        <button type="button" onClick={() => onSort(c.id, c.label)} disabled={!lib}>{c.label}</button>
                      </th>
                    ))}
                    <th scope="col" className="sn-data-table__actions"><span className="sn-sr">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {error ? (
                    <tr className="sn-data-table__state">
                      <td colSpan={COLS.length + 1}>
                        <section className="sn-error-state sn-error-state--panel" data-status="warn" role="alert" aria-labelledby="crate-err">
                          <div className="sn-error-state__icon"><SnIcon name="cloud-off" /></div>
                          <h3 className="sn-error-state__title" id="crate-err">The library file didn’t load</h3>
                          <div className="sn-error-state__text">The crate is republished by the weekly run. Your filters are kept.</div>
                          <p className="sn-error-state__retry">Retrying usually works within a minute.</p>
                          <div className="sn-error-state__actions"><button className="sn-btn" type="button" onClick={() => setAttempt((a) => a + 1)}>Try again</button></div>
                        </section>
                      </td>
                    </tr>
                  ) : !lib ? (
                    [0, 1, 2, 3, 4].map((i) => (
                      <tr className="sn-data-table__skel" aria-hidden="true" key={i}>
                        <td><span className="sn-skel" style={{ ['--w' as string]: '96px', ['--h' as string]: '10px' }} /></td>
                        <td className="sn-data-table__track"><span className="sn-loading-state__lines"><span className="sn-skel" style={{ ['--w' as string]: '220px', ['--h' as string]: '12px' }} /><span className="sn-skel" style={{ ['--w' as string]: '140px', ['--h' as string]: '10px' }} /></span></td>
                        {COLS.slice(2).map((c) => <td key={c.id}><span className="sn-skel" style={{ ['--w' as string]: '40px', ['--h' as string]: '10px' }} /></td>)}
                        <td />
                      </tr>
                    ))
                  ) : visible.length === 0 ? (
                    <tr className="sn-data-table__state">
                      <td colSpan={COLS.length + 1}>
                        <EmptyState
                          icon="funnel"
                          title="No tracks match these filters"
                          actions={nActive || filters.q ? <button className="sn-btn" type="button" onClick={() => changeFilters({ ...DEFAULT_FILTERS })}>Clear filters</button> : undefined}
                        >
                          {SN.format.count(hidden)} tracks are hidden{hiddenBy ? ` by ${hiddenBy}` : ' by the current filters'}.
                        </EmptyState>
                      </td>
                    </tr>
                  ) : (
                    visible.map((t, i) => {
                      const name = `${t.a} – ${t.t}`;
                      return (
                        <tr key={t.id} data-flag={t.rev ? '' : undefined} data-row={i} tabIndex={i >= FIRST_BATCH ? -1 : undefined} className={newFrom != null && i >= newFrom ? 'sn-show-more__new' : undefined}>
                          <td data-label="Energy"><EnergyBar value={t.e} /></td>
                          <td className="sn-data-table__track"><TrackCell t={t} /></td>
                          <td className="num" data-label="BPM"><Bpm value={t.bpm} /></td>
                          <td data-label="Key"><KeyBadge value={t.k} /></td>
                          <td data-label="Pillar">{t.p ? <span className="sn-tag sn-category-tag">{pillarLabel(t.p)}</span> : <span className="sn-none">–</span>}</td>
                          <td data-label="Rotation"><RotationTag rot={t.rot} /></td>
                          <td className="num" data-label="Heard"><Heard t={t} /></td>
                          <td className="num" data-label="Last heard"><LastHeard d={t.last} /></td>
                          <td className="sn-data-table__actions">
                            <button className="sn-btn sn-btn--quiet sn-btn--sm sn-btn--icon" type="button" aria-label={`Add ${name} to set`} title={`Add ${name} to set`} onClick={() => addToSet(t)}>
                              <SnIcon name="plus" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!lib && !error && slow ? <p className="sn-loading-state__msg" role="status">Loading the crate…</p> : null}
          </div>
          {lib && rows.length > 0 ? (
            <div className="sn-show-more">
              <span className="sn-show-more__count" role="status">Showing <b>{SN.format.count(visible.length)}</b> of <b>{SN.format.count(rows.length)}</b> tracks</span>
              {rows.length > visible.length ? (
                <div className="sn-show-more__actions">
                  <button className="sn-btn sn-btn--sm" type="button" onClick={() => { setFocusRow(limit); setNewFrom(limit); setLimit((l) => l + NEXT_BATCH); }}>
                    {rows.length - visible.length <= NEXT_BATCH ? `Show the last ${SN.format.count(rows.length - visible.length)}` : `Show ${SN.format.count(NEXT_BATCH)} more`}
                  </button>
                  {rows.length <= 2000 && rows.length - visible.length > NEXT_BATCH ? (
                    <button className="sn-btn sn-btn--sm sn-btn--quiet" type="button" onClick={() => { setFocusRow(limit); setNewFrom(limit); setLimit(rows.length); }}>Show all {SN.format.count(rows.length)}</button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {liveNode}
      {region}
    </main>
  );
};

export default LibraryPage;
