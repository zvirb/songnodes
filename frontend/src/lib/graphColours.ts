/**
 * Graph colours from design-system tokens (design-system/19-songnodes-migration.md,
 * "Graph colours from tokens"). PIXI needs numbers, so CSS variables are read
 * from :root at runtime and re-read whenever the theme (`data-theme`) changes.
 * Never hard-code a colour in the graph; add a token instead.
 */
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim();

/** Resolve a token to a 0xRRGGBB number. Alias tokens resolve through a probe element. */
export function tokenHex(n: string): number {
  return hex(n);
}

function hex(n: string): number {
  let v = css(n);
  if (!v.startsWith('#')) {
    // var() aliases and functional colours: let the browser resolve them
    const probe = document.createElement('span');
    probe.style.color = `var(--${n})`;
    probe.style.display = 'none';
    document.body.appendChild(probe);
    v = getComputedStyle(probe).color;
    probe.remove();
    const m = v.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
  }
  let h = v.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return parseInt(h.slice(0, 6), 16) || 0;
}

export interface GraphColours {
  node: { default: number; selected: number; now: number; path: number; hovered: number };
  edge: { default: number; selected: number; path: number };
  label: { fill: number; stroke: number };
  bg: number;
  chart: number[];
  key: (code: string) => number;
  energy: (e: number) => number;
  faded: number;
  edgeAlpha: number;
}

export function graphColours(): GraphColours {
  return {
    node: { default: hex('fg-2'), selected: hex('brand'), now: hex('now'), path: hex('mod-paths'), hovered: hex('fg') }, // now = amber, selected = lavender
    edge: { default: hex('fg-3'), selected: hex('brand'), path: hex('mod-paths') },
    label: { fill: hex('fg'), stroke: hex('bg') },
    bg: hex('bg'),
    chart: Array.from({ length: 8 }, (_, i) => hex(`chart-${i + 1}`)),
    key: (code: string) => {
      if (!code) return hex('fg-2');
      const clean = code.trim().toLowerCase().replace(/[^0-9ab]/g, '');
      const val = hex(`key-${clean}`);
      return val || hex('fg-2');
    },
    energy: (e: number) => {
      if (typeof e !== 'number' || isNaN(e)) return hex('fg-2');
      const val = hex(`energy-${Math.min(10, Math.max(1, Math.round(e)))}`);
      return val || hex('fg-2');
    },
    faded: Number(css('opacity-faded')) || 0.15,
    edgeAlpha: Number(css('opacity-edge')) || 0.6,
  };
}

/** Call `cb` with fresh colours whenever the theme changes. Returns an unsubscribe function. */
export function onThemeChange(cb: (c: GraphColours) => void): () => void {
  const obs = new MutationObserver(() => cb(graphColours()));
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  // "system" theme follows the OS without touching data-theme
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  const onMq = () => cb(graphColours());
  mq?.addEventListener?.('change', onMq);
  return () => {
    obs.disconnect();
    mq?.removeEventListener?.('change', onMq);
  };
}
