/** Services: Settings (/settings), design-system SettingsPage. One page with anchors. */
import React, { useState } from 'react';
import { usePageHeader } from '../shell/AppShell';
import { PageHeader, SectionHeading } from '../shell/PageParts';
import { PreferencesPanel } from '../shell/PreferencesPanel';
import { SN, SnIcon } from '../lib/songnodes';

const SettingsPanel = React.lazy(() => import('../components/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));

const SettingsPage: React.FC = () => {
  usePageHeader({ lead: 'Services', title: 'Settings', current: 'services' });
  const [servicesOpen, setServicesOpen] = useState(false);

  return (
    <main className="sn-page__main sn-page-settings" id="main" tabIndex={-1}>
      <PageHeader mod="services" lead="Services" title="Settings" desc="Streaming services, API keys and how SongNodes looks on this device." />
      <div className="sn-page-settings__layout">
        <nav className="sn-page-settings__toc" aria-label="Settings sections">
          <a className="sn-link sn-m-services" href="#services">Services</a>
          <a className="sn-link sn-m-services" href="#display">Preferences</a>
          <a className="sn-link sn-m-services" href="#about">About</a>
        </nav>
        <div className="sn-page-settings__sections">
          <section className="sn-page__section" id="services" aria-labelledby="set-svc">
            <SectionHeading id="set-svc" title="Services and API keys" caveat="Spotify and TIDAL connections, and keys for enrichment providers." />
            <div className="sn-card sn-card--flat">
              <p className="body-s sn-muted">Connections and keys open in their own panel until the Settings page is rebuilt from ServiceStatus and SecretField (migration phase 4).</p>
              <div className="sn-page-settings__actions">
                <span className="sn-m-services"><button className="sn-btn sn-btn--mod" type="button" onClick={() => setServicesOpen(true)}><SnIcon name="plug" />Manage connections and keys…</button></span>
              </div>
            </div>
          </section>
          <section className="sn-page__section" id="display">
            <PreferencesPanel />
          </section>
          <section className="sn-page__section" id="about" aria-labelledby="set-about">
            <SectionHeading id="set-about" title="About" />
            <dl className="sn-key-value-grid">
              <dt>Design system</dt><dd className="sn-mono">{SN.version}</dd>
              <dt>Locale</dt><dd className="sn-mono">{SN.locale} · {SN.timeZone}</dd>
            </dl>
          </section>
        </div>
      </div>
      {servicesOpen ? (
        <React.Suspense fallback={null}>
          <SettingsPanel isOpen={servicesOpen} onClose={() => setServicesOpen(false)} />
        </React.Suspense>
      ) : null}
    </main>
  );
};

export default SettingsPage;
