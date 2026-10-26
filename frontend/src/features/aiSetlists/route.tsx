import React from 'react';
import type { RouteDef } from '../../routes/registry';

const AISetlistsPage = React.lazy(() => import('./AISetlistsPage'));

export const route: RouteDef[] = [
  { path: '/sources/import', element: <AISetlistsPage /> }
];
