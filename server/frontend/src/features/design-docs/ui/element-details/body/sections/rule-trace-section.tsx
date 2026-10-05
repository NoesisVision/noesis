import type { DesignDocFieldInput } from '../../../../design-doc-field.ts';
import { FieldList } from '../../../field-list.tsx';
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
      <FieldList>
        <dt>Category</dt>
        <dd>
          <Field field={category} />
        </dd>
        <dt>Type</dt>
        <dd>
          <Field field={ruleType} />
        </dd>
        <dt>Needs</dt>
        <dd>
          <TracedNeeds needs={needs} />
        </dd>
      </FieldList>
    </DetailSection>
  );
}
