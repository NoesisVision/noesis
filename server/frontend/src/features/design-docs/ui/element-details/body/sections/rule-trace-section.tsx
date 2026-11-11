import type { ReactNode } from 'react';
import { DataList } from '#/shared/design-system/data-list.tsx';
import { List } from '#/shared/design-system/list.tsx';
import type { DesignDocFieldInput } from '../../../../design-doc-field.ts';
import { nameOf, ownerOf } from '../../../../element-id.ts';
import { ruleKindLabelOf } from '../../../../rules.ts';
import { TracedNeeds } from '../../../traced-needs.tsx';
import type { ElementRef } from '../../element-ref.ts';
import { Field } from '../../field.tsx';
import { DetailSection } from './detail-section.tsx';

interface RuleTraceSectionProps {
  element: ElementRef;
  kind: DesignDocFieldInput<string>;
  /** The behaviors the design says follow the rule, by id. */
  governors: string[];
  /** The needs the rule answers, by name; `null` when the design leaves them as they are. */
  needs: string[] | null;
}

/**
 * What kind of rule it is, which behaviors follow it, and why it is there:
 * the needs it answers, or none, which makes it a decision of the design's
 * own.
 */
export function RuleTraceSection({
  kind,
  governors,
  needs,
}: RuleTraceSectionProps) {
  return (
    <DetailSection>
      {/* Names in a column as wide as the longest of them, `Governed by`. */}
      <DataList gap={6} labelWidth="6.5rem">
        <TraceField name="Kind">
          <Field
            field={kind}
            format={(value) => ruleKindLabelOf(value) ?? value}
          />
        </TraceField>
        <TraceField name="Governed by">
          {governors.length === 0 ? (
            'unchanged'
          ) : (
            <List fz="inherit" ps="md">
              {governors.map((id) => (
                <List.Item key={id}>{behaviorLabelOf(id)}</List.Item>
              ))}
            </List>
          )}
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

/** A behavior as a reader names it: `Order.place`. */
const behaviorLabelOf = (id: string): string =>
  `${nameOf(ownerOf(id))}.${nameOf(id)}`;
