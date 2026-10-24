/**
 * CamelotWheel: the design-system CamelotWheel (design-system/components/CamelotWheel)
 * as a React SVG. Standard Camelot mapping via SN.camelot/SN.keyName (8A = A minor,
 * 8B = C major); number n sits at n o'clock with 12 at the top; outer ring B, inner
 * ring A; fills from the `key-*` tokens. Selection filters the graph (multi-select).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { GraphNode, Track } from '../types';
import { SN } from '../lib/songnodes';
import { onThemeChange, tokenHex } from '../lib/graphColours';

interface CamelotWheelProps {
  size?: number;
  /** Kept for API compatibility; the design-system wheel has no mood labels. */
  showMoodLabels?: boolean;
  /** Kept for API compatibility; key colours always come from the key tokens. */
  showEnergyGradient?: boolean;
  /** Outline the keys that mix cleanly with the focused (or last selected) key. */
  showHarmonicSuggestions?: boolean;
  onKeySelect?: (keys: string[]) => void;
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

/** Which segments need `fg` ink rather than `bg` ink, for the current theme. */
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

/** Keys that mix cleanly from `code`: same key's neighbours ±1 and the relative key. */
function cleanMixes(code: string): string[] {
  return CODES.filter((k) => k !== code && SN.compat(code, k).level !== 'clash' && SN.compat(code, k).level !== 'possible');
}

export const CamelotWheel: React.FC<CamelotWheelProps> = ({
  size = 300,
  showHarmonicSuggestions = false,
  onKeySelect,
  className = '',
}) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [focusKey, setFocusKey] = useState<string>('8A');
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [hasFocus, setHasFocus] = useState(false);
  const [showCounts, setShowCounts] = useState(true);
  const [ink, setInk] = useState<Record<string, boolean>>(() => computeInk());
  const segRefs = useRef<Record<string, SVGPathElement | null>>({});

  useEffect(() => onThemeChange(() => setInk(computeInk())), []);

  const graphData = useStore((state) => state.graphData);
  const selectNode = useStore((state) => state.graph.selectNode);

  const getTrackKey = useCallback((node: GraphNode): string | null => {
    const raw = node.key || node.metadata?.key || node.metadata?.camelot_key || node.metadata?.musical_key
      || node.track?.camelotKey || node.track?.key;
    return raw ? SN.camelot(String(raw)) : null;
  }, []);

  const tracksByKey = useMemo(() => {
    const result: Record<string, GraphNode[]> = {};
    (graphData.nodes || []).forEach((node) => {
      const key = getTrackKey(node);
      if (key) (result[key] ||= []).push(node);
    });
    return result;
  }, [graphData.nodes, getTrackKey]);

  const toggle = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      onKeySelect?.(next);
      if (next.length > 0) {
        next.flatMap((k) => tracksByKey[k] || []).forEach((t) => selectNode(t.id));
      }
      return next;
    });
  }, [onKeySelect, tracksByKey, selectNode]);

  const clear = () => {
    setSelectedKeys([]);
    onKeySelect?.([]);
  };

  const onKeyDown = (e: React.KeyboardEvent, code: string) => {
    let { n, L } = geo(code);
    if (e.key === 'ArrowRight') n = (n % 12) + 1;
    else if (e.key === 'ArrowLeft') n = ((n + 10) % 12) + 1;
    else if (e.key === 'ArrowUp') L = 'B';
    else if (e.key === 'ArrowDown') L = 'A';
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(code); return; }
    else return;
    e.preventDefault();
    const next = `${n}${L}`;
    setFocusKey(next);
    segRefs.current[next]?.focus();
  };

  const hubKey = hoverKey ?? focusKey;
  const reference = hoverKey ?? (hasFocus ? focusKey : selectedKeys[selectedKeys.length - 1]) ?? null;
  const compatSet = new Set(showHarmonicSuggestions && reference ? cleanMixes(reference) : []);
  const count = (code: string) => tracksByKey[code]?.length || 0;
  const selectedTotal = selectedKeys.reduce((a, k) => a + count(k), 0);

  const hubMeta = (() => {
    const n = count(hubKey);
    if (selectedKeys.length && hubKey !== selectedKeys[selectedKeys.length - 1]) {
      const from = selectedKeys[selectedKeys.length - 1];
      const c = SN.compat(from, hubKey);
      return `${c.label} from ${from}`;
    }
    return `${SN.format.count(n)} ${n === 1 ? 'track' : 'tracks'}`;
  })();

  const label = (code: string) =>
    `${code}, ${SN.keyName(code)}${showCounts ? `, ${count(code)} tracks` : ''}${compatSet.has(code) && reference ? `, mixes cleanly from ${reference}` : ''}`;

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
            return (
              <path
                key={code}
                ref={(el) => { segRefs.current[code] = el; }}
                className="sn-camelot-wheel__seg"
                data-key={code}
                d={sector(r[0], r[1], mid - 15, mid + 15)}
                role="button"
                tabIndex={code === focusKey ? 0 : -1}
                aria-pressed={selectedKeys.includes(code)}
                aria-label={label(code)}
                onClick={() => toggle(code)}
                onKeyDown={(e) => onKeyDown(e, code)}
                onFocus={() => { setFocusKey(code); setHasFocus(true); }}
                onBlur={() => setHasFocus(false)}
                onPointerEnter={() => setHoverKey(code)}
                onPointerLeave={() => setHoverKey(null)}
              />
            );
          })}
        </g>
        <g aria-hidden="true">
          {CODES.map((code) => {
            const { mid, r } = geo(code);
            const rm = (r[0] + r[1]) / 2;
            const [x, y] = pol(rm, mid);
            const fg = ink[code] ? '--fg' : '';
            return (
              <React.Fragment key={code}>
                <text className={`sn-camelot-wheel__code${fg ? ' sn-camelot-wheel__code--fg' : ''}`} x={x} y={y + (showCounts ? -6 : 0)}>{code}</text>
                {showCounts ? (
                  <text className={`sn-camelot-wheel__count${fg ? ' sn-camelot-wheel__count--fg' : ''}`} x={x} y={y + 9}>{SN.format.count(count(code))}</text>
                ) : null}
              </React.Fragment>
            );
          })}
        </g>
        <g aria-hidden="true">
          {CODES.map((code) => {
            const { mid, r } = geo(code);
            const a0 = mid - 15, a1 = mid + 15;
            const fg = ink[code];
            const sel = selectedKeys.includes(code);
            const [tx, ty] = pol(r[1] - 10, mid + 10);
            return (
              <React.Fragment key={code}>
                {sel ? (
                  <>
                    <path className={`sn-camelot-wheel__sel${fg ? ' sn-camelot-wheel__sel--fg' : ''}`} d={sector(r[0] + 3, r[1] - 3, a0 + 1.6, a1 - 1.6)} />
                    <text className={`sn-camelot-wheel__check${fg ? ' sn-camelot-wheel__check--fg' : ''}`} x={tx} y={ty}>✓</text>
                  </>
                ) : null}
                {compatSet.has(code) ? (
                  <path className={`sn-camelot-wheel__compat${fg ? ' sn-camelot-wheel__compat--fg' : ''}`} d={sector(r[0] + 3, r[1] - 3, a0 + 1.6, a1 - 1.6)} />
                ) : null}
              </React.Fragment>
            );
          })}
          {hasFocus ? (() => {
            const { mid, r } = geo(focusKey);
            return <path className="sn-camelot-wheel__focus" d={sector(r[0] - 3, r[1] + 3, mid - 16, mid + 16)} />;
          })() : null}
        </g>
        <g aria-hidden="true">
          <circle className="sn-camelot-wheel__hub" cx={C} cy={C} r={94} />
          <text className="sn-camelot-wheel__hub-code" x={C} y={C - 2}>{hubKey}</text>
          <text className="sn-camelot-wheel__hub-name" x={C} y={C + 18}>{SN.keyName(hubKey)}</text>
          <text className="sn-camelot-wheel__hub-meta" x={C} y={C + 36}>{hubMeta}</text>
        </g>
      </svg>

      <p className="sn-camelot-wheel__summary" role="status" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-2)', textAlign: 'center' }}>
        {selectedKeys.length
          ? <>Selected {selectedKeys.join(', ')} · {SN.format.count(selectedTotal)} tracks</>
          : <>No keys selected</>}
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
