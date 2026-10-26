import React from 'react';
import type { RouteDef } from '../../routes/registry';

const LibraryPage = React.lazy(() => import('./LibraryPage'));
const SetBuilderPage = React.lazy(() => import('./SetBuilderPage'));

export const route: RouteDef[] = [
  { path: '/library', element: <LibraryPage /> },
  { path: '/sets', element: <SetBuilderPage /> }
];
