import { Loader } from '#/shared/design-system/loader.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ViewPanel } from './view-panel.tsx';

/**
 * A view that is still being read. The line is an `output`, which is a live
 * region, so the wait is announced; the spinner beside it only repeats what
 * the line already says.
 */
export function LoadingPanel({ label }: { label: string }) {
  return (
    <ViewPanel>
      {/* Decorative: the line under it is what says the page is loading. */}
      <Loader size="md" aria-hidden />
      <Text component="output" c="dimmed">
        {label}
      </Text>
    </ViewPanel>
  );
}
