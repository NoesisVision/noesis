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
export type AppRoutePaths = FileRouteTypes['fullPaths'];

interface SidebarRoute {
  to: AppRoutePaths;
  /** The leaf route's id: present in the matches only while that view is on. */
  routeId: RouteIds<typeof routeTree>;
  label: string;
  description?: string;
  icon: ComponentType<IconProps>;
}

const OVERVIEW_ROUTE = {
  to: '/changes/$changeId',
  routeId: '/_shell/changes/$changeId/',
  label: 'Overview',
  description: 'Status, scope and what happened last',
  icon: IconLayoutDashboard,
} satisfies SidebarRoute;

export const DOCUMENTS_ROUTE = {
  to: '/changes/$changeId/documents',
  routeId: '/_shell/changes/$changeId/documents',
  label: 'Documents',
  description: 'Imported material that informs the change',
  icon: IconFiles,
} satisfies SidebarRoute;

export const CONVERSATIONS_ROUTE = {
  to: '/changes/$changeId/conversations',
  routeId: '/_shell/changes/$changeId/conversations',
  label: 'Conversations',
  description: 'Imported discussions with the agent',
  icon: IconMessages,
} satisfies SidebarRoute;

export const DESIGN_DOCS_ROUTE = {
  to: '/changes/$changeId/design-docs',
  routeId: '/_shell/changes/$changeId/design-docs',
  label: 'Design docs',
  description: 'The design documents of this change',
  icon: IconPencilBolt,
} satisfies SidebarRoute;

const SYSTEM_MODEL_ROUTE = {
  to: '/system-model',
  routeId: '/_shell/system-model',
  label: 'System model',
  description: 'What the code is made of',
  icon: IconTopologyStar3,
} satisfies SidebarRoute;

const WIKI_ROUTE = {
  to: '/wiki',
  routeId: '/_shell/wiki',
  label: 'Wiki',
  description: 'Topics and decisions',
  icon: IconBook,
} satisfies SidebarRoute;

export const SIDEBAR_ROUTES = {
  changes: [
    OVERVIEW_ROUTE,
    DOCUMENTS_ROUTE,
    CONVERSATIONS_ROUTE,
    DESIGN_DOCS_ROUTE,
  ],
  documentation: [SYSTEM_MODEL_ROUTE, WIKI_ROUTE],
} satisfies { changes: SidebarRoute[]; documentation: SidebarRoute[] };
