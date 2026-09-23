import type { ReactNode } from 'react';
import { Center } from '#/shared/design-system/center.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';

interface ViewPanelProps {
  children: ReactNode;
  /** Styling of the box itself, for a panel that needs more than the layout. */
  className?: string;
  /**
   * Says the panel when it appears, for what the reader did not ask to see.
   * A failure is announced; an answer and a wait are not — the wait carries
   * its own live region in the line that names it.
   */
  announce?: boolean;
}

/**
 * The box everything that fills a view instead of its content sits in: a
 * failure, a missing thing, a view with nothing in it, a view still being
 * read. `AppShell.Main` has no height of its own, so the height is here.
 */
export function ViewPanel({
  children,
  className,
  announce = false,
}: ViewPanelProps) {
  return (
    <Center mih="60vh">
      <Stack
        align="center"
        gap="sm"
        maw={420}
        ta="center"
        className={className}
        role={announce ? 'alert' : undefined}
      >
        {children}
      </Stack>
    </Center>
  );
}
