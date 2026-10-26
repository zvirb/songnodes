/**
 * Set builder (/sets), design-system SetBuilderPage, ported from the Naarm Set Builder.
 * Controls, energy wave, running order with transition notes and spares, saved sets, export for
 * the weekly run. The draft autosaves on this device (sn-set-draft); "Save set" writes the saved
 * sets list in the artifact's document shape (readSavedSets / writeSavedSets).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageHeader } from '../../shell/AppShell';
import { PageHeader, EmptyState } from '../../shell/PageParts';
import { SN, SnIcon, KeyBadge, Bpm, CompatPill, type CompatLevel } from '../../lib/songnodes';
import { loadLibrary, readSavedSetsAsync, writeSavedSetsAsync, readSavedSets, writeSavedSets, type LibraryFile, type LibraryTrack, type SavedSet } from './data';
import {
  MAX_MINUTES, MIN_MINUTES, PILLARS, POOLS, SHAPES, buildSlots, countPeaks, draftFromSaved, filtersFromParams, filtersToParams,
  genreRunBefore, mixTotal, mixedSecs, newSetId, normaliseMix, pillarLabel, poolTracks, removeSlot, retarget,
  savedSetFromDraft, shapeOf, slotCount, spares, tracklistText, waveIssues, type Draft, type PoolKey,
} from './setBuilder';
import { bannerKey, downloadJson, lsGet, lsSet, melbourneStamp, normaliseTracks, readDraft, writeDraft } from './storage';
import { Banner, ConfirmDialog, CopyButton, NumberField, OverflowMenu, Switch, TrackCell, useAnnouncer, useToaster } from './components/ui';
import { EnergyWave, type WaveSlot } from './components/EnergyWave';
import { ExportDialog } from '../setBuilder/ExportDialog';
import { reorderTracks } from '../setBuilder/reorder';
import './musicLibrary.css';

type Verdict = { level: CompatLevel; label: string };
const RANK: Record<string, number> = { perfect: 0, compatible: 1, possible: 2, clash: 3 };
const WIDE = '(min-width: 1100px)';

/** Energy meter with the slot's target segment outlined (SetSlot "off target"). */
const SlotEnergy: React.FC<{ e: number | null; tgt: number }> = ({ e, tgt }) => (
  <>
    <span className="sn-energy sn-energy-bar">
      <span className="sn-energy__bar" aria-hidden="true">
        {Array.from({ length: 10 }, (_, k) => <i key={k} className={`${e != null && k < e ? 'on' : ''}${k + 1 === tgt ? ' target' : ''}`.trim() || undefined} />)}
      </span>
      {e != null ? <span className="sn-energy__n">{e}</span> : <span className="sn-none">–</span>}
      <span className="sn-sr">{e != null ? ` of 10, target ${tgt}` : `Energy not set, target ${tgt}`}</span>
    </span>
    <span className="sn-energy-bar__target" aria-hidden="true">
      target {tgt}{e != null && e !== tgt ? ` · ${Math.abs(e - tgt)} ${e < tgt ? 'under' : 'over'}` : ''}
    </span>
  </>
);

const SetBuilderPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [lib, setLib] = useState<LibraryFile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraftState] = useState<Draft>(readDraft);
  const [saved, setSavedState] = useState<SavedSet[]>(readSavedSets);
  const [openSpares, setOpenSpares] = useState<Set<number>>(new Set());
  const [toDelete, setToDelete] = useState<SavedSet | null>(null);
  const [armedNew, setArmedNew] = useState(false);
  const [bannerGone, setBannerGone] = useState<number | null>(() => lsGet<number | null>(bannerKey('sets'), null));
  const [controlsOpen, setControlsOpen] = useState(() => !(typeof window !== 'undefined' && !window.matchMedia?.(WIDE).matches && readDraft().slots.length));
  const [exportingSet, setExportingSet] = useState<SavedSet | null>(null);
  const [tidalSaved, setTidalSaved] = useState<string | null>(null);
  const { toast, region } = useToaster();
  const { say, node: liveNode } = useAnnouncer();
  const focusAfter = useRef<string | null>(null);

  const setDraft = useCallback((u: Draft | ((d: Draft) => Draft)) => {
    setDraftState((d) => { const next = typeof u === 'function' ? (u as (d: Draft) => Draft)(d) : u; writeDraft(next); return next; });
  }, []);
  const setSaved = useCallback((s: SavedSet[]) => { setSavedState(s); writeSavedSetsAsync(s); }, []);

  useEffect(() => {
    setLoadError(false);
    loadLibrary().then(setLib).catch(() => setLoadError(true));
  }, [attempt]);

  const tracks = useMemo(() => (lib ? normaliseTracks(lib.tracks, SN.camelot) : []), [lib]);
  const byId = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const generated = useMemo(() => melbourneStamp(lib?.generated, SN.format.time), [lib]);

  // Slots whose track left the library are cleared once the library is in (artifact boot).
  useEffect(() => {
    if (!lib) return;
    setDraft((d) => (d.slots.some((s) => s.id && !byId.has(s.id)) ? { ...d, slots: d.slots.map((s) => (s.id && !byId.has(s.id) ? { ...s, id: null } : s)) } : d));
  }, [lib, byId, setDraft]);

  // Intake from links: ?open=<saved id>, or ?pool=crate&<library filters> from "Build set from crate".
  useEffect(() => {
    const open = params.get('open'), pool = params.get('pool');
    if (!open && pool !== 'crate') return;
    if (open) {
      const s = readSavedSets().find((x) => x.id === open);
      if (s) { setDraft(draftFromSaved(s, byId)); setOpenSpares(new Set()); toast(<>Opened <q>{s.name}</q></>); }
      else toast('That saved set is no longer on this device.');
    } else {
      const crate = filtersFromParams(params);
      setDraft((d) => ({ ...d, pool: 'crate', crate }));
      say('Pool set to the filtered crate from the library');
    }
    setParams(new URLSearchParams(), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const name = draft.name.trim() || 'Untitled set';
  usePageHeader({ lead: 'Set builder', title: name, current: 'sets', updatedAt: generated ?? undefined });

  /* ---- derived ---- */
  const shape = shapeOf(draft.shape);
  const items = draft.slots.map((s) => ({ s, t: s.id ? byId.get(s.id) ?? null : null }));
  const ts = items.map((x) => x.t);
  const filled = ts.filter((t): t is LibraryTrack => !!t);
  const secs = mixedSecs(ts);
  const es = ts.map((t) => t?.e ?? null);
  const issues = waveIssues(es);
  const peaks = countPeaks(filled.map((t) => t.e ?? 0));
  const savedDoc = draft.id ? saved.find((s) => s.id === draft.id) ?? null : null;
  const keyed = tracks.filter((t) => t.k && t.bpm).length;
  const showBanner = !!lib && tracks.length > 0 && keyed < tracks.length * 0.5 && bannerGone !== keyed;
  const total = mixTotal(draft.mix);
  const mixLine = PILLARS.map((p) => `${p.label} ${draft.mix[p.id] ?? 0}`).join(' · ');
  const poolCounts = useMemo(() => {
    const out = {} as Record<PoolKey, number>;
    for (const p of POOLS) out[p.id] = poolTracks(tracks, { pool: p.id, mix: draft.mix, crate: draft.crate }).length;
    return out;
  }, [tracks, draft.mix, draft.crate]);

  const notes: (Verdict[] | null)[] = items.map(({ t }, i) => {
    const p = i ? items[i - 1].t : null;
    if (!i || !p || !t) return null;
    const before = i > 1 ? items[i - 2].t?.e ?? undefined : undefined;
    const out: Verdict[] = [SN.energyStep(p.e ?? 0, t.e ?? 0, before), SN.compat(p.k ?? '', t.k ?? ''), SN.bpmStep(p.bpm ?? 0, t.bpm ?? 0)];
    if (t.p !== p.p) {
      const building = (t.e ?? 0) >= 5 && (t.e ?? 0) <= 7, run = genreRunBefore(ts, i);
      out.push({ level: building && run >= 3 ? 'perfect' : 'possible', label: `${pillarLabel(p.p)} → ${pillarLabel(t.p)}` });
    }
    return out;
  });
  const worst = notes.map((n) => (n ? n.filter((v) => v.level in RANK).sort((a, b) => RANK[b.level] - RANK[a.level])[0] ?? null : null));
  const tally = (lvl: CompatLevel) => worst.filter((w) => w?.level === lvl).length;
  const bpms = filled.map((t) => t.bpm).filter((b): b is number => !!b);
  const keys = filled.map((t) => t.k).filter(Boolean) as string[];

  const waveSlots: WaveSlot[] = items.map(({ s, t }, i) => ({
    e: t?.e ?? null, tgt: s.tgt, name: t ? `${t.a} – ${t.t}` : null,
    step: notes[i] ? notes[i]![0] : null,
  }));
  const waveDesc = filled.length
    ? `Energy runs from ${filled[0].e ?? '–'} to ${filled[filled.length - 1].e ?? '–'} across ${draft.slots.length} slots with ${peaks} ${peaks === 1 ? 'peak' : 'peaks'}.${issues.length ? ` Transitions to look at: slot ${issues.map((i) => i + 1).join(', ')}.` : ' No wave problems.'}`
    : 'No tracks yet.';

  /* ---- actions ---- */
  const build = (seed = draft.seed) => {
    if (!tracks.length) return;
    const d = { ...draft, seed, minutes: Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, draft.minutes)) };
    const slots = buildSlots(tracks, d, true, byId);
    setDraft({ ...d, slots });
    setOpenSpares(new Set());
    const n = slots.filter((s) => s.id).length;
    toast(<>{seed === draft.seed ? 'Built' : 'New take of'} <q>{name}</q>: {SN.format.count(n)} tracks, {SN.format.span(mixedSecs(slots.map((s) => byId.get(s.id ?? ''))))}.</>);
    if (!window.matchMedia?.(WIDE).matches) setControlsOpen(false);
  };

  const save = () => {
    if (!filled.length) { toast('Add tracks before saving.'); return; }
    const prev = saved, prevId = draft.id;
    const doc = savedSetFromDraft(draft, byId, saved);
    const next = [doc, ...saved.filter((s) => s.id !== doc.id)];
    setSaved(next);
    setDraft((d) => ({ ...d, id: doc.id }));
    toast(<>Saved <q>{doc.name}</q> · {SN.format.count(doc.tracks.length)} tracks, {SN.format.span(secs)}</>, {
      label: 'Undo', run: () => { setSaved(prev); setDraft((d) => ({ ...d, id: prevId })); },
    });
  };

  const duplicate = (s: SavedSet) => {
    const now = new Date();
    const copy: SavedSet = { ...s, id: newSetId(now.getTime()), name: `${s.name} (copy)`, tidal: false, created: now.toISOString(), updated: now.toISOString(), tracks: s.tracks.map((t) => ({ ...t })) };
    setSaved([copy, ...saved]);
    toast(<>Duplicated <q>{s.name}</q></>);
  };

  const confirmDelete = () => {
    const s = toDelete;
    if (!s) return;
    setSaved(saved.filter((x) => x.id !== s.id));
    if (draft.id === s.id) setDraft((d) => ({ ...d, id: null }));
    setToDelete(null);
    toast(<>Deleted <q>{s.name}</q>. Its tracks stay in the library.</>);
  };

  const exportSets = () => {
    const sets = readSavedSets();
    downloadJson('artifact_sets.json', sets);
    toast(<>Exported {SN.format.count(sets.length)} {sets.length === 1 ? 'set' : 'sets'} as <span className="sn-mono">artifact_sets.json</span></>);
  };

  useEffect(() => { if (!armedNew) return; const t = window.setTimeout(() => setArmedNew(false), 3000); return () => window.clearTimeout(t); }, [armedNew]);
  const newEmpty = () => {
    if (draft.slots.length && !armedNew) { setArmedNew(true); say('Press again within 3 seconds to clear the draft'); return; }
    setArmedNew(false);
    setDraft((d) => ({ ...d, id: null, name: 'New set', slots: [], seed: 1 }));
    setOpenSpares(new Set());
    toast('Draft cleared. Shape, length, genre mix and pool are kept.');
  };

  const setTidal = (on: boolean) => {
    setDraft((d) => ({ ...d, tidal: on }));
    if (savedDoc) {
      setSaved(saved.map((s) => (s.id === savedDoc.id ? { ...s, tidal: on, updated: new Date().toISOString() } : s)));
      setTidalSaved(`Saved ${SN.format.time(new Date())}`);
    }
    say(on ? 'Sends to TIDAL on the weekly run' : 'Won’t send to TIDAL');
  };

  const slotName = (i: number) => { const t = items[i]?.t; return t ? `${t.a} – ${t.t}` : `slot ${i + 1}`; };
  const toggleLock = (i: number) => {
    setDraft((d) => ({ ...d, slots: d.slots.map((s, k) => (k === i ? { ...s, lock: !s.lock } : s)) }));
    say(`Slot ${i + 1} ${draft.slots[i].lock ? 'unlocked' : 'locked'}`);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.slots.length || draft.slots[i].lock || draft.slots[j].lock) return;
    const nm = slotName(i);
    setDraft((d) => ({ ...d, slots: reorderTracks(d.slots, i, dir) }));
    setOpenSpares(new Set());
    focusAfter.current = `[data-slot="${j}"] [data-act="${dir < 0 ? 'up' : 'down'}"]`;
    say(`${nm} moved to slot ${j + 1}`);
  };
  const remove = (i: number) => {
    const before = draft, nm = slotName(i);
    setDraft((d) => ({ ...d, slots: removeSlot(d, i) }));
    setOpenSpares(new Set());
    toast(<>Removed <q>{nm}</q> from slot {i + 1}</>, { label: 'Undo', run: () => setDraft(before) });
  };
  const swapIn = (i: number, t: LibraryTrack) => {
    setDraft((d) => ({ ...d, slots: d.slots.map((s, k) => (k === i ? { ...s, id: t.id, lock: true } : s)) }));
    setOpenSpares((o) => { const n = new Set(o); n.delete(i); return n; });
    focusAfter.current = `[data-slot="${i}"] [data-act="lock"]`;
    say(`${t.a} – ${t.t} swapped into slot ${i + 1} and locked`);
  };
  useEffect(() => {
    if (!focusAfter.current) return;
    const el = document.querySelector<HTMLElement>(focusAfter.current);
    focusAfter.current = null;
    if (el && !(el as HTMLButtonElement).disabled) el.focus();
  });

  /* ---- render ---- */
  const btn = (icon: string, label: string, onClick: () => void, opts: { pressed?: boolean; disabled?: boolean; act?: string; expanded?: boolean } = {}) => (
    <button
      className="sn-btn sn-btn--quiet sn-btn--sm sn-btn--icon"
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={opts.pressed}
      aria-expanded={opts.expanded}
      disabled={opts.disabled}
      data-act={opts.act}
      onClick={onClick}
    >
      <SnIcon name={icon} />
    </button>
  );

  const order: React.ReactNode[] = [];
  items.forEach(({ s, t }, i) => {
    const n = i + 1;
    const prevLocked = i > 0 && draft.slots[i - 1].lock, nextLocked = i < items.length - 1 && draft.slots[i + 1].lock;
    if (i > 0 && notes[i]) {
      order.push(
        <li key={`n${i}`} aria-label={`Transition ${i} to ${n}`}>
          <div className="sn-transition-note" role="note">
            {notes[i]!.map((v, k) => (
              <span className="sn-transition-note__item" data-level={v.level} key={k} title={v.label}>{v.label}<span className="sn-sr"> ({v.level})</span></span>
            ))}
          </div>
        </li>,
      );
    }
    if (!t) {
      order.push(
        <li key={`s${i}`} className="sn-set-slot sn-set-slot--empty" data-slot={i} aria-label={`Slot ${n}: empty`}>
          <span className="sn-set-slot__n">{n}</span>
          <span className="sn-set-slot__energy"><SlotEnergy e={null} tgt={s.tgt} /></span>
          <span className="sn-set-slot__empty">No track in the pool fits energy {s.tgt} here. Widen the pool, or add one from the library.</span>
          <span className="sn-set-slot__act">
            {btn('arrow-up', `Move slot ${n} up`, () => move(i, -1), { disabled: s.lock || i === 0 || prevLocked, act: 'up' })}
            {btn('arrow-down', `Move slot ${n} down`, () => move(i, 1), { disabled: s.lock || i === items.length - 1 || nextLocked, act: 'down' })}
            {btn('x', `Remove empty slot ${n}`, () => remove(i), { act: 'remove' })}
          </span>
        </li>,
      );
      return;
    }
    const nm = `${t.a} – ${t.t}`;
    const sparesOpen = openSpares.has(i);
    order.push(
      <li key={`s${i}`} className="sn-set-slot" data-slot={i} data-locked={s.lock ? '' : undefined} aria-label={`Slot ${n}: ${nm}${s.lock ? ', locked' : ''}`}>
        <span className="sn-set-slot__n">{n}</span>
        <span className="sn-set-slot__energy"><SlotEnergy e={t.e} tgt={s.tgt} /></span>
        <span className="sn-set-slot__track"><TrackCell t={t} extra={pillarLabel(t.p)} links={false} /></span>
        <span className="sn-set-slot__data">
          <span className="sn-ml-slot-bk"><Bpm value={t.bpm} /><KeyBadge value={t.k} /></span>
          <button className="sn-btn sn-btn--quiet sn-btn--sm" type="button" data-act="spares" aria-expanded={sparesOpen} aria-label={`Spares for slot ${n}`} onClick={() => setOpenSpares((o) => { const x = new Set(o); if (x.has(i)) x.delete(i); else x.add(i); return x; })}>
            <SnIcon name="shuffle" />Spares
          </button>
        </span>
        <span className="sn-set-slot__act">
          {btn(s.lock ? 'lock' : 'lock-open', `Lock slot ${n}`, () => toggleLock(i), { pressed: s.lock, act: 'lock' })}
          {btn('arrow-up', `Move slot ${n} up`, () => move(i, -1), { disabled: s.lock || i === 0 || prevLocked, act: 'up' })}
          {btn('arrow-down', `Move slot ${n} down`, () => move(i, 1), { disabled: s.lock || i === items.length - 1 || nextLocked, act: 'down' })}
          {btn('x', `Remove ${nm} from slot ${n}`, () => remove(i), { disabled: s.lock, act: 'remove' })}
        </span>
      </li>,
    );
    if (sparesOpen) {
      const sp = spares(tracks, draft, i, byId);
      order.push(
        <li key={`p${i}`}>
          <div className="sn-set-slot__spares">
            <span className="sn-set-slot__spares-label">{sp.length ? `Spares for slot ${n}:` : `No spares within one energy point of slot ${n} in this pool.`}</span>
            {sp.map((x) => (
              <button className="sn-set-slot__spare" type="button" key={x.id} aria-label={`Swap in ${x.a} – ${x.t}`} onClick={() => swapIn(i, x)}>
                <span>{x.a} – {x.t}</span>
                <span className="sn-mono sn-dim">{x.e ?? '–'}</span>
                <KeyBadge value={x.k} />
              </button>
            ))}
          </div>
        </li>,
      );
    }
  });

  const menuItems = [
    { id: 'save', icon: 'save', label: 'Save set', cls: 'sn-page-header__narrow-only' },
    ...(savedDoc ? [{ id: 'export-single', icon: 'download', label: 'Export this set…' }] : []),
    { id: 'export', icon: 'download', label: 'Export sets for the weekly run' },
    ...(savedDoc ? [{ id: 'delete', icon: 'trash-2', label: 'Delete set…', danger: true }] : []),
  ];

  return (
    <main className="sn-page__main sn-page-sets sn-ml-sets" id="main" tabIndex={-1}>
      <PageHeader
        mod="sets"
        lead="Set builder"
        title={name}
        desc={`${shape.name} over ${draft.minutes} min: ${SN.format.count(filled.length)} tracks, ${mixLine}.`}
        stampVerb="Saved"
        stamp={savedDoc?.updated ?? null}
        pill={savedDoc && savedDoc.tidal ? <span className="sn-pill sn-status-pill" data-status="idle">Queued for the weekly run</span> : undefined}
        actions={
          <>
            <button className="sn-btn sn-page-header__secondary" type="button" onClick={save}><SnIcon name="save" />Save set</button>
            <OverflowMenu label="More actions" heading="Set" items={menuItems} onSelect={(id) => { if (id === 'save') save(); if (id === 'export') exportSets(); if (id === 'export-single' && savedDoc) setExportingSet(savedDoc); if (id === 'delete' && savedDoc) setToDelete(savedDoc); }} />
            <button className="sn-btn sn-btn--primary" type="button" onClick={() => build()} disabled={!lib}><SnIcon name="wand-sparkles" />Build set</button>
          </>
        }
      />

      {showBanner ? (
        <Banner status="warn" title="Sets are shaped on energy alone." dismissLabel="key and BPM notice" onDismiss={() => { setBannerGone(keyed); lsSet(bannerKey('sets'), keyed); document.querySelector<HTMLElement>('#main h1')?.focus(); }}>
          {keyed === 0 ? 'None of the' : `Only ${SN.format.count(keyed)} of the`} {SN.format.count(tracks.length)} tracks {keyed === 0 ? 'has' : 'have'} a key and BPM yet, so key moves and BPM gaps show as unknown. They fill in once a key and BPM source is added to the weekly run.
        </Banner>
      ) : null}

      {loadError ? (
        <section className="sn-error-state" data-status="warn" role="alert" aria-labelledby="sets-err">
          <div className="sn-error-state__icon"><SnIcon name="cloud-off" /></div>
          <h3 className="sn-error-state__title" id="sets-err">The library file didn’t load</h3>
          <div className="sn-error-state__text">Sets can’t be built until the crate is in. Your draft and saved sets are kept on this device.</div>
          <p className="sn-error-state__retry">Retrying usually works within a minute.</p>
          <div className="sn-error-state__actions"><button className="sn-btn" type="button" onClick={() => setAttempt((a) => a + 1)}>Try again</button></div>
        </section>
      ) : null}

      <div className="sn-page-sets__layout">
        <div className="sn-page-sets__side">
          <section className="sn-card sn-m-sets sn-page-sets__controls" aria-labelledby="ctl-t">
            <details className="sn-disclosure" open={controlsOpen} onToggle={(e) => setControlsOpen((e.currentTarget as HTMLDetailsElement).open)}>
              <summary>
                <span className="sn-disclosure__chev"><SnIcon name="chevron-right" size={16} /></span>
                <h2 className="sn-title title-s" id="ctl-t">Set controls</h2>
              </summary>
              <div className="sn-disclosure__body sn-page-sets__controls">
                <div className="sn-field sn-text-field">
                  <label className="sn-text-field__label" htmlFor="set-name">
                    <span>Set name</span>
                    <span className="sn-text-field__count" aria-hidden="true" data-over={draft.name.length > 80 ? '' : undefined}>{draft.name.length} / 80</span>
                  </label>
                  <input className="sn-input" id="set-name" value={draft.name} maxLength={80} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                </div>
                <div className="sn-field sn-select-field">
                  <label htmlFor="set-shape">Shape</label>
                  <select className="sn-select" id="set-shape" value={draft.shape} onChange={(e) => setDraft((d) => ({ ...d, shape: e.target.value, slots: retarget(d.slots, e.target.value) }))}>
                    {Object.entries(SHAPES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                  </select>
                </div>
                <NumberField
                  id="set-length"
                  label="Length"
                  unit="min"
                  value={draft.minutes}
                  min={MIN_MINUTES}
                  max={MAX_MINUTES}
                  step={10}
                  range={`${MIN_MINUTES}–${MAX_MINUTES} min · ${SN.format.count(slotCount(draft.minutes))} slots`}
                  onChange={(v) => setDraft((d) => ({ ...d, minutes: v }))}
                />
                <fieldset className="sn-page-sets__mix" aria-describedby="mix-help">
                  <legend>Genre mix</legend>
                  {PILLARS.map((p) => (
                    <NumberField key={p.id} id={`mix-${p.id}`} label={p.label} unit="%" value={draft.mix[p.id] ?? 0} min={0} max={100} step={5} onChange={(v) => setDraft((d) => ({ ...d, mix: { ...d.mix, [p.id]: v } }))} />
                  ))}
                </fieldset>
                <span className="sn-field__help" id="mix-help">Adds up to 100%. A pillar at 0% is left out. Genre switches happen in the Building tier after a run of 3 or more.</span>
                {total !== 100 ? (
                  <p className="sn-inline-message" data-status="warn">
                    The mix adds up to {total}%. Shares are scaled to 100% when the set is built.{' '}
                    <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={() => setDraft((d) => ({ ...d, mix: normaliseMix(d.mix) }))}>Scale to 100%</button>
                  </p>
                ) : null}
                <div className="sn-field sn-select-field">
                  <label htmlFor="set-pool">Pool</label>
                  <select className="sn-select" id="set-pool" value={draft.pool} onChange={(e) => setDraft((d) => ({ ...d, pool: e.target.value as PoolKey }))}>
                    {POOLS.filter((p) => p.id !== 'crate' || draft.crate).map((p) => (
                      <option key={p.id} value={p.id}>{p.label}{lib ? ` (${SN.format.count(poolCounts[p.id])})` : ''}</option>
                    ))}
                  </select>
                  {draft.crate ? (
                    <span className="sn-field__help">
                      <Link className="sn-link sn-m-library" to={`/library?${filtersToParams(draft.crate).toString() || 'rot=1,2'}`}>Change the crate filters in the library</Link>
                    </span>
                  ) : (
                    <span className="sn-field__help">To build from a filtered crate, filter the <Link className="sn-link sn-m-library" to="/library">library</Link> and choose Build set from crate.</span>
                  )}
                </div>
                <Switch
                  label="Send to TIDAL on the weekly run"
                  desc={`The weekly run copies this set into TIDAL as a playlist named “SET · ${name}”.${savedDoc ? '' : ' Applies once the set is saved.'}`}
                  saved={savedDoc ? tidalSaved ?? undefined : undefined}
                  checked={draft.tidal}
                  onChange={setTidal}
                />
                <div className="sn-card__foot">
                  <button className={`sn-btn sn-btn--quiet${armedNew ? ' sn-confirm-dialog__armed' : ''}`} type="button" data-armed={armedNew ? '' : undefined} onClick={newEmpty} onBlur={() => setArmedNew(false)}>
                    {armedNew ? 'Clear the current draft?' : 'New empty set'}
                  </button>
                </div>
                <p className="sn-page-sets__note">The draft is kept on this device as you work. Save set adds it to Saved sets.</p>
              </div>
            </details>
          </section>
        </div>

        <div className="sn-page-sets__work">
          <section className="sn-card sn-m-sets" aria-labelledby="wave-t">
            <EnergyWave
              titleId="wave-t"
              title={<h2 className="sn-title title-s" id="wave-t"><span className="sn-lead">Energy wave:</span> {name}</h2>}
              sub={`Energy per slot, 1–10 · ${SN.format.count(filled.length)} tracks · about ${SN.format.span(secs)} mixed · ${shape.short.toLowerCase()}`}
              slots={waveSlots}
              desc={waveDesc}
              empty={
                <>
                  <p className="sn-chart-frame__state-title">No tracks in this set yet</p>
                  <p className="sn-chart-frame__state-help">Build set fills {SN.format.count(slotCount(draft.minutes))} slots on the {shape.short.toLowerCase()} wave, or add tracks from the library with +.</p>
                  <button className="sn-btn sn-btn--lg" type="button" onClick={() => build()} disabled={!lib}><SnIcon name="wand-sparkles" />Build set</button>
                </>
              }
            />
          </section>

          {draft.slots.length ? (
            <p className="sn-page-sets__summary">
              <span className="sn-mono">
                {SN.format.count(filled.length)} tracks · about {SN.format.span(secs)} mixed · {peaks} {peaks === 1 ? 'peak' : 'peaks'}
                {bpms.length ? ` · ${SN.format.bpm(Math.min(...bpms))}–${SN.format.bpm(Math.max(...bpms))} BPM` : ''}
                {keys.length > 1 ? ` · ${keys[0]} → ${keys[keys.length - 1]}` : ''}
              </span>
              {tally('perfect') ? <CompatPill level="perfect" label={`${tally('perfect')} smooth`} /> : null}
              {tally('compatible') ? <CompatPill level="compatible" label={`${tally('compatible')} compatible`} /> : null}
              {tally('possible') ? <CompatPill level="possible" label={`${tally('possible')} possible`} /> : null}
              {tally('clash') ? <CompatPill level="clash" label={`${tally('clash')} ${tally('clash') === 1 ? 'clash' : 'clashes'}`} /> : null}
            </p>
          ) : null}

          <section className="sn-page__section" aria-labelledby="ro-t">
            <div className="sn-section-heading sn-section-heading--rule">
              <h2 className="sn-title title-m" id="ro-t"><span className="sn-lead">Running order:</span> {SN.format.count(draft.slots.length)} {draft.slots.length === 1 ? 'slot' : 'slots'}</h2>
              <div className="sn-section-heading__end sn-ml-actions">
                <button className="sn-btn sn-btn--sm" type="button" onClick={() => build((draft.seed || 1) + 1)} disabled={!lib}><SnIcon name="shuffle" />Try another take</button>
                {draft.slots.length ? <CopyButton size="sm" label="Copy tracklist" what="Tracklist" getText={() => tracklistText(draft, byId)} /> : null}
              </div>
              <p className="sn-section-heading__caveat">Energy climbs one point at a time and holds; after a peak it drops two or three at once. Locked slots stay put when you rebuild.</p>
            </div>
            {draft.slots.length ? (
              <ol className="sn-set-slot-list" aria-label={`Running order, ${name}`}>{order}</ol>
            ) : (
              <EmptyState icon="list-music" title="No tracks yet">
                Build set fills the running order from the pool. Tracks you add from the library with + land here too.
              </EmptyState>
            )}
          </section>
        </div>

        <aside className="sn-page__section sn-page-sets__aside" aria-labelledby="saved-t">
          <div className="sn-section-heading">
            <h2 className="sn-title title-s" id="saved-t">Saved sets</h2>
            <span className="sn-section-heading__count">{SN.format.count(saved.length)}</span>
          </div>
          {saved.length ? (
            <div className="sn-page-sets__saved sn-m-sets">
              {saved.map((s, i) => {
                const es2 = s.tracks.map((t) => byId.get(t.id)?.e ?? t.e ?? null).filter((e): e is number => e != null);
                const pk = countPeaks(es2);
                const current = s.id === draft.id;
                return (
                  <article className="sn-card sn-card--tonal sn-set-card" aria-labelledby={`set-${i}`} key={s.id}>
                    <div className="sn-card__head"><span className="sn-tag sn-category-tag">{shapeOf(s.shape).short}</span></div>
                    <h3 className="sn-set-card__name" id={`set-${i}`}>{s.name}</h3>
                    <div className="sn-set-card__stats">
                      <span>{SN.format.span(mixedSecs(s.tracks.map((t) => byId.get(t.id) ?? { d: null })))}</span>
                      <span>{SN.format.count(s.tracks.length)} tracks</span>
                      <span>{pk ? `${pk} ${pk === 1 ? 'peak' : 'peaks'}` : 'no peak'}</span>
                    </div>
                    <div className="sn-set-card__wave" role="img" aria-label={`Energy wave: ${es2.join(', ') || 'no energy data'}`}>
                      {es2.map((e, k) => <i key={k} data-e={e} style={{ height: `${e * 10}%` }} />)}
                    </div>
                    <div className="sn-set-card__meta">
                      {s.tidal ? <span className="sn-pill sn-status-pill" data-status="idle">Queued for the weekly run</span> : <span className="sn-pill sn-status-pill" data-status="idle">Not sent to TIDAL</span>}
                    </div>
                    <div className="sn-set-card__meta">
                      <time dateTime={s.updated} title={SN.format.stamp(s.updated)}>Updated {SN.format.relative(s.updated)}</time>
                    </div>
                    <div className="sn-card__foot">
                      <Link className="sn-link sn-m-sets" to={`/sets?open=${encodeURIComponent(s.id)}`} aria-current={current ? 'page' : undefined}>{current ? 'Open now' : 'Open set'}</Link>
                      <button className="sn-btn sn-btn--sm" type="button" aria-label={`Duplicate ${s.name}`} onClick={() => duplicate(s)}><SnIcon name="copy" />Duplicate</button>
                      <button className="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet" type="button" aria-label={`Delete ${s.name}…`} title={`Delete ${s.name}…`} onClick={() => setToDelete(s)}><SnIcon name="trash-2" /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="list-music" title="No saved sets yet">Build a set and save it to see it here.</EmptyState>
          )}
          <div className="sn-card sn-card--flat sn-ml-export">
            <p className="sn-page-sets__note">Saved sets live on this device. Export them as <span className="sn-mono">artifact_sets.json</span> into <span className="sn-mono">musicLibrary/inbox/</span> and the weekly run adds them to the library database and sends the ones marked for TIDAL.</p>
            <div><button className="sn-btn sn-btn--sm" type="button" onClick={exportSets} disabled={!saved.length}><SnIcon name="download" />Export sets for the weekly run</button></div>
          </div>
        </aside>
      </div>

      <ExportDialog
        open={!!exportingSet}
        set={exportingSet}
        byId={byId}
        onClose={() => setExportingSet(null)}
      />
      <ConfirmDialog
        open={!!toDelete}
        title={toDelete ? `Delete “${toDelete.name}”?` : ''}
        text={<>This removes the saved set from this device. Its {SN.format.count(toDelete?.tracks.length ?? 0)} tracks stay in the library.</>}
        facts={toDelete?.tidal ? ['It is no longer sent to TIDAL on the weekly run. A playlist already made stays in TIDAL.'] : undefined}
        confirmLabel="Delete set"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
      {liveNode}
      {region}
      <div className="sn-mb-credit" style={{ textAlign: "center", color: "var(--text-2)", fontSize: "0.875rem", padding: "var(--spacing-md)", borderTop: "1px solid var(--surface-2)", marginTop: "var(--spacing-xl)" }}>Data from MusicBrainz (musicbrainz.org); tags CC BY-NC-SA 3.0</div>
      <div className="sn-mb-credit" style={{ textAlign: "center", color: "var(--text-2)", fontSize: "0.875rem", padding: "var(--spacing-md)", borderTop: "1px solid var(--surface-2)", marginTop: "var(--spacing-xl)" }}>Data from MusicBrainz (musicbrainz.org); tags CC BY-NC-SA 3.0</div>
      <div className="sn-mb-credit" style={{ textAlign: "center", color: "var(--text-2)", fontSize: "0.875rem", padding: "var(--spacing-md)", borderTop: "1px solid var(--surface-2)", marginTop: "var(--spacing-xl)" }}>Data from MusicBrainz (musicbrainz.org); tags CC BY-NC-SA 3.0</div>
          <div className="sn-mb-credit" style={{ textAlign: "center", color: "var(--text-2)", fontSize: "0.875rem", padding: "var(--spacing-md)", borderTop: "1px solid var(--surface-2)", marginTop: "var(--spacing-xl)" }}>Data from MusicBrainz (musicbrainz.org); tags CC BY-NC-SA 3.0</div>
    </main>
  );
};

export default SetBuilderPage;
