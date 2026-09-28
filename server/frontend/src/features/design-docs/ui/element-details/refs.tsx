import { Stack } from '#/shared/design-system/stack.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';
import type { ChangeSetInput } from './change-set.ts';
import { Names } from './names.tsx';
import { refAddressOf } from './ref-address.ts';

/** A change set of type references, shown only when the design touches it. */
export function Refs({
  title,
  set,
}: {
  title: string;
  set: ChangeSetInput<BuildingBlockRefInput, BuildingBlockRefInput> | undefined;
}) {
  const added = (set?.added ?? []).map(refAddressOf);
  const modified = (set?.modified ?? []).map(refAddressOf);
  const removed = (set?.removed ?? []).map(refAddressOf);
  if (!added.length && !modified.length && !removed.length) return null;
  return (
    <>
      <Title order={3} size="h6">
        {title}
      </Title>
      <Stack gap={2}>
        <Names change="added" colour="green" names={added} />
        <Names change="modified" colour="blue" names={modified} />
        <Names change="removed" colour="red" names={removed} />
      </Stack>
    </>
  );
}
