import { useMatches } from '@tanstack/react-router';
import { APP_PUBLIC_NAV } from './nav-items.ts';

const allItems = Object.values(APP_PUBLIC_NAV).flat();

/**
 * Which navigation item the page is on, for the header that names it.
 *
 * Whether a *link* is the one you are on is not asked here: the sidebar's
 * links answer that themselves, against the address. Two ways of answering it
 * agreed by luck until they did not, and a disagreement lit nothing at all.
 */
export function useActiveRoute() {
  const matches = useMatches();

  // The deepest match that names a view: a leaf's own layout would otherwise
  // answer for it.
  const activeItem = [...matches]
    .reverse()
    .map((match) => allItems.find((item) => item.routeId === match.routeId))
    .find((item) => item !== undefined);

  return { activeItem };
}
