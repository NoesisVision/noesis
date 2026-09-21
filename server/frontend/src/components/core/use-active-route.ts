import { useMatches } from '@tanstack/react-router';
import { APP_PUBLIC_ROUTES, type AppRouteIds } from '#/routes/routes.ts';

const allRoutes = Object.values(APP_PUBLIC_ROUTES).flat();

export function useActiveRoute() {
  const matches = useMatches();
  const activeIds = new Set<AppRouteIds>(matches.map((match) => match.routeId));
  const leafId = matches.at(-1)?.routeId;

  const isActive = (routeId: AppRouteIds, exact = false) =>
    exact ? leafId === routeId : activeIds.has(routeId);

  const activeRoute = [...matches]
    .reverse()
    .map((match) => allRoutes.find((route) => route.routeId === match.routeId))
    .find((route) => route !== undefined);

  return {
    isActive,
    activeRoute,
  };
}
