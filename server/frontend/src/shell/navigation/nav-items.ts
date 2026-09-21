import {
  IconBook,
  IconFiles,
  IconLayoutDashboard,
  IconPencilBolt,
  IconTopologyStar3,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import type { FileRouteTypes } from '#/routeTree.gen.ts';
import {
  type AppRouteIds,
  DESIGN_DOCS_ROUTE_ID,
  DOCUMENTS_ROUTE_ID,
  OVERVIEW_ROUTE_ID,
  SYSTEM_MODEL_ROUTE_ID,
  WIKI_ROUTE_ID,
} from '#/shared/routing/route-ids.ts';

interface IconProps {
  size?: number;
  stroke?: number;
}

/** What a view is called wherever the shell names it: sidebar, view header. */
export interface NavItem {
  to: FileRouteTypes['fullPaths'];
  /** The leaf route's id: present in the matches only while that view is on. */
  routeId: AppRouteIds;
  label: string;
  description?: string;
  icon: ComponentType<IconProps>;
  /** The route also matches under its children, so match the leaf exactly. */
  exact?: boolean;
}

const OVERVIEW_NAV = {
  to: '/changes/$changeId',
  routeId: OVERVIEW_ROUTE_ID,
  label: 'Overview',
  description: 'Status, scope and what happened last',
  icon: IconLayoutDashboard,
  exact: true,
} satisfies NavItem;

const DOCUMENTS_NAV = {
  to: '/changes/$changeId/documents',
  routeId: DOCUMENTS_ROUTE_ID,
  label: 'Documents',
  description: 'Imported material that informs the change',
  icon: IconFiles,
} satisfies NavItem;

export const DESIGN_DOCS_NAV = {
  to: '/changes/$changeId/design-docs',
  routeId: DESIGN_DOCS_ROUTE_ID,
  label: 'Design docs',
  description: 'The design documents of this change',
  icon: IconPencilBolt,
  exact: true,
} satisfies NavItem;

const SYSTEM_MODEL_NAV = {
  to: '/system-model',
  routeId: SYSTEM_MODEL_ROUTE_ID,
  label: 'System model',
  description: 'What the code is made of',
  icon: IconTopologyStar3,
} satisfies NavItem;

const WIKI_NAV = {
  to: '/wiki',
  routeId: WIKI_ROUTE_ID,
  label: 'Wiki',
  description: 'Topics and decisions',
  icon: IconBook,
} satisfies NavItem;

/** The two groups the sidebar renders, in the order it renders them. */
export const APP_PUBLIC_NAV = {
  changes: [OVERVIEW_NAV, DOCUMENTS_NAV, DESIGN_DOCS_NAV],
  documentation: [SYSTEM_MODEL_NAV, WIKI_NAV],
} satisfies { changes: NavItem[]; documentation: NavItem[] };
