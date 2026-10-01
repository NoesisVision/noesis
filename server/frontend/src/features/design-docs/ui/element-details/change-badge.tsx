import { Badge, type BadgeProps } from '#/shared/design-system/badge.tsx';
import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import { CHANGE_COLOUR } from '#/shared/ui/model-tree/outline-change.ts';

interface ChangeBadge {
  change: OutlineChange;
  size?: BadgeProps['size'];
  /** A span, for a badge inside a button, which holds phrasing content only. */
  inline?: boolean;
}

export function ChangeBadge({ change, size = 'xs', inline }: ChangeBadge) {
  const colour = CHANGE_COLOUR[change];
  if (colour === null) return null;
  return (
    <Badge
      component={inline ? 'span' : 'div'}
      color={colour}
      variant="light"
      size={size}
    >
      {change}
    </Badge>
  );
}
