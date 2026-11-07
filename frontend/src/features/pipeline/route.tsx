import React from 'react';
import type { RouteDef } from '../../routes/registry';

const PipelinePage = React.lazy(() => import('../../pages/ScraperProgressPage'));

export const route: RouteDef[] = [
  { path: '/pipeline', element: <PipelinePage /> },
  { path: '/pipeline/runs', element: <PipelinePage /> },
];
