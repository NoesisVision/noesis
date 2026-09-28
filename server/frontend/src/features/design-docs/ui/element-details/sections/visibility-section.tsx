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

/**
 * Who may call a behaviour. Only worth a section when `isPublic` says the
 * design opens it; the aggregator leaves it out otherwise.
 */
export function VisibilitySection({ field }: VisibilitySectionProps) {
  const visibility = valueOf(field);
  if (visibility?.kind !== 'public') return null;
  return (
    <DetailSection>
      <Group gap="xs">
        {visibility.actors.length > 0 && (
          <Text size="sm" c="dimmed">
            {visibility.actors.join(', ')}
          </Text>
        )}
        <Badge variant="outline">public</Badge>
      </Group>
    </DetailSection>
  );
}
