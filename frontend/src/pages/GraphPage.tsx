/**
 * Graph module (/graph): the existing DJ interface (Play/Plan) inside the shell.
 * Phase 4 of design-system/19-songnodes-migration.md splits DJInterface into
 * GraphExplorerPage; until then it renders here at full height under AppHeader.
 */
import React, { useEffect } from 'react';
import { usePageHeader } from '../shell/AppShell';
import { useStore } from '../store/useStore';
import { useTokenRefresh } from '../hooks/useTokenRefresh';
import { QuickSearch } from '../components/QuickSearch';

const DJInterface = React.lazy(() => import('../components/DJInterface').then((m) => ({ default: m.DJInterface })));

/** One-time move of TIDAL tokens from the old localStorage key into the store. */
function useLegacyTokenMigration() {
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tidal_oauth_tokens');
      if (!raw) return;
      const legacy = JSON.parse(raw);
      const store = useStore.getState();
      if (!store.musicCredentials.tidal?.accessToken && legacy.access_token) {
        store.credentials.updateCredentials('tidal', {
          accessToken: legacy.access_token,
          refreshToken: legacy.refresh_token,
          expiresAt: legacy.expires_at,
          isConnected: true,
          lastValidated: Date.now(),
        });
      }
      localStorage.removeItem('tidal_oauth_tokens');
    } catch (error) {
      console.error('[Graph] Failed to migrate legacy tokens:', error);
    }
  }, []);
}

const GraphPage: React.FC = () => {
  usePageHeader({ lead: 'Graph', title: 'Adjacency', current: 'graph' });
  useTokenRefresh();
  useLegacyTokenMigration();

  return (
    <main className="sn-graph-route" id="main" tabIndex={-1}>{/* design-system exception: the graph canvas is the only full-bleed page (05-layout, 13-page-patterns) */}
      <React.Suspense
        fallback={
          <div className="sn-graph-route__loading" aria-busy="true">
            <span className="sn-spinner" aria-hidden="true" />
            <span>Loading the graph…</span>
          </div>
        }
      >
        <DJInterface />
      </React.Suspense>
      <QuickSearch />
    </main>
  );
};

export default GraphPage;
