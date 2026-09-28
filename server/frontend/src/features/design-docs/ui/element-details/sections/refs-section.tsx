import { Code } from '#/shared/design-system/code.tsx';
import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';
import type { ChangeSetInput } from '../change-set.ts';
import type { ElementRef } from '../element-ref.ts';
import { changedRefAddressOf } from '../ref-address.ts';
import { DetailSection } from './detail-section.tsx';
import { Ref } from './ref.tsx';

interface RefsSectionProps {
  element: ElementRef;
  title: string;
  set: ChangeSetInput<BuildingBlockRefInput, BuildingBlockRefInput> | undefined;
}

const addedMapper = changedRefAddressOf('added');
const modifiedMapper = changedRefAddressOf('modified');
const removedMapper = changedRefAddressOf('removed');

/** A change set of type references. */
export function RefsSection({ title, set }: RefsSectionProps) {
  const added = (set?.added ?? []).map(addedMapper);
  const modified = (set?.modified ?? []).map(modifiedMapper);
  const removed = (set?.removed ?? []).map(removedMapper);

  const total: { change: OutlineChange; name: string }[] = [
    ...added,
    ...modified,
    ...removed,
  ].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <DetailSection title={title}>
      <Code block>
        {total.map((ref) => {
          return <Ref key={ref.name} change={ref.change} name={ref.name} />;
        })}
      </Code>
    </DetailSection>
  );
}

/** Shown only when the design touches the change set at all. */
RefsSection.shows = ({ set }: RefsSectionProps) =>
  !!(set?.added?.length || set?.modified?.length || set?.removed?.length);
