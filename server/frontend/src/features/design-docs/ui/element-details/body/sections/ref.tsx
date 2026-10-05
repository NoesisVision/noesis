import type { ReactNode } from 'react';
import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { Text } from '#/shared/design-system/text.tsx';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import { ElementTooltip } from '../../element-tooltip.tsx';

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
  const text = (content: ReactNode) => (
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
      {content}
    </Text>
  );
  return qualified ? (
    <ElementTooltip name={name}>
      {text(<QualifiedName name={name} />)}
    </ElementTooltip>
  ) : (
    text(name)
  );
}
