import type { ReactNode } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';

/**
 * A reference split into its optional name and its type, the type read by
 * its qualified name's last segment:
 * - `string` → `{ type: 'string' }`
 * - `name: string` → `{ name: 'name', type: 'string' }`
 * - `name: a.b.C` → `{ name: 'name', type: 'C' }`
 */
export const shortName = (ref: string): { type: string; name?: string } => {
  const colon = ref.indexOf(':');
  const qualified = ref.slice(colon + 1).trim();
  const type = qualified.slice(qualified.lastIndexOf('.') + 1);
  return colon === -1 ? { type } : { type, name: ref.slice(0, colon).trim() };
};

/** A reference as read: `name: a.b.C` reads as `name: C`. */
export const shortLabel = (ref: string): string => {
  const { type, name } = shortName(ref);
  return name ? `${name}: ${type}` : type;
};

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
  const short = qualified ? shortLabel(name) : name;
  const text = (
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
  return short === name ? (
    text
  ) : (
    <Tooltip openDelay={300} label={name} position="right">
      {text}
    </Tooltip>
  );
}
