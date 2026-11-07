import React from 'react';
import type { RouteDef } from '../../routes/registry';

const LibraryPage = React.lazy(() => import('./LibraryPage'));
const SetBuilderPage = React.lazy(() => import('./SetBuilderPage'));
const BuyListPage = React.lazy(() => import('./BuyListPage'));

export const route: RouteDef[] = [
  { path: '/library', element: <LibraryPage /> },
  { path: '/sets', element: <SetBuilderPage /> },
  { path: '/library/buy', element: <BuyListPage /> }
];
