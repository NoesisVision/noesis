import {
  IconLayoutDashboard,
  IconTopologyStar3,
  IconTools,
} from '@tabler/icons-react';
import { DesignDocsIcon } from '#/features/design-docs/design-docs.model.ts';
import { DocumentsIcon } from '#/features/documents/documents.model.ts';
import type { FileRouteTypes } from '#/routeTree.gen.ts';
import {
  type AppRouteIds,
  DESIGN_DOCS_ROUTE_ID,
  DEV_TOOLS_ROUTE_ID,
  DOCUMENTS_ROUTE_ID,
  OVERVIEW_ROUTE_ID,
  SYSTEM_MODEL_ROUTE_ID,
} from '#/shared/routing/route-ids.ts';
import type { IconComponent } from '#/shared/ui/icon-heading.tsx';

/**
 * How every navigation link decides whether it is the one you are on.
 * One mechanism, stated once: the link's own match against the address.
 *
 * `exact`, so a heading stops being active the moment one of its items opens
 * — the heading marks that some other way, and a fuzzy match would light the
 * heading and the item both.
 *
 * Search left out, because a navigation link names a view and never a reading
 * position inside it. A design document keeps the element in hand and the
 * search in the address, and the link that led there is still the link you
 * are on.
 */
export const ACTIVE_OPTIONS = { exact: true, includeSearch: false } as const;

/** What a view is called wherever the shell names it: sidebar, view header. */
export interface NavItem {
  to: FileRouteTypes['fullPaths'];
  /** The leaf route's id: present in the matches only while that view is on. */
  routeId: AppRouteIds;
  label: string;
  description?: string;
  icon: IconComponent;
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

export const DOCUMENTS_NAV = {
  to: '/changes/$changeId/documents',
  routeId: DOCUMENTS_ROUTE_ID,
  label: 'Documents',
  description: 'Imported material that informs the change',
  icon: DocumentsIcon,
  exact: true,
} satisfies NavItem;

export const DESIGN_DOCS_NAV = {
  to: '/changes/$changeId/design-docs',
  routeId: DESIGN_DOCS_ROUTE_ID,
  label: 'Design docs',
  description: 'The design documents of this change',
  icon: DesignDocsIcon,
  exact: true,
} satisfies NavItem;

const SYSTEM_MODEL_NAV = {
  to: '/system-model',
  routeId: SYSTEM_MODEL_ROUTE_ID,
  label: 'System model',
  description: 'What the code is made of',
  icon: IconTopologyStar3,
} satisfies NavItem;

const DEV_TOOLS_NAV = {
  to: '/dev-tools',
  routeId: DEV_TOOLS_ROUTE_ID,
  label: 'Dev tools',
  description: 'For internal use',
  icon: IconTools,
} satisfies NavItem;

/** The two groups the sidebar renders, in the order it renders them. */
export const APP_PUBLIC_NAV = {
  changes: [OVERVIEW_NAV, DOCUMENTS_NAV, DESIGN_DOCS_NAV],
  documentation: [SYSTEM_MODEL_NAV],
  devTools: [DEV_TOOLS_NAV],
} satisfies {
  changes: NavItem[];
  documentation: NavItem[];
  devTools: NavItem[];
};
