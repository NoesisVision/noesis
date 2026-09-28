import { Stack } from '#/shared/design-system/stack.tsx';
import type { DesignedBuildingBlockInput } from '#backend/app/design-docs/design-doc.ts';
import { Description } from './description.tsx';
import { Refs } from './refs.tsx';

export function BuildingBlockBody({
  block,
}: {
  block: DesignedBuildingBlockInput;
}) {
  return (
    <Stack gap="xs">
      <Description field={block.description} />
      <Refs title="Implements" set={block.implements} />
    </Stack>
  );
}
