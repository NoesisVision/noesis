import type { ReactNode } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { useDevToolsContext } from '#/shared/dev-tools/dev-tools-context.tsx';
import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import { useChangeColour } from '#/shared/ui/model-tree/use-change-colour.ts';

export function Ref({
  change,
  name,
  interactive,
}: {
  change: OutlineChange;
  name: string | undefined;
  /** Inside a button that opens the row, and coloured as a button is. */
  interactive?: boolean;
}): ReactNode {
  // Before the early return: a hook runs on every render or on none.
  const getColor = useChangeColour();
  const {
    features: { lessColorsInDesignDocTree },
  } = useDevToolsContext();
  if (!name) return null;
  const colour = getColor(change) ?? undefined;
  return (
    <Text
      // A span, so a line can sit inside the button that opens its row.
      component="span"
      display="block"
      lts={0.5}
      // With fewer colours, a line that opens its row takes the colour a
      // subtle button carries — the breadcrumb's — and the rest none at all.
      c={
        !lessColorsInDesignDocTree
          ? colour?.color
          : interactive
            ? 'var(--mantine-color-brand-light-color)'
            : undefined
      }
      size="sm"
      td={change === 'removed' ? 'line-through' : undefined}
      key={name}
    >
      {name}
    </Text>
  );
}
