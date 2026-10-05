import type { ReactNode } from 'react';
import { PortalTarget } from '#/shared/design-system/portal-target.tsx';
import { useFullscreenRoot } from './use-fullscreen-root.ts';

/**
 * Keeps what is portalled in sight while an element is full screen: the
 * browser paints only that element then, so a dropdown, a tooltip or a modal
 * opened in the body would open unseen. Mounted once, around the app.
 */
export function FullscreenPortals({ children }: { children: ReactNode }) {
  const root = useFullscreenRoot();
  return (
    <PortalTarget target={root === null ? null : ':fullscreen'}>
      {children}
    </PortalTarget>
  );
}
