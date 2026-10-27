/** PreferencesPanel (design-system): theme, text size, density and motion, applied live through SN.prefs. */
import React, { useState } from 'react';
import { SN, SnIcon } from '../lib/songnodes';
import { SegmentedControl, Checkbox, Radio } from '../components/ds';

type Theme = 'system' | 'dark' | 'light' | 'booth';
const THEMES: [Theme, string, string][] = [
  ['system', 'System', 'monitor'],
  ['dark', 'Dark', 'moon'],
  ['light', 'Light', 'sun'],
  ['booth', 'Booth', 'headphones'],
];

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
          <SegmentedControl
            label="Text size"
            value={p.textSize as 's' | 'm' | 'l' | 'xl'}
            options={[{ value: 's', label: 'S' }, { value: 'm', label: 'M' }, { value: 'l', label: 'L' }, { value: 'xl', label: 'XL' }]}
            onChange={(v) => { SN.prefs.setTextSize(v); refresh(`Text size ${v.toUpperCase()}`); }}
            block
          />
        </div>
        <div className="sn-preferences-panel__set">
          <SegmentedControl
            label="Row density"
            value={p.density as 'comfortable' | 'compact'}
            options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]}
            onChange={(v) => { SN.prefs.setDensity(v); refresh(`Row density ${v}`); }}
            block
          />
          <p className="sn-preferences-panel__help">Comfortable rows are 40px; compact rows are 32px.</p>
        </div>
        <fieldset className="sn-preferences-panel__set">
          <legend className="sn-field__label">Reduce motion</legend>
          <div className="sn-preferences-panel__radios" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Radio
              name="motion"
              label="Follow this device’s setting"
              checked={p.motion !== 'reduce'}
              onChange={() => { SN.prefs.setMotion('system'); refresh('Motion follows this device'); }}
            />
            <Radio
              name="motion"
              label="Always reduce motion"
              checked={p.motion === 'reduce'}
              onChange={() => { SN.prefs.setMotion('reduce'); refresh('Motion reduced'); }}
            />
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
