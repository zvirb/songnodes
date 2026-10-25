/** PreferencesPanel (design-system): theme, text size, density and motion, applied live through SN.prefs. */
import React, { useState } from 'react';
import { SN, SnIcon } from '../lib/songnodes';

type Theme = 'system' | 'dark' | 'light' | 'booth';
const THEMES: [Theme, string, string][] = [
  ['system', 'System', 'monitor'],
  ['dark', 'Dark', 'moon'],
  ['light', 'Light', 'sun'],
  ['booth', 'Booth', 'headphones'],
];

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = options[(i + d + options.length) % options.length][0];
    onChange(next);
    const group = (e.currentTarget as HTMLElement).parentElement;
    requestAnimationFrame(() => group?.querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus());
  };
  return (
    <div className="sn-seg sn-segmented-control sn-segmented-control--block" role="radiogroup" aria-label={label}>
      {options.map(([v, text], i) => (
        <button key={v} type="button" role="radio" data-value={v} aria-checked={v === value} tabIndex={v === value ? 0 : -1} onClick={() => onChange(v)} onKeyDown={(e) => onKey(e, i)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export const PreferencesPanel: React.FC<{ embedded?: boolean }> = ({ embedded = true }) => {
  const [p, setP] = useState(() => SN.prefs.get());
  const [announce, setAnnounce] = useState('');

  const refresh = (msg: string) => { setP(SN.prefs.get()); setAnnounce(msg); };

  return (
    <section className={`sn-preferences-panel${embedded ? ' sn-preferences-panel--embedded' : ''}`} aria-labelledby="pp-title">
      <div className="sn-preferences-panel__head"><h2 className="sn-title title-m" id="pp-title">Preferences</h2></div>
      <div className="sn-preferences-panel__body">
        <div className="sn-preferences-panel__set">
          <span className="sn-field__label" id="pp-theme">Theme</span>
          <div className="sn-preferences-panel__themes" role="radiogroup" aria-labelledby="pp-theme">
            {THEMES.map(([v, label, icon]) => (
              <button key={v} type="button" className="sn-preferences-panel__theme" role="radio" aria-checked={p.theme === v} data-value={v}
                onClick={() => { SN.prefs.setTheme(v); refresh(`Theme set to ${label}`); }}>
                <SnIcon name={icon} />
                <span>{label}</span>
                <span className="sn-preferences-panel__check" aria-hidden="true">✓</span>
              </button>
            ))}
          </div>
          <p className="sn-preferences-panel__help">Booth is pure black with larger type for dark rooms and reading at a distance.</p>
        </div>
        <div className="sn-preferences-panel__set">
          <span className="sn-field__label">Text size</span>
          <Segmented label="Text size" value={p.textSize as 's' | 'm' | 'l' | 'xl'} options={[['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']]}
            onChange={(v) => { SN.prefs.setTextSize(v); refresh(`Text size ${v.toUpperCase()}`); }} />
        </div>
        <div className="sn-preferences-panel__set">
          <span className="sn-field__label">Row density</span>
          <Segmented label="Row density" value={p.density as 'comfortable' | 'compact'} options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]}
            onChange={(v) => { SN.prefs.setDensity(v); refresh(`Row density ${v}`); }} />
          <p className="sn-preferences-panel__help">Comfortable rows are 40px; compact rows are 32px.</p>
        </div>
        <fieldset className="sn-preferences-panel__set">
          <legend className="sn-field__label">Reduce motion</legend>
          <div className="sn-preferences-panel__radios">
            <label className="sn-check"><input type="radio" name="pp-motion" checked={p.motion !== 'reduce'} onChange={() => { SN.prefs.setMotion('system'); refresh('Motion follows this device'); }} /> <span>Follow this device’s setting</span></label>
            <label className="sn-check"><input type="radio" name="pp-motion" checked={p.motion === 'reduce'} onChange={() => { SN.prefs.setMotion('reduce'); refresh('Motion reduced'); }} /> <span>Always reduce motion</span></label>
          </div>
        </fieldset>
      </div>
      <div className="sn-preferences-panel__foot">
        <span>Saved on this device only</span>
        <button className="sn-btn sn-btn--quiet sn-btn--sm" type="button" onClick={() => {
          SN.prefs.setTheme('system'); SN.prefs.setTextSize('m'); SN.prefs.setDensity('comfortable'); SN.prefs.setMotion('system');
          refresh('Preferences reset to defaults');
        }}>Reset to defaults</button>
      </div>
      <p className="sn-sr" role="status">{announce}</p>
    </section>
  );
};
