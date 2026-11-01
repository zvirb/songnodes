import { describe, expect, it } from 'vitest';
import {
  type BoxStyle,
  type ChainElement,
  type Rect,
  classifyInset,
  colourAlpha,
  drawnSides,
  formatFinding,
  inlineInset,
  nearestEdgeBox,
  shadowSides,
  tightTextInset,
} from './textInset';

// Computed-style colour strings in the form getComputedStyle returns them (test inputs, not styling).
const rgb = (...n: number[]) => `${n.length === 4 ? 'rgba' : 'rgb'}(${n.join(', ')})`;
const CLEAR = rgb(0, 0, 0, 0);
const PAGE = rgb(10, 10, 12);
const SURFACE = rgb(24, 24, 28);
const LINE = rgb(60, 60, 66);

const style = (over: Partial<BoxStyle> = {}): BoxStyle => ({
  backgroundColor: CLEAR,
  backgroundImage: 'none',
  borderWidth: [0, 0, 0, 0],
  borderStyle: ['none', 'none', 'none', 'none'],
  borderColor: [LINE, LINE, LINE, LINE],
  boxShadow: 'none',
  ...over,
});
const bordered = (over: Partial<BoxStyle> = {}) =>
  style({ borderWidth: [1, 1, 1, 1], borderStyle: ['solid', 'solid', 'solid', 'solid'], ...over });

const el = (label: string, s: BoxStyle, box: Rect = { left: 100, right: 200, top: 0, bottom: 24 }): ChainElement => ({
  label,
  classes: label.split('.').slice(1),
  style: s,
  paddingBox: box,
});
const line = (left: number, right: number): Rect => ({ left, right, top: 4, bottom: 20 });

describe('colourAlpha', () => {
  it('reads transparent, comma alpha, slash alpha and opaque colours', () => {
    expect(colourAlpha('transparent')).toBe(0);
    expect(colourAlpha(CLEAR)).toBe(0);
    expect(colourAlpha(rgb(0, 0, 0, 0.5))).toBe(0.5);
    expect(colourAlpha('color(srgb 0 0 0 / 0)')).toBe(0);
    expect(colourAlpha('oklch(0.5 0.1 200 / 40%)')).toBeCloseTo(0.4);
    expect(colourAlpha(SURFACE)).toBe(1);
    expect(colourAlpha('')).toBe(0);
  });
});

describe('shadowSides', () => {
  it('treats an inset ring or an outer shadow as every side', () => {
    expect(shadowSides(`${LINE} 0px 0px 0px 1px inset`)).toEqual(new Set(['bottom', 'left', 'right', 'top']));
    expect(shadowSides(`${CLEAR} 0px 0px 0px 1px inset`).size).toBe(0);
    expect(shadowSides(`${rgb(0, 0, 0, 0.3)} 0px 2px 8px 0px`).size).toBe(4);
  });

  it('treats a hard inset offset as a bar on that side only', () => {
    expect([...shadowSides(`${LINE} 0px -3px 0px 0px inset`)]).toEqual(['bottom']);
    expect([...shadowSides(`${LINE} 3px 0px 0px 0px inset`)]).toEqual(['left']);
  });

  it('reads several layers and none', () => {
    expect(shadowSides('none').size).toBe(0);
    expect(shadowSides(`${LINE} 0px -2px 0px 0px inset, ${LINE} -2px 0px 0px 0px inset`)).toEqual(new Set(['bottom', 'right']));
  });
});

describe('drawnSides', () => {
  it('counts a fill only when it differs from what is behind', () => {
    expect(drawnSides(style({ backgroundColor: SURFACE }), PAGE).size).toBe(4);
    expect(drawnSides(style({ backgroundColor: PAGE }), PAGE).size).toBe(0);
    expect(drawnSides(style(), PAGE).size).toBe(0);
  });

  it('counts only visible borders, side by side', () => {
    const rule = style({ borderWidth: [0, 0, 1, 0], borderStyle: ['none', 'none', 'solid', 'none'] });
    expect([...drawnSides(rule, PAGE)]).toEqual(['bottom']);
    expect(drawnSides(bordered({ borderColor: [CLEAR, CLEAR, CLEAR, CLEAR] }), PAGE).size).toBe(0);
    expect(drawnSides(bordered({ borderStyle: ['hidden', 'hidden', 'hidden', 'hidden'] }), PAGE).size).toBe(0);
  });
});

describe('nearestEdgeBox', () => {
  it('skips plain wrappers and row rules and stops at the scope', () => {
    const chain = [
      el('span.sn-tag__text', style()),
      el('div.row', style({ borderWidth: [0, 0, 1, 0], borderStyle: ['none', 'none', 'solid', 'none'] })),
      el('div.sn-card', bordered({ backgroundColor: SURFACE })),
      el('main.sn-page__main', style({ backgroundColor: PAGE })),
    ];
    expect(nearestEdgeBox(chain, 3)?.index).toBe(2);
    expect(nearestEdgeBox(chain, 2)).toBeNull();
  });

  it('uses fills beyond the scope as the background behind', () => {
    const chain = [el('div.panel', style({ backgroundColor: PAGE })), el('main', style({ backgroundColor: PAGE }))];
    expect(nearestEdgeBox(chain, 1)).toBeNull();
  });
});

describe('inlineInset and classifyInset', () => {
  it('takes the least distance over every line and drawn inline side', () => {
    const box = { left: 100, right: 200, top: 0, bottom: 40 };
    const all = new Set(['top', 'right', 'bottom', 'left'] as const);
    expect(inlineInset([line(108, 150), line(112, 195)], box, all)).toEqual({ side: 'right', inset: 5 });
    expect(inlineInset([line(105, 199)], box, new Set(['left']))).toEqual({ side: 'left', inset: 5 });
    expect(inlineInset([line(105, 199)], box, new Set(['top', 'bottom']))).toBeNull();
  });

  it('flags 4 to under 8px as tight, with sub-pixel tolerance', () => {
    expect(classifyInset(8)).toBe('ok');
    expect(classifyInset(7.6)).toBe('ok');
    expect(classifyInset(7.4)).toBe('tight');
    expect(classifyInset(4)).toBe('tight');
    expect(classifyInset(3.6)).toBe('tight');
    expect(classifyInset(3)).toBe('touching');
    expect(classifyInset(-2)).toBe('touching');
  });
});

const pill = (cls = 'span.sn-pill') =>
  [el(cls, style({ backgroundColor: SURFACE })), el('main', style({ backgroundColor: PAGE }))];

describe('tightTextInset', () => {
  it('reports a filled pill padded 6px with selector, side, inset and snippet', () => {
    const f = tightTextInset('  Live \n now ', [line(106, 160)], pill(), 1);
    expect(f).toEqual({ textLabel: 'span.sn-pill', boxLabel: 'span.sn-pill', side: 'left', inset: 6, text: 'Live now' });
    expect(formatFinding('/library', 390, f)).toBe(
      '/library @390: span.sn-pill "Live now" sits 6px from the left edge of span.sn-pill (needs 8px)',
    );
  });

  it('passes 8px insets, touching text and text with no edged box', () => {
    expect(tightTextInset('Techno', [line(108, 192)], pill(), 1)).toBeNull();
    expect(tightTextInset('Techno', [line(101, 192)], pill(), 1)).toBeNull();
    expect(tightTextInset('Plain', [line(105, 150)], [el('p', style()), el('main', style({ backgroundColor: PAGE }))], 1)).toBeNull();
  });

  it('skips boxes the design system pads under 8px on purpose', () => {
    expect(tightTextInset('10A', [line(105, 195)], pill('button.sn-key-picker__key'), 1)).toBeNull();
  });

  it('measures against the nearest edged box, not an outer one', () => {
    const chain = [
      el('span.sn-tag', bordered({ backgroundColor: SURFACE }), { left: 120, right: 180, top: 0, bottom: 20 }),
      el('div.sn-card', bordered({ backgroundColor: SURFACE })),
      el('main', style({ backgroundColor: PAGE })),
    ];
    expect(tightTextInset('Tag', [line(128, 172)], chain, 2)).toBeNull();
    expect(tightTextInset('Tag', [line(124, 172)], chain, 2)?.boxLabel).toBe('span.sn-tag');
  });
});
