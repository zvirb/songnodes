import React from 'react';
import { Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import { NotFoundPage, PlannedModulePage, SourcesPage } from '../pages/ModulePages';

const GraphPage = React.lazy(() => import('../pages/GraphPage'));
const SettingsPage = React.lazy(() => import('../pages/SettingsPage'));
const ScraperProgressPage = React.lazy(() => import('../pages/ScraperProgressPage'));

export type RouteDef = { path: string; element: React.ReactElement };

// Base static routes, matching what App.tsx previously had directly.
const STATIC_ROUTES: RouteDef[] = [
  { path: '/', element: <HomePage /> },
  { path: '/graph', element: <GraphPage /> },
  { path: '/paths', element: <PlannedModulePage mod="paths" /> },
  { path: '/sources', element: <Navigate to="/sources/targets" replace /> },
  { path: '/sources/targets', element: <SourcesPage /> },
  { path: '/pipeline', element: <ScraperProgressPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/settings/:settingId', element: <SettingsPage /> },
  { path: '*', element: <NotFoundPage /> },
];

export function getAppRoutes(): RouteDef[] {
  // Vite specific
  const modules = import.meta.glob('../features/*/route.tsx', { eager: true });

  const routes = [...STATIC_ROUTES];
  const discoveredPaths = new Set<string>();

  for (const path in modules) {
    const mod = modules[path] as { route?: RouteDef | RouteDef[] };
    if (mod.route) {
      const defs = Array.isArray(mod.route) ? mod.route : [mod.route];
      for (const def of defs) {
        if (discoveredPaths.has(def.path)) {
          throw new Error(`Duplicate discovered route path: ${def.path}`);
        }
        discoveredPaths.add(def.path);

        // Find existing route in static routes to replace
        const existingIndex = routes.findIndex(r => r.path === def.path);
        if (existingIndex >= 0) {
          routes[existingIndex] = def;
        } else {
          // Add before wildcard/NotFound if it exists
          const wildcardIndex = routes.findIndex(r => r.path === '*');
          if (wildcardIndex >= 0) {
            routes.splice(wildcardIndex, 0, def);
          } else {
            routes.push(def);
          }
        }
      }
    }
  }
  return routes;
}
