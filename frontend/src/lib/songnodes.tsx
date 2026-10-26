/**
 * Typed access to the SongNodes design system helpers (window.SongNodes).
 *
 * The design system is the single source of truth for formatting and design
 * decisions. Never hand-format a date, duration, count, BPM, key or status in a
 * component: use SN.format, SN.camelot/keyName/compat, SN.energyStep/bpmStep and
 * SN.status from here. Never draw an icon the system provides: use <SnIcon>.
 *
 * Source: design-system/components/bundle.js, synced into
 * src/styles/design-system/ by scripts/sync-design-system.sh. Do not edit the
 * synced files.
 */
import React from 'react';
import '../styles/design-system/bundle.js';
import type { SongNodesHelpers, ModuleKey, CompatLevel, DesignStatus } from '../styles/design-system/index';

export type { ModuleKey, CompatLevel, DesignStatus };

export const SN: SongNodesHelpers = window.SongNodes;

/** Helpers bundle.js defines but index.d.ts does not type yet (report upstream to the design system). */
const extra = window.SongNodes as unknown as { GLYPH: Record<string, string>; TIER_LABEL: Record<'low' | 'building' | 'high', string> };
/** Status and verdict glyphs: ● ◐ ▲ ✕ ↻ – ● ◐ ○ ✕ ? */
export const GLYPH = extra.GLYPH;
/** Energy tier labels: "Low 1–4", "Building 5–7", "High 8–10". */
export const TIER_LABEL = extra.TIER_LABEL;

/** Route for each module's index page. Drawer, launcher cards and links all use this. */
export const MODULE_ROUTES: Record<ModuleKey, string> = {
  graph: '/graph',
  library: '/library',
  sets: '/sets',
  paths: '/paths',
  harmony: '/harmony',
  sources: '/sources',
  pipeline: '/pipeline',
  services: '/settings',
};

export const moduleOf = (key: ModuleKey) => SN.modules.find((m) => m.key === key)!;

interface SnIconProps {
  name: string;
  size?: number;
  /** Accessible name; omit for decorative icons (the default). */
  label?: string;
  className?: string;
}

/** A Lucide icon from the design system's icon set (inherits currentColor). */
export const SnIcon: React.FC<SnIconProps> = ({ name, size, label, className }) => (
  <span
    className={className}

    aria-hidden={label ? undefined : true}
    dangerouslySetInnerHTML={{ __html: SN.icon(name, { size, label }) }}
  />
);

/** Thin–bold title: regular dimmed lead-in plus bold title (04-typography). */
export const Title: React.FC<{ lead?: string; children: React.ReactNode; size?: 'display-xl' | 'title-l' | 'title-m' | 'title-s'; as?: 'h1' | 'h2' | 'h3'; id?: string }> = ({ lead, children, size = 'title-l', as = 'h1', id }) => {
  const Tag = as;
  return (
    <Tag className={`sn-title ${size}`} id={id}>
      {lead ? <span className="sn-lead">{lead}:</span> : null}
      {lead ? ' ' : null}
      {children}
    </Tag>
  );
};

/** Ten-segment energy meter with gaps after 4 and 7; missing energy is an en dash. */
export const EnergyBar: React.FC<{ value: number | null | undefined }> = ({ value }) =>
  value == null || !Number.isFinite(Number(value))
    ? <span className="sn-none" title="Energy not set">–</span>
    : <span dangerouslySetInnerHTML={{ __html: SN.html.energy(Math.round(Number(value))) }} />;

/** Camelot key: wheel-colour dot plus code in mono; detail views add the name. */
export const KeyBadge: React.FC<{ value: string | null | undefined; withName?: boolean }> = ({ value, withName }) => {
  const code = value ? SN.camelot(value) : null;
  return code
    ? <span dangerouslySetInnerHTML={{ __html: SN.html.key(code, withName) }} />
    : <span className="sn-none" title="Key not set">–</span>;
};

/** BPM in mono with tabular figures. */
export const Bpm: React.FC<{ value: number | null | undefined }> = ({ value }) =>
  value == null ? <span className="sn-none" title="BPM not set">–</span> : <span className="sn-bpm"><b>{SN.format.bpm(value)}</b></span>;

/** Status pill: glyph plus word, mapped from a backend enum through SN.status. */
export const StatusPill: React.FC<{ raw: string; label?: string }> = ({ raw, label }) => {
  const s = SN.status(raw);
  return <span className="sn-pill" data-status={s.status}>{label ?? s.label}</span>;
};

/** Compatibility verdict pill with mandatory glyph and words. */
export const CompatPill: React.FC<{ level: CompatLevel; label?: string }> = ({ level, label }) => (
  <span className="sn-pill" data-compat={level}>{label ?? level}</span>
);
