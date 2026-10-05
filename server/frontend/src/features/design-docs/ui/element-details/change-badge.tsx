import type { ReactNode } from 'react';
import { Badge, type BadgeProps } from '#/shared/design-system/badge.tsx';
import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import { CHANGE_COLOUR } from '#/shared/ui/model-tree/outline-change.ts';

interface ChangeBadge {
  change: OutlineChange;
  /** What it says, when that is not the change's own word. */
  children?: ReactNode;
  size?: BadgeProps['size'];
  /** A span, for a badge inside a button, which holds phrasing content only. */
  inline?: boolean;
}

export function ChangeBadge({
  change,
  children = change,
  size = 'xs',
  inline,
}: ChangeBadge) {
  const colour = CHANGE_COLOUR[change];
  if (colour === null) return null;
  return (
    <Badge
      component={inline ? 'span' : 'div'}
      color={colour}
      variant="light"
      size={size}
    >
      {children}
    </Badge>
  );
}
