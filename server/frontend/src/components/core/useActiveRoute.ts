import { useMatches } from '@tanstack/react-router';
import {
  type AppRouteIds,
  SIDEBAR_ROUTES,
} from '#/components/shell/sidebar.routes.ts';

const allRoutes = Object.values(SIDEBAR_ROUTES).flat();

export function useActiveRoute() {
  const matches = useMatches();
  const activeIds = new Set<AppRouteIds>(
    useMatches().map((match) => match.routeId),
  );

  const isActive = (routeId: AppRouteIds) => {
    return activeIds.has(routeId);
  };

  const activeRoute = allRoutes.find((route) => {
    return route.routeId === matches.at(-1)?.routeId;
  });

  return {
    isActive,
    activeRoute,
  };
}
