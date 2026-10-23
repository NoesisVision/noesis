import type { ReactNode } from 'react';
import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { CHANGE_COLOUR } from '#/features/design-docs/ui/model-tree/outline-change.ts';
import { Badge, type BadgeProps } from '#/shared/design-system/badge.tsx';
import { Box } from '#/shared/design-system/box.tsx';

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
      tt="capitalize"
      // A dot in the change's colour before its word: the word says it, the
      // dot catches the eye.
      leftSection={
        <Box
          component="span"
          aria-hidden
          display="block"
          w={6}
          h={6}
          bg={`${colour}.6`}
          style={{ borderRadius: '50%' }}
        />
      }
    >
      {children}
    </Badge>
  );
}
