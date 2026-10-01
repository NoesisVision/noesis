import { Badge } from '#/shared/design-system/badge.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import type { Visibility } from '#backend/app/system-model/system-model.ts';

/**
 * Who may call a behaviour, in a word: `public` with the actors it names, or
 * `private` to its own module. Nothing when the design does not say.
 */
export function VisibilityBadge({
  visibility,
}: {
  visibility: Visibility | null;
}) {
  if (visibility === null) return null;
  if (visibility.kind === 'private')
    return (
      <Badge variant="outline" size="xs" color="gray">
        private
      </Badge>
    );
  return (
    <Group gap="xs">
      <Badge variant="outline" size="xs" color="brand">
        public
      </Badge>
    </Group>
  );
}
