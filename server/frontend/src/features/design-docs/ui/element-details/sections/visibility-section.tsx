import { Badge } from '#/shared/design-system/badge.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { DesignedBehaviourInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../../design-doc-field.ts';
import type { ElementRef } from '../element-ref.ts';
import { DetailSection } from './detail-section.tsx';

interface VisibilitySectionProps {
  element: ElementRef;
  field: DesignedBehaviourInput['visibility'];
}

/** Who may call a behaviour: anyone it names, or only its own module. */
export function VisibilitySection({ field }: VisibilitySectionProps) {
  const visibility = valueOf(field);
  if (!visibility) return null;

  return (
    <DetailSection title="visibility" field={field}>
      {visibility?.kind === 'public' ? (
        <Group gap="xs">
          <Badge variant="outline" size="xs" color="brand">
            public
          </Badge>
          {visibility.actors.length > 0 && (
            <Text size="sm" c="dimmed">
              {visibility.actors.join(', ')}
            </Text>
          )}
        </Group>
      ) : (
        <Group gap="xs">
          <Badge variant="outline" size="xs" color="gray">
            private
          </Badge>
        </Group>
      )}
    </DetailSection>
  );
}

/** Shown whenever the design says anything about the visibility. */
VisibilitySection.shows = ({ field }: VisibilitySectionProps) =>
  valueOf(field) !== null;
