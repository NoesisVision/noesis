import type { RouteIds } from '@tanstack/react-router';
import type { FileRouteTypes, routeTree } from '#/routeTree.gen.ts';

export type AppRouteIds = RouteIds<typeof routeTree>;
type AppRoutePaths = FileRouteTypes['fullPaths'];
export type ChangeRoutePaths = Extract<
  AppRoutePaths,
  `/changes/$changeId${string}`
>;

const SHELL_ROUTE_ID = '/_shell';

export const OVERVIEW_ROUTE_ID =
  `${SHELL_ROUTE_ID}/changes/$changeId` satisfies AppRouteIds;
export const DOCUMENTS_ROUTE_ID =
  `${SHELL_ROUTE_ID}/changes/$changeId/documents` satisfies AppRouteIds;
export const CONVERSATIONS_ROUTE_ID =
  `${SHELL_ROUTE_ID}/changes/$changeId/conversations` satisfies AppRouteIds;
export const DESIGN_DOCS_ROUTE_ID =
  `${SHELL_ROUTE_ID}/changes/$changeId/design-docs` satisfies AppRouteIds;
export const SYSTEM_MODEL_ROUTE_ID =
  `${SHELL_ROUTE_ID}/system-model` satisfies AppRouteIds;
export const WIKI_ROUTE_ID = `${SHELL_ROUTE_ID}/wiki` satisfies AppRouteIds;
