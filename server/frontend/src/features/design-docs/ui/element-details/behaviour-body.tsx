import { Badge } from '#/shared/design-system/badge.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { DesignedBehaviourInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../design-doc-field.ts';
import { Description } from './description.tsx';
import { Refs } from './refs.tsx';

export function BehaviourBody({
  behaviour,
}: {
  behaviour: DesignedBehaviourInput;
}) {
  const visibility = valueOf(behaviour.visibility);
  const actors = visibility?.kind === 'public' ? visibility.actors : [];
  return (
    <Stack gap="xs">
      {visibility?.kind === 'public' && (
        <Group gap="xs">
          {actors.length > 0 && (
            <Text size="sm" c="dimmed">
              {actors.join(', ')}
            </Text>
          )}
          <Badge variant="outline">public</Badge>
        </Group>
      )}
      <Description field={behaviour.description} />
      <Refs title="Input" set={behaviour.input} />
      <Refs title="Output" set={behaviour.output} />
    </Stack>
  );
}
