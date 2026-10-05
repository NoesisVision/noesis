import type { ReactNode } from 'react';
import { DataList } from '#/shared/design-system/data-list.tsx';
import type { DesignDocFieldInput } from '../../../../design-doc-field.ts';
import { TracedNeeds } from '../../../traced-needs.tsx';
import type { ElementRef } from '../../element-ref.ts';
import { Field } from '../../field.tsx';
import { DetailSection } from './detail-section.tsx';

interface RuleTraceSectionProps {
  element: ElementRef;
  category: DesignDocFieldInput<string>;
  ruleType: DesignDocFieldInput<string>;
  /** The needs the rule answers, by name; `null` when the design leaves them as they are. */
  needs: string[] | null;
}

/**
 * What kind of rule it is, and why it is there: the needs it answers, or
 * none, which makes it a decision of the design's own.
 */
export function RuleTraceSection({
  category,
  ruleType,
  needs,
}: RuleTraceSectionProps) {
  return (
    <DetailSection>
      {/* Names in a column as wide as the longest of them, `Category`. */}
      <DataList gap={6} labelWidth="4.5rem">
        <TraceField name="Category">
          <Field field={category} />
        </TraceField>
        <TraceField name="Type">
          <Field field={ruleType} />
        </TraceField>
        <TraceField name="Needs">
          <TracedNeeds needs={needs} />
        </TraceField>
      </DataList>
    </DetailSection>
  );
}

function TraceField({ name, children }: { name: string; children: ReactNode }) {
  return (
    <DataList.Item>
      <DataList.ItemLabel fw={600} c="var(--noesis-secondary-text)">
        {name}
      </DataList.ItemLabel>
      <DataList.ItemValue miw={0}>{children}</DataList.ItemValue>
    </DataList.Item>
  );
}
