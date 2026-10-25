/**
 * CamelotWheel: interactive Camelot wheel component for harmonic mixing & modulation.
 * Maps 12 numbers around clock face (12 at top), outer ring B, inner ring A.
 * Fills from official `key-*` tokens. Supports exact match, relative major/minor,
 * adjacent (+1 / -1), and energy-boost (+2 / +7) modulation highlighting.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { GraphNode, Track } from '../types';
import { SN } from '../lib/songnodes';
import { onThemeChange, tokenHex } from '../lib/graphColours';
import { getModulationTargets, getTrackKey } from '../utils/camelotUtils';

export interface CamelotWheelProps {
  size?: number;
  activeKey?: string | null;
  selectedKeys?: string[];
  showMoodLabels?: boolean;
  showEnergyGradient?: boolean;
  showHarmonicSuggestions?: boolean;
  onKeySelect?: (keys: string[]) => void;
  onActiveKeyChange?: (key: string) => void;
  onTrackSelect?: (track: Track) => void;
  onPlanTransition?: (fromKey: string, toKey: string) => void;
  className?: string;
}

const C = 210;
const RING: Record<'A' | 'B', [number, number]> = { B: [154, 206], A: [100, 152] };
const CODES: string[] = (['B', 'A'] as const).flatMap((L) => Array.from({ length: 12 }, (_, i) => `${i + 1}${L}`));

function pol(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function sector(r0: number, r1: number, a0: number, a1: number) {
  const p0 = pol(r1, a0), p1 = pol(r1, a1), p2 = pol(r0, a1), p3 = pol(r0, a0);
  return `M${p0}A${r1},${r1} 0 0 1 ${p1}L${p2}A${r0},${r0} 0 0 0 ${p3}Z`;
}

const geo = (code: string) => {
  const L = code.slice(-1) as 'A' | 'B';
  const n = parseInt(code, 10);
  return { L, n, mid: (n % 12) * 30, r: RING[L] };
};

function lum(n: number) {
  return [16, 8, 0]
    .map((s) => ((n >> s) & 255) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)))
    .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function computeInk(): Record<string, boolean> {
  const Lbg = lum(tokenHex('bg'));
  const Lfg = lum(tokenHex('fg'));
  const out: Record<string, boolean> = {};
  CODES.forEach((code) => {
    const Lf = lum(tokenHex(`key-${code.toLowerCase()}`));
    out[code] = contrast(Lf, Lfg) > contrast(Lf, Lbg);
  });
  return out;
}

function cleanMixes(code: string): string[] {
  return CODES.filter((k) => k !== code && SN.compat(code, k).level !== 'clash' && SN.compat(code, k).level !== 'possible');
}

export const CamelotWheel: React.FC<CamelotWheelProps> = ({
  size = 360,
  activeKey: controlledActiveKey,
  selectedKeys: controlledSelectedKeys,
  showHarmonicSuggestions = true,
  onKeySelect,
  onActiveKeyChange,
  className = '',
}) => {
  const [internalSelectedKeys, setInternalSelectedKeys] = useState<string[]>([]);
  const [internalActiveKey, setInternalActiveKey] = useState<string>('8A');
  const [focusKey, setFocusKey] = useState<string>('8A');
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [hasFocus, setHasFocus] = useState(false);
  const [showCounts, setShowCounts] = useState(true);
  const [ink, setInk] = useState<Record<string, boolean>>(() => computeInk());
  const segRefs = useRef<Record<string, SVGPathElement | null>>({});

  useEffect(() => onThemeChange(() => setInk(computeInk())), []);

  const selectedKeys = controlledSelectedKeys ?? internalSelectedKeys;
  const currentActiveKey = controlledActiveKey ?? internalActiveKey;

  const graphData = useStore((state) => state.graphData);
  const selectNode = useStore((state) => state.graph.selectNode);

  const tracksByKey = useMemo(() => {
    const result: Record<string, GraphNode[]> = {};
    (graphData.nodes || []).forEach((node) => {
      const key = getTrackKey(node);
      if (key) (result[key] ||= []).push(node);
    });
    return result;
  }, [graphData.nodes]);

  const handleKeyClick = useCallback((code: string) => {
    setInternalActiveKey(code);
    onActiveKeyChange?.(code);

    if (controlledSelectedKeys === undefined) {
      setInternalSelectedKeys((prev) => {
        const next = prev.includes(code) ? prev.filter((k) => k !== code) : [...prev, code];
        onKeySelect?.(next);
        if (next.length > 0) {
          next.flatMap((k) => tracksByKey[k] || []).forEach((t) => selectNode(t.id));
        }
        return next;
      });
    } else {
      const next = selectedKeys.includes(code) ? selectedKeys.filter((k) => k !== code) : [...selectedKeys, code];
      onKeySelect?.(next);
    }
  }, [controlledSelectedKeys, selectedKeys, onKeySelect, onActiveKeyChange, tracksByKey, selectNode]);

  const clear = () => {
    setInternalSelectedKeys([]);
    onKeySelect?.([]);
  };

  const onKeyDown = (e: React.KeyboardEvent, code: string) => {
    let { n, L } = geo(code);
    if (e.key === 'ArrowRight') n = (n % 12) + 1;
    else if (e.key === 'ArrowLeft') n = ((n + 10) % 12) + 1;
    else if (e.key === 'ArrowUp') L = 'B';
    else if (e.key === 'ArrowDown') L = 'A';
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleKeyClick(code);
      return;
    } else return;

    e.preventDefault();
    const next = `${n}${L}`;
    setFocusKey(next);
    segRefs.current[next]?.focus();
  };

  const referenceKey = hoverKey ?? currentActiveKey ?? focusKey;
  const modInfo = useMemo(() => getModulationTargets(referenceKey), [referenceKey]);
  const compatSet = useMemo(() => new Set(showHarmonicSuggestions && referenceKey ? cleanMixes(referenceKey) : []), [showHarmonicSuggestions, referenceKey]);

  const count = (code: string) => tracksByKey[code]?.length || 0;
  const selectedTotal = selectedKeys.reduce((a, k) => a + count(k), 0);

  const hubKey = hoverKey ?? currentActiveKey ?? '8A';
  const hubMeta = (() => {
    const n = count(hubKey);
    if (currentActiveKey && hubKey !== currentActiveKey) {
      const c = SN.compat(currentActiveKey, hubKey);
      return `${c.label} from ${currentActiveKey}`;
    }
    return `${SN.format.count(n)} ${n === 1 ? 'track' : 'tracks'}`;
  })();

  const label = (code: string) => {
    let relTag = '';
    if (modInfo) {
      if (code === modInfo.exactMatch) relTag = ', Active Key';
      else if (code === modInfo.relative) relTag = ', Relative Key';
      else if (code === modInfo.adjacentPlus1 || code === modInfo.adjacentMinus1) relTag = ', Adjacent Harmonic Transition';
      else if (code === modInfo.energyBoostPlus2 || code === modInfo.energyBoostPlus7) relTag = ', Energy Boost Transition';
    }
    return `${code}, ${SN.keyName(code)}${showCounts ? `, ${count(code)} tracks` : ''}${relTag}`;
  };

  return (
    <div className={`camelot-wheel sn-camelot-wheel ${className}`} style={{ width: `min(${size}px, 100%)` }}>
      <svg
        className="sn-camelot-wheel__svg"
        viewBox="0 0 420 420"
        role="group"
        aria-label={`Camelot wheel${selectedKeys.length ? `, ${selectedKeys.length} keys selected` : ''}`}
      >
        <g>
          {CODES.map((code) => {
            const { mid, r } = geo(code);
            const isExact = modInfo?.exactMatch === code;
            const isSelected = selectedKeys.includes(code);

            return (
              <path
                key={code}
                ref={(el) => { segRefs.current[code] = el; }}
                className={`sn-camelot-wheel__seg${isExact ? ' sn-camelot-wheel__seg--active' : ''}`}
                data-key={code}
                d={sector(r[0], r[1], mid - 15, mid + 15)}
                role="button"
                tabIndex={code === focusKey ? 0 : -1}
                aria-pressed={isSelected}
                aria-label={label(code)}
                onClick={() => handleKeyClick(code)}
                onKeyDown={(e) => onKeyDown(e, code)}
                onFocus={() => { setFocusKey(code); setHasFocus(true); }}
                onBlur={() => setHasFocus(false)}
                onPointerEnter={() => setHoverKey(code)}
                onPointerLeave={() => setHoverKey(null)}
              />
            );
          })}
        </g>

        {/* Labels & Counts */}
        <g aria-hidden="true">
          {CODES.map((code) => {
            const { mid, r } = geo(code);
            const rm = (r[0] + r[1]) / 2;
            const [x, y] = pol(rm, mid);
            const fg = ink[code] ? '--fg' : '';
            return (
              <React.Fragment key={code}>
                <text
                  className={`sn-camelot-wheel__code${fg ? ' sn-camelot-wheel__code--fg' : ''}`}
                  x={x}
                  y={y + (showCounts ? -6 : 0)}
                  style={{ fontFamily: 'var(--font-data)' }}
                >
                  {code}
                </text>
                {showCounts ? (
                  <text
                    className={`sn-camelot-wheel__count${fg ? ' sn-camelot-wheel__count--fg' : ''}`}
                    x={x}
                    y={y + 9}
                    style={{ fontFamily: 'var(--font-data)' }}
                  >
                    {SN.format.count(count(code))}
                  </text>
                ) : null}
              </React.Fragment>
            );
          })}
        </g>

        {/* Dynamic Modulation Overlays & Selection Indicators */}
        <g aria-hidden="true">
          {CODES.map((code) => {
            const { mid, r } = geo(code);
            const a0 = mid - 15, a1 = mid + 15;
            const fg = ink[code];
            const sel = selectedKeys.includes(code);
            const [tx, ty] = pol(r[1] - 10, mid + 10);

            const isExact = modInfo?.exactMatch === code;
            const isRelative = modInfo?.relative === code;
            const isAdjacent = modInfo?.adjacentPlus1 === code || modInfo?.adjacentMinus1 === code;
            const isEnergyBoost = modInfo?.energyBoostPlus2 === code || modInfo?.energyBoostPlus7 === code;

            return (
              <React.Fragment key={code}>
                {sel ? (
                  <>
                    <path className={`sn-camelot-wheel__sel${fg ? ' sn-camelot-wheel__sel--fg' : ''}`} d={sector(r[0] + 3, r[1] - 3, a0 + 1.6, a1 - 1.6)} />
                    <text className={`sn-camelot-wheel__check${fg ? ' sn-camelot-wheel__check--fg' : ''}`} x={tx} y={ty}>✓</text>
                  </>
                ) : null}

                {/* Highlight Modulation Relationships */}
                {isExact ? (
                  <path
                    d={sector(r[0] + 1, r[1] - 1, a0 + 0.5, a1 - 0.5)}
                    fill="none"
                    stroke="var(--fg)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                ) : isRelative ? (
                  <path
                    d={sector(r[0] + 2, r[1] - 2, a0 + 1, a1 - 1)}
                    fill="none"
                    stroke="var(--brand)"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                  />
                ) : isAdjacent ? (
                  <path
                    className={`sn-camelot-wheel__compat${fg ? ' sn-camelot-wheel__compat--fg' : ''}`}
                    d={sector(r[0] + 3, r[1] - 3, a0 + 1.6, a1 - 1.6)}
                  />
                ) : isEnergyBoost ? (
                  <path
                    d={sector(r[0] + 3, r[1] - 3, a0 + 1.6, a1 - 1.6)}
                    fill="none"
                    stroke="var(--status-warn)"
                    strokeWidth="2"
                  />
                ) : compatSet.has(code) ? (
                  <path
                    className={`sn-camelot-wheel__compat${fg ? ' sn-camelot-wheel__compat--fg' : ''}`}
                    d={sector(r[0] + 3, r[1] - 3, a0 + 1.6, a1 - 1.6)}
                  />
                ) : null}
              </React.Fragment>
            );
          })}

          {hasFocus ? (() => {
            const { mid, r } = geo(focusKey);
            return <path className="sn-camelot-wheel__focus" d={sector(r[0] - 3, r[1] + 3, mid - 16, mid + 16)} />;
          })() : null}
        </g>

        {/* Center Hub Display */}
        <g aria-hidden="true">
          <circle className="sn-camelot-wheel__hub" cx={C} cy={C} r={94} />
          <text className="sn-camelot-wheel__hub-code" x={C} y={C - 2} style={{ fontFamily: 'var(--font-data)' }}>{hubKey}</text>
          <text className="sn-camelot-wheel__hub-name" x={C} y={C + 18} style={{ fontFamily: 'var(--font-display)' }}>{SN.keyName(hubKey)}</text>
          <text className="sn-camelot-wheel__hub-meta" x={C} y={C + 36} style={{ fontFamily: 'var(--font-body)' }}>{hubMeta}</text>
        </g>
      </svg>

      <p className="sn-camelot-wheel__summary" role="status" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-2)', textAlign: 'center', fontFamily: 'var(--font-body)' }}>
        {selectedKeys.length
          ? <>Selected {selectedKeys.join(', ')} · {SN.format.count(selectedTotal)} tracks</>
          : <>Active Key: <span style={{ fontFamily: 'var(--font-data)', fontWeight: 600 }}>{currentActiveKey}</span> ({SN.keyName(currentActiveKey)})</>}
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={() => setShowCounts((v) => !v)}>
          {showCounts ? 'Hide track counts' : 'Show track counts'}
        </button>
        {selectedKeys.length ? (
          <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={clear}>
            <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
            Clear selection
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default CamelotWheel;
