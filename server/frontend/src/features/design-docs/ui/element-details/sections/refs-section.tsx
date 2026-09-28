import { Stack } from '#/shared/design-system/stack.tsx';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';
import type { ChangeSetInput } from '../change-set.ts';
import type { ElementRef } from '../element-ref.ts';
import { refAddressOf } from '../ref-address.ts';
import { DetailSection } from './detail-section.tsx';
import { Names } from './names.tsx';

interface RefsSectionProps {
  element: ElementRef;
  title: string;
  set: ChangeSetInput<BuildingBlockRefInput, BuildingBlockRefInput> | undefined;
}

/**
 * A change set of type references. Only worth a section when `hasRefs` says
 * the design touches it; the aggregator leaves it out otherwise.
 */
export function RefsSection({ title, set }: RefsSectionProps) {
  const added = (set?.added ?? []).map(refAddressOf);
  const modified = (set?.modified ?? []).map(refAddressOf);
  const removed = (set?.removed ?? []).map(refAddressOf);
  return (
    <DetailSection title={title}>
      <Stack gap={2}>
        <Names change="added" colour="green" names={added} />
        <Names change="modified" colour="blue" names={modified} />
        <Names change="removed" colour="red" names={removed} />
      </Stack>
    </DetailSection>
  );
}
