import React from 'react';
import TrackDetailPage from './TrackDetailPage';
import type { RouteDef } from '../../routes/registry';

export const route: RouteDef[] = [
  { path: '/tracks/:id', element: <TrackDetailPage /> },
  { path: '/track/:id', element: <TrackDetailPage /> },
];
