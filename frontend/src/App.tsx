/**
 * SongNodes app: router and shell (design-system 02-information-architecture, 10-navigation).
 * Every page is reached from the NavDrawer; there is no visible nav bar or site tabs.
 */
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './shell/AppShell';
import HomePage from './pages/HomePage';
import { NotFoundPage, PlannedModulePage, SourcesPage } from './pages/ModulePages';

const GraphPage = React.lazy(() => import('./pages/GraphPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const CamelotPage = React.lazy(() => import('./pages/CamelotPage'));
const ScraperProgressPage = React.lazy(() => import('./pages/ScraperProgressPage'));
const LibraryPage = React.lazy(() => import('./features/musicLibrary/LibraryPage'));
const SetBuilderPage = React.lazy(() => import('./features/musicLibrary/SetBuilderPage'));
const OAuthCallback = React.lazy(() => import('./components/OAuthCallback'));

const PageLoading: React.FC = () => (
  <main className="sn-page__main" id="main" aria-busy="true">
    <div className="sn-card" style={{ minHeight: 120 }}>
      <span className="sn-skel" style={{ width: '40%', height: '1.75rem' }} />
      <span className="sn-skel" style={{ width: '70%' }} />
    </div>
  </main>
);

const App: React.FC = () => (
  <BrowserRouter>
    <React.Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Service sign-in returns: no shell, the window may be a pop-up (AuthCallbackPage). */}
        <Route path="/callback/spotify" element={<OAuthCallback />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="graph" element={<GraphPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="sets" element={<SetBuilderPage />} />
          <Route path="paths" element={<PlannedModulePage mod="paths" />} />
          <Route path="harmony" element={<CamelotPage />} />
          <Route path="sources" element={<Navigate to="/sources/targets" replace />} />
          <Route path="sources/targets" element={<SourcesPage />} />
          <Route path="pipeline" element={<ScraperProgressPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </React.Suspense>
  </BrowserRouter>
);

export default App;
