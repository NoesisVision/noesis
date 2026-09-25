import { Badge } from '#/shared/design-system/badge.tsx';
import type { OutlineChange } from '#backend/app/model-outline/model-outline.ts';
import { CHANGE_COLOUR } from './outline-change.ts';

/** The colour says it at a glance; the word says it at all. */
export function ChangeBadge({ change }: { change: OutlineChange }) {
  const colour = CHANGE_COLOUR[change];
  if (colour === null) return null;
  return (
    <Badge size="xs" color={colour} variant="light">
      {change}
    </Badge>
  );
}
