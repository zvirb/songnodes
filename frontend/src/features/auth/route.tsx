import React from 'react';
import type { RouteDef } from '../../routes/registry';

const LoginPage = React.lazy(() => import('./LoginPage'));

export const route: RouteDef = {
  path: '/login',
  element: <LoginPage />,
};
