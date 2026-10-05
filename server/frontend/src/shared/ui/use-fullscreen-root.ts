import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}

function current(): HTMLElement | null {
  const element = document.fullscreenElement;
  return element instanceof HTMLElement ? element : null;
}

/**
 * The element the browser shows full screen, or `null` while it shows the
 * page. Only that element and what is inside it are painted in full screen, so
 * anything portalled to the body has to be portalled here instead to be seen.
 */
export function useFullscreenRoot(): HTMLElement | null {
  return useSyncExternalStore(subscribe, current, () => null);
}
