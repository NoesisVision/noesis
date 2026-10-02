import type { ReactNode } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';

export function Ref({
  change,
  name,
  interactive,
  qualified,
}: {
  change: OutlineChange;
  name: string | undefined;
  /** Inside a button that opens the row, and coloured as a button is. */
  interactive?: boolean;
  /** A dotted, qualified name, shown by its last segment with the whole in a
      tooltip. */
  qualified?: boolean;
}): ReactNode {
  if (!name) return null;
  const text = (short: string) => (
    <Text
      // A span, so a line can sit inside the button that opens its row.
      component="span"
      display="block"
      lts={0.5}
      // A line that opens its row takes the colour a subtle button carries —
      // the breadcrumb's — and the rest none at all.
      c={interactive ? 'var(--mantine-color-brand-light-color)' : undefined}
      size="sm"
      td={change === 'removed' ? 'line-through' : undefined}
      key={name}
    >
      {short}
    </Text>
  );
  return qualified ? <QualifiedName name={name} render={text} /> : text(name);
}
