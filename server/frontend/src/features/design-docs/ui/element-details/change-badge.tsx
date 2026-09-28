import { Badge, type BadgeProps } from '#/shared/design-system/badge.tsx';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import { CHANGE_COLOUR } from '#/shared/ui/model-tree/outline-change.ts';

interface ChangeBadge {
  change: OutlineNode['change'];
  size?: BadgeProps['size'];
}

export function ChangeBadge({ change, size = 'xs' }: ChangeBadge) {
  const colour = CHANGE_COLOUR[change];
  if (colour === null) return null;
  return (
    <Badge color={colour} variant="light" size={size}>
      {change}
    </Badge>
  );
}
