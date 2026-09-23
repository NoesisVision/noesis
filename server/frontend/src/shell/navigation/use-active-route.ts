import { useMatches } from '@tanstack/react-router';
import type { AppRouteIds } from '#/shared/routing/route-ids.ts';
import { APP_PUBLIC_NAV } from './nav-items.ts';

const allItems = Object.values(APP_PUBLIC_NAV).flat();

export function useActiveRoute() {
  const matches = useMatches();
  const activeIds = new Set<AppRouteIds>(matches.map((match) => match.routeId));
  const leafId = matches.at(-1)?.routeId;

  // A view's route id names its layout, but a list page ends on that layout's
  // index route — the same id with a trailing slash — so an exact match has to
  // accept both. Matching only the layout would light no heading at all.
  const isActive = (routeId: AppRouteIds, exact = false) =>
    exact
      ? leafId === routeId || leafId === `${routeId}/`
      : activeIds.has(routeId);

  const activeItem = [...matches]
    .reverse()
    .map((match) => allItems.find((item) => item.routeId === match.routeId))
    .find((item) => item !== undefined);

  return {
    isActive,
    activeItem,
  };
}
