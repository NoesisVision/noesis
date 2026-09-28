import type { ReactNode } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import { useChangeColour } from '#/shared/ui/model-tree/use-change-colour.ts';

export function Ref({
  change,
  name,
  monospace = false,
}: {
  change: OutlineChange;
  name: string | undefined;
  monospace?: boolean;
}): ReactNode {
  // Before the early return: a hook runs on every render or on none.
  const getColor = useChangeColour();
  if (!name) return null;
  const colour = getColor(change) ?? undefined;
  return (
    <Text
      // A span, so a line can sit inside the button that opens its row.
      component="span"
      display="block"
      ff={monospace ? 'monospace' : undefined}
      c={colour?.color}
      size="sm"
      td={change === 'removed' ? 'line-through' : undefined}
      key={name}
    >
      {name}
    </Text>
  );
}
