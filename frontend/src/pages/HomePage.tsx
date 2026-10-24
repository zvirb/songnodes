/** Home launcher at / (design-system HomePage): one tonal LauncherCard per module, in drawer order. */
import React, { useEffect, useState } from 'react';
import { usePageHeader } from '../shell/AppShell';
import { PageHeader, LauncherCard, SectionHeading } from '../shell/PageParts';
import { SN } from '../lib/songnodes';
import { loadLibrary, readSavedSets, type LibraryFile } from '../features/musicLibrary/data';

const HomePage: React.FC = () => {
  const [lib, setLib] = useState<LibraryFile | null>(null);
  const [libError, setLibError] = useState(false);
  const sets = readSavedSets();

  useEffect(() => {
    loadLibrary().then(setLib).catch(() => setLibError(true));
  }, []);

  usePageHeader({ lead: 'SongNodes', title: 'Home', current: 'home', updatedAt: lib?.generated });

  const none = <span className="sn-none">–</span>;
  const tracks = lib ? SN.format.count(lib.tracks.length) : none;
  const review = lib ? SN.format.count(lib.tracks.filter((t) => t.rev).length) : none;
  const lastRun = lib?.runs?.[lib.runs.length - 1];
  const tidalSets = sets.filter((s) => s.tidal).length;

  return (
    <main className="sn-page__main sn-page-home" id="main" tabIndex={-1}>
      <PageHeader
        lead="SongNodes"
        title="Home"
        desc="Jump into a module. The track graph and the Melbourne club library share one system."
        stampVerb="Library data from"
        stamp={lib?.generated ?? null}
      />
      <section className="sn-page__section" aria-labelledby="mod-t">
        <SectionHeading id="mod-t" title="Modules" count="8" />
        <div className="sn-launcher-card__grid">
          <LauncherCard mod="sets" title={`${SN.format.count(sets.length)} saved sets`} summary="Shape a set from the crate, check every transition and save it." figures={[['send to TIDAL', SN.format.count(tidalSets)]]} />
          <LauncherCard mod="paths" title="Route finder" summary="Routes from one track to another through proven transitions." />
          <LauncherCard mod="graph" title="Adjacency" summary="Explore which tracks DJs play next to each other." />
          <LauncherCard
            mod="library"
            title={lib ? `${tracks} tracks` : 'Melbourne crate'}
            summary={libError ? 'The library file did not load. It is refreshed by the weekly run.' : 'Filter, search and sort the club library, then build a set from what is left.'}
            figures={[['tracks', tracks], ['need an energy check', review]]}
          />
          <LauncherCard mod="harmony" title="Camelot wheel" summary="Keys, mood and energy across the library." />
          <LauncherCard
            mod="sources"
            title="Target tracks"
            summary={lastRun ? `Weekly run ${SN.format.dateOnly(lastRun.date)} added ${SN.format.count(lastRun.added)} tracks.` : 'Tracklists, radio, targets and imports.'}
            figures={lastRun ? [['added', SN.format.count(lastRun.added)], ['rejected', SN.format.count(lastRun.rejected)]] : []}
          />
          <LauncherCard mod="pipeline" title="Scrapers and jobs" summary="Pipeline health is planned; scrapers report through Grafana until then." />
          <LauncherCard mod="services" title="Settings" summary="Spotify, TIDAL, API keys, theme, text size and density." />
        </div>
      </section>
    </main>
  );
};

export default HomePage;
