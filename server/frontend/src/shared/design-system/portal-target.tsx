import { MantineThemeProvider } from '@mantine/core';
import { type ReactNode, useMemo } from 'react';

/**
 * Sends everything portalled below it — a dropdown, a tooltip, a modal — into
 * the element a selector names, rather than the body. `null` leaves each
 * where it would go; a `target` a component is given itself still wins.
 */
export function PortalTarget({
  target,
  children,
}: {
  target: string | null;
  children: ReactNode;
}) {
  const theme = useMemo(
    () =>
      target === null
        ? {}
        : { components: { Portal: { defaultProps: { target } } } },
    [target],
  );
  return <MantineThemeProvider theme={theme}>{children}</MantineThemeProvider>;
}
