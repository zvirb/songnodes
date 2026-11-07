import React from 'react';
import type { RouteDef } from '../../routes/registry';
import { AuthProvider } from './AuthContext';

const LoginPage = React.lazy(() => import('./LoginPage'));

export const route: RouteDef = {
  path: '/login',
  element: <AuthProvider><LoginPage /></AuthProvider>,
};
