import type { ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { ViewHeader } from './view-header.tsx';

/** What a route renders: no props, since the view reads the route itself. */
type ViewComponent = () => ReactNode;

/**
 * The measure a document is read at in its "Convenient" width, as
 * `reading-pane.module.css` sets it: a view centred at it lines up with one.
 */
const READING_MEASURE = 900;

interface ViewHeaderOptions {
  /**
   * Heading and view together in a centred column at the reading measure,
   * like a document read at its convenient width — with no switch to widen
   * it, since a view like this has no full-width reading to offer.
   */
  centred?: boolean;
}

/**
 * Gives a view the shell's heading for it. The composition lives here because
 * a feature may not reach into the shell and a route file may not declare a
 * component, so the route names the pairing instead: the views that say what
 * they are wrap, the detail views under them do not.
 */
export function withViewHeader(
  View: ViewComponent,
  { centred = false }: ViewHeaderOptions = {},
): ViewComponent {
  return function HeadedView() {
    const content = (
      <>
        <ViewHeader />
        <View />
      </>
    );
    return centred ? (
      <Box maw={READING_MEASURE} mx="auto">
        {content}
      </Box>
    ) : (
      content
    );
  };
}
