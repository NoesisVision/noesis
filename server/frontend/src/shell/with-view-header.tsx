import type { ReactNode } from 'react';
import { ViewHeader } from './view-header.tsx';

/** What a route renders: no props, since the view reads the route itself. */
type ViewComponent = () => ReactNode;

/**
 * Gives a view the shell's heading for it. The composition lives here because
 * a feature may not reach into the shell and a route file may not declare a
 * component, so the route names the pairing instead: the views that say what
 * they are wrap, the detail views under them do not.
 */
export function withViewHeader(View: ViewComponent): ViewComponent {
  return function HeadedView() {
    return (
      <>
        <ViewHeader />
        <View />
      </>
    );
  };
}
