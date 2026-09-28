import type { ReactNode } from 'react';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Group } from '#/shared/design-system/group.tsx';

export function Names({
  change,
  colour,
  names,
}: {
  change: string;
  colour: string;
  names: string[];
}): ReactNode {
  if (names.length === 0) return null;
  return (
    <Group gap="xs" wrap="wrap">
      <Badge size="xs" color={colour} variant="light">
        {change}
      </Badge>
      {names.map((name) => (
        <code key={name}>{name}</code>
      ))}
    </Group>
  );
}
