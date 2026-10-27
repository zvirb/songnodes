/**
 * SongNodes app: router and shell (design-system 02-information-architecture, 10-navigation).
 * Every page is reached from the NavDrawer; there is no visible nav bar or site tabs.
 */
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './shell/AppShell';
import { getAppRoutes } from './routes/registry';

const OAuthCallback = React.lazy(() => import('./components/OAuthCallback'));

const PageLoading: React.FC = () => (
  <main className="sn-page__main" id="main">
    <div className="sn-loading-state" aria-busy="true" data-slow>
      <div className="sn-card sn-loading-state__tiles" style={{ minHeight: '120px' }}>
        <span className="sn-skel" style={{ '--w': '40%', '--h': '1.75rem' } as React.CSSProperties} />
        <span className="sn-skel" style={{ '--w': '70%' } as React.CSSProperties} />
      </div>
      <p className="sn-loading-state__msg" role="status">Loading page…</p>
    </div>
  </main>
);

const App: React.FC = () => {
  const routes = getAppRoutes();

  return (
    <BrowserRouter>
      <React.Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Service sign-in returns: no shell, the window may be a pop-up (AuthCallbackPage). */}
          <Route path="/callback/spotify" element={<OAuthCallback />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route element={<AppShell />}>
            {routes.map((route, i) => {
              if (route.path === '/') {
                return <Route key="index" index element={route.element} />;
              }
              // Strip leading slash if any because it's a child route,
              // though react-router v6 supports absolute paths in nested routes as well.
              // We'll pass it exactly. If path is "*", it works fine.
              let childPath = route.path;
              if (childPath.startsWith('/') && childPath !== '/') {
                childPath = childPath.slice(1);
              }
              return <Route key={route.path || i} path={childPath} element={route.element} />;
            })}
          </Route>
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
};

export default App;
