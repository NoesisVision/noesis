import { changedPropertyAddressOf } from '#/features/design-docs/ui/element-details/property-address.ts';
import { Ref } from '#/features/design-docs/ui/element-details/sections/ref.tsx';
import { Code } from '#/shared/design-system/code.tsx';
import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import type { DesignedBuildingBlockInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef } from '../element-ref.ts';
import { DetailSection } from './detail-section.tsx';

interface PropertiesSectionProps {
  element: ElementRef;
  title: string;
  properties: DesignedBuildingBlockInput['properties'] | undefined;
}

const addedMapper = changedPropertyAddressOf('added');
const modifiedMapper = changedPropertyAddressOf('modified');
const removedMapper = changedPropertyAddressOf('removed');

/**
 * A property read as it would be declared: its name, a `?` when it may be
 * absent, and its type by address.
 */
export function PropertiesSection({
  title,
  properties,
}: PropertiesSectionProps) {
  const added = (properties?.added ?? []).map(addedMapper);
  const modified = (properties?.modified ?? []).map(modifiedMapper);
  const removed = (properties?.removed ?? []).map(removedMapper);

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
PropertiesSection.shows = ({ properties }: PropertiesSectionProps) =>
  !!(
    properties?.added?.length ||
    properties?.modified?.length ||
    properties?.removed?.length
  );
