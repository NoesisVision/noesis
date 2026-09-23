import { Loader } from '#/shared/design-system/loader.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ViewPanel } from './view-panel.tsx';
import classes from './loading-panel.module.css';

/**
 * A view that is still being read. The line is an `output`, which is a live
 * region, so the wait is announced; the spinner beside it only repeats what
 * the line already says. It holds off for a moment first, so a read that is
 * over quickly never shows one at all.
 */
export function LoadingPanel({ label }: { label: string }) {
  return (
    <ViewPanel className={classes.delayed}>
      {/* Decorative: the line under it is what says the page is loading. */}
      <Loader size="md" aria-hidden />
      <Text component="output" c="dimmed">
        {label}
      </Text>
    </ViewPanel>
  );
}
