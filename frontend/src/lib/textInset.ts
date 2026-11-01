/**
 * Text inset geometry for the rendered design check (DR-050; design-system/05-layout.md, Text inset).
 *
 * Text in a box that draws an edge (a border, a fill different from what is behind it, or an
 * inset ring) keeps at least `space-2` (8px) between its rendered text and that edge, inline
 * (left and right). 4–7px is "tight" and fails the check; under 4px is a defect of its own and
 * is reported as "touching", not by this check.
 *
 * Pure functions only: tests/e2e/design-rules.spec.ts collects computed styles and rects in the
 * browser and classifies them here, so the rules are unit-tested (textInset.test.ts) without a
 * browser. Nothing in the app imports this file.
 */

export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface Rect { left: number; right: number; top: number; bottom: number }

/** Computed style of one element, as getComputedStyle reports it. Arrays are top, right, bottom, left. */
export interface BoxStyle {
  backgroundColor: string;
  backgroundImage: string;
  borderWidth: [number, number, number, number];
  borderStyle: [string, string, string, string];
  borderColor: [string, string, string, string];
  boxShadow: string;
}

export interface ChainElement {
  /** `tag.class.class`, for the failure message. */
  label: string;
  classes: string[];
  style: BoxStyle;
  /** The padding edge: the border box less the border widths. */
  paddingBox: Rect;
}

/** `space-1`: below this the text touches the edge (a defect, not this check). */
export const TOUCHING_BELOW = 4;
/** `space-2`: the least inline inset DR-050 accepts. */
export const INSET_MIN = 8;
/** Sub-pixel layout tolerance: 7.6px from an 8px padding is still 8px. */
const EPS = 0.5;

/**
 * Boxes the design system draws with an inline inset under 8px on purpose. Text whose nearest
 * edged box carries one of these classes is not measured.
 */
export const EXCLUDED_BOX_CLASSES: Record<string, string> = {
  // KeyPicker card (design-system/components/KeyPicker/README.md, Accessibility): a 12 x 2 grid of
  // keys "36px tall and at least 24px wide", padded `space-1` with the code centred, so the inset
  // shrinks with the column; 05-layout lets the keys wrap instead of spilling.
  'sn-key-picker__key': 'KeyPicker keys are at least 24px wide with space-1 padding (KeyPicker card)',
};

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

function alphaOf(token: string): number {
  return token.endsWith('%') ? parseFloat(token) / 100 : parseFloat(token);
}

/** Alpha of a computed colour: 0 for `transparent`, the `/ a` or fourth comma value, else 1. */
export function colourAlpha(colour: string): number {
  const s = (colour || '').trim().toLowerCase();
  if (!s || s === 'transparent' || s === 'none') return 0;
  const slash = s.match(/\/\s*(-?[\d.]+%?)\s*\)\s*$/);
  if (slash) return alphaOf(slash[1]);
  const nums = s.match(/-?[\d.]+%?/g) ?? [];
  if (/^(rgba|hsla)/.test(s) && nums.length === 4) return alphaOf(nums[3]);
  return 1;
}

/** Split a comma list at depth 0 (commas inside parentheses belong to a colour). */
function splitTopLevel(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) {
      out.push(value.slice(start, i));
      start = i + 1;
    }
  }
  out.push(value.slice(start));
  return out.map((p) => p.trim()).filter(Boolean);
}

/**
 * Sides a computed box-shadow draws. An outer shadow, or an inset one with blur or spread (a ring),
 * draws every side; a hard inset shadow with only an offset draws a bar on the offset side
 * (`inset 0 -3px 0` is a bottom bar).
 */
export function shadowSides(shadow: string): Set<Side> {
  const out = new Set<Side>();
  if (!shadow || shadow.trim() === 'none') return out;
  for (const layer of splitTopLevel(shadow)) {
    const colourPart = layer.match(/[a-z-]+\([^)]*\)|\btransparent\b/i)?.[0] ?? '';
    if (colourPart && colourAlpha(colourPart) === 0) continue;
    const rest = colourPart ? layer.replace(colourPart, ' ') : layer;
    const lengths = (rest.match(/-?[\d.]+px|\b0\b/g) ?? []).map((t) => parseFloat(t));
    const [x = 0, y = 0, blur = 0, spread = 0] = lengths;
    const inset = /\binset\b/i.test(rest);
    if (!inset || blur > 0 || spread !== 0) {
      if (x === 0 && y === 0 && blur === 0 && spread === 0) continue;
      SIDES.forEach((s) => out.add(s));
      continue;
    }
    if (x > 0) out.add('left');
    if (x < 0) out.add('right');
    if (y > 0) out.add('top');
    if (y < 0) out.add('bottom');
  }
  return out;
}

function sameColour(a: string, b: string): boolean {
  return a.replace(/\s+/g, '') === b.replace(/\s+/g, '');
}

/**
 * Sides of a box that draw an edge. `behind` is the colour the box sits on (the nearest
 * ancestor fill), or '' when nothing behind it is filled.
 */
export function drawnSides(style: BoxStyle, behind: string): Set<Side> {
  const out = new Set<Side>();
  const filled = colourAlpha(style.backgroundColor) > 0 && !(behind && sameColour(style.backgroundColor, behind));
  if (filled || (style.backgroundImage && style.backgroundImage !== 'none')) {
    SIDES.forEach((s) => out.add(s));
    return out;
  }
  SIDES.forEach((side, i) => {
    const visibleStyle = style.borderStyle[i] !== 'none' && style.borderStyle[i] !== 'hidden';
    if (style.borderWidth[i] > 0 && visibleStyle && colourAlpha(style.borderColor[i]) > 0) out.add(side);
  });
  shadowSides(style.boxShadow).forEach((s) => out.add(s));
  return out;
}

/** The fill behind chain[index]: the first filled ancestor further out, or ''. */
export function backgroundBehind(chain: ChainElement[], index: number): string {
  for (let j = index + 1; j < chain.length; j += 1) {
    if (colourAlpha(chain[j].style.backgroundColor) > 0) return chain[j].style.backgroundColor;
  }
  return '';
}

export interface EdgeBox { index: number; sides: Set<Side> }

/**
 * The nearest element in chain[0..scope) that draws an inline (left or right) edge. `chain` runs
 * from the text's parent outwards to the root; elements at or past `scope` (the page container and
 * above) only supply the background behind.
 */
export function nearestEdgeBox(chain: ChainElement[], scope: number): EdgeBox | null {
  for (let i = 0; i < Math.min(scope, chain.length); i += 1) {
    const sides = drawnSides(chain[i].style, backgroundBehind(chain, i));
    if (sides.has('left') || sides.has('right')) return { index: i, sides };
  }
  return null;
}

/** The excluded class a box carries, if any. */
export function excludedClass(el: ChainElement): string | null {
  return el.classes.find((c) => c in EXCLUDED_BOX_CLASSES) ?? null;
}

export interface InlineInset { side: 'left' | 'right'; inset: number }

/** Least inline distance from the text's line rects to the drawn padding edges of its box. */
export function inlineInset(textRects: Rect[], box: Rect, sides: Set<Side>): InlineInset | null {
  let best: InlineInset | null = null;
  for (const r of textRects) {
    if (sides.has('left')) {
      const inset = r.left - box.left;
      if (!best || inset < best.inset) best = { side: 'left', inset };
    }
    if (sides.has('right')) {
      const inset = box.right - r.right;
      if (!best || inset < best.inset) best = { side: 'right', inset };
    }
  }
  return best;
}

export type InsetClass = 'ok' | 'tight' | 'touching';

/** DR-050: 4 <= inset < 8 is tight (fails); under 4 is touching; 8 and over is ok. */
export function classifyInset(inset: number): InsetClass {
  if (inset < TOUCHING_BELOW - EPS) return 'touching';
  if (inset < INSET_MIN - EPS) return 'tight';
  return 'ok';
}

export interface InsetFinding {
  textLabel: string;
  boxLabel: string;
  side: 'left' | 'right';
  inset: number;
  text: string;
}

/**
 * Measure one text node. Returns a finding when its inset is tight, otherwise null (no edged box,
 * an excluded box, an ok inset, or a touching one, which this check does not judge).
 */
export function tightTextInset(
  text: string,
  textRects: Rect[],
  chain: ChainElement[],
  scope: number,
): InsetFinding | null {
  if (!textRects.length || !chain.length) return null;
  const box = nearestEdgeBox(chain, scope);
  if (!box) return null;
  const el = chain[box.index];
  if (excludedClass(el)) return null;
  const measured = inlineInset(textRects, el.paddingBox, box.sides);
  if (!measured || classifyInset(measured.inset) !== 'tight') return null;
  return {
    textLabel: chain[0].label,
    boxLabel: el.label,
    side: measured.side,
    inset: Math.round(measured.inset * 10) / 10,
    text: text.replace(/\s+/g, ' ').trim().slice(0, 40),
  };
}

/** One line of the failure message: page, width, selector, inset and a text snippet. */
export function formatFinding(route: string, width: number, f: InsetFinding): string {
  return `${route} @${width}: ${f.textLabel} "${f.text}" sits ${f.inset}px from the ${f.side} edge of ${f.boxLabel} (needs ${INSET_MIN}px)`;
}
