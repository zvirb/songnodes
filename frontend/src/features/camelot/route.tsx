import React from 'react';
import { RouteDef } from '../../routes/registry';

const CamelotPage = React.lazy(() => import('./CamelotPage'));

export const route: RouteDef = {
  path: '/harmony',
  element: <CamelotPage />,
};
