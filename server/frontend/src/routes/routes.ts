import {
  IconBook,
  IconFiles,
  IconLayoutDashboard,
  IconMessages,
  IconPencilBolt,
  IconTopologyStar3,
} from '@tabler/icons-react';
import type { RouteIds } from '@tanstack/react-router';
import type { ComponentType } from 'react';
import type { FileRouteTypes, routeTree } from '#/routeTree.gen.ts';

interface IconProps {
  size?: number;
  stroke?: number;
}

export type AppRouteIds = FileRouteTypes['id'];
type AppRoutePaths = FileRouteTypes['fullPaths'];
export type ChangeRoutePaths = Extract<
  AppRoutePaths,
  `/changes/$changeId${string}`
>;

export const SHELL_ROUTE_ID = '/_shell';

interface AppRoute {
  to: AppRoutePaths;
  /** The leaf route's id: present in the matches only while that view is on. */
  routeId: RouteIds<typeof routeTree>;
  label: string;
  description?: string;
  icon: ComponentType<IconProps>;
  exact?: boolean;
}

export const OVERVIEW_ROUTE = {
  to: '/changes/$changeId',
  routeId: `${SHELL_ROUTE_ID}/changes/$changeId`,
  label: 'Overview',
  description: 'Status, scope and what happened last',
  icon: IconLayoutDashboard,
  exact: true,
} satisfies AppRoute;

export const DOCUMENTS_ROUTE = {
  to: '/changes/$changeId/documents',
  routeId: `${SHELL_ROUTE_ID}/changes/$changeId/documents`,
  label: 'Documents',
  description: 'Imported material that informs the change',
  icon: IconFiles,
} satisfies AppRoute;

export const CONVERSATIONS_ROUTE = {
  to: '/changes/$changeId/conversations',
  routeId: `${SHELL_ROUTE_ID}/changes/$changeId/conversations`,
  label: 'Conversations',
  description: 'Imported discussions with the agent',
  icon: IconMessages,
} satisfies AppRoute;

export const DESIGN_DOCS_ROUTE = {
  to: '/changes/$changeId/design-docs',
  routeId: `${SHELL_ROUTE_ID}/changes/$changeId/design-docs`,
  label: 'Design docs',
  description: 'The design documents of this change',
  icon: IconPencilBolt,
  exact: true,
} satisfies AppRoute;

export const DESIGN_DOC_ROUTE = {
  to: '/changes/$changeId/design-docs/$docId',
  routeId: `${SHELL_ROUTE_ID}/changes/$changeId/design-docs/$docId`,
  label: 'Design doc',
  description: 'The design document of this change',
  icon: IconPencilBolt,
} satisfies AppRoute;

export const SYSTEM_MODEL_ROUTE = {
  to: '/system-model',
  routeId: `${SHELL_ROUTE_ID}/system-model`,
  label: 'System model',
  description: 'What the code is made of',
  icon: IconTopologyStar3,
} satisfies AppRoute;

export const WIKI_ROUTE = {
  to: '/wiki',
  routeId: `${SHELL_ROUTE_ID}/wiki`,
  label: 'Wiki',
  description: 'Topics and decisions',
  icon: IconBook,
} satisfies AppRoute;

export const APP_PUBLIC_ROUTES = {
  changes: [
    OVERVIEW_ROUTE,
    DOCUMENTS_ROUTE,
    CONVERSATIONS_ROUTE,
    DESIGN_DOCS_ROUTE,
  ],
  documentation: [SYSTEM_MODEL_ROUTE, WIKI_ROUTE],
} satisfies { changes: AppRoute[]; documentation: AppRoute[] };
