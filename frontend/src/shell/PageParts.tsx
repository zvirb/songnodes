/**
 * Page-level design-system components used across routes:
 * PageHeader, EmptyState, SectionHeading, LauncherCard.
 * Markup mirrors design-system/components/<Comp>/README.md.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { SN, SnIcon, MODULE_ROUTES, moduleOf, type ModuleKey } from '../lib/songnodes';

interface PageHeaderProps {
  mod?: ModuleKey;
  /** Sub-page shown after the band link: "Set builder › Saved sets". */
  here?: string;
  lead: string;
  title: string;
  desc?: React.ReactNode;
  stampVerb?: string;
  stamp?: Date | string | null;
  pill?: React.ReactNode;
  /** Secondary buttons, then the single primary (always last). */
  actions?: React.ReactNode;
  size?: 'title-l' | 'title-m';
}

export const PageHeader: React.FC<PageHeaderProps> = ({ mod, here, lead, title, desc, stampVerb = 'Updated', stamp, pill, actions, size = 'title-l' }) => {
  const m = mod ? moduleOf(mod) : null;
  const st = stamp ? new Date(stamp) : null;
  return (
    <header className={`sn-page-header${mod ? ` sn-m-${mod}` : ''}`}>
      {m && mod ? (
        <div className="sn-page-header__band">
          <SnIcon name={m.icon} size={16} />
          <Link className="sn-link" to={MODULE_ROUTES[mod]}>{m.label}</Link>
          {here ? <><span className="sn-page-header__band-sep" aria-hidden="true">›</span><span className="sn-page-header__band-here">{here}</span></> : null}
        </div>
      ) : null}
      <div className="sn-page-header__main">
        <div className="sn-page-header__text">
          <h1 className={`sn-title ${size}`}><span className="sn-lead">{lead}:</span> {title}</h1>
          {desc ? <p className="sn-page-header__desc">{desc}</p> : null}
          {st || pill ? (
            <p className="sn-page-header__meta">
              {st ? (
                <span className="sn-page-header__stamp">
                  <SnIcon name="clock" size={14} />
                  {stampVerb} <time dateTime={st.toISOString()}>{SN.format.stamp(st)}</time>
                </span>
              ) : null}
              {pill}
            </p>
          ) : null}
        </div>
        {actions ? <div className="sn-page-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
};

export const EmptyState: React.FC<{ icon: string; title: string; children?: React.ReactNode; actions?: React.ReactNode; meta?: React.ReactNode }> = ({ icon, title, children, actions, meta }) => (
  <div className="sn-empty-state">
    <div className="sn-empty-state__icon"><SnIcon name={icon} size={24} /></div>
    <h3 className="sn-empty-state__title">{title}</h3>
    {children ? <p className="sn-empty-state__text">{children}</p> : null}
    {meta ? <div className="sn-empty-state__meta">{meta}</div> : null}
    {actions ? <div className="sn-empty-state__actions">{actions}</div> : null}
  </div>
);

export const SectionHeading: React.FC<{ title: string; lead?: string; count?: string; caveat?: React.ReactNode; action?: React.ReactNode; id?: string; rule?: boolean }> = ({ title, lead, count, caveat, action, id, rule }) => (
  <div className={`sn-section-heading${rule ? ' sn-section-heading--rule' : ''}`}>
    <h2 className="sn-title title-m" id={id}>{lead ? <><span className="sn-lead">{lead}:</span> </> : null}{title}</h2>
    {count ? <span className="sn-section-heading__count">{count}</span> : null}
    {action ? <div className="sn-section-heading__end">{action}</div> : null}
    {caveat ? <p className="sn-section-heading__caveat">{caveat}</p> : null}
  </div>
);

export const LauncherCard: React.FC<{ mod: ModuleKey; title: string; summary: string; figures?: [string, React.ReactNode][]; pill?: React.ReactNode; to?: string }> = ({ mod, title, summary, figures = [], pill, to }) => {
  const m = moduleOf(mod);
  const id = `lc-${mod}`;
  return (
    <Link
      className={`sn-card sn-card--tonal sn-launcher-card sn-m-${mod}`}
      to={to ?? MODULE_ROUTES[mod]}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-s${figures.length ? ` ${id}-f` : ''}${pill ? ` ${id}-p` : ''}`}
    >
      <div className="sn-card__head">
        <span className="sn-launcher-card__icon"><SnIcon name={m.icon} /></span>
        {pill ? <span id={`${id}-p`}>{pill}</span> : null}
      </div>
      <h3 className="sn-title title-s" id={`${id}-t`}><span className="sn-lead">{m.label}:</span> {title}</h3>
      <p className="sn-launcher-card__summary" id={`${id}-s`}>{summary}</p>
      {figures.length ? (
        <dl className="sn-launcher-card__figures" id={`${id}-f`}>
          {figures.map(([label, value]) => (
            <div className="sn-launcher-card__figure" key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      ) : null}
    </Link>
  );
};
