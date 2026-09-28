import { Text } from '#/shared/design-system/text.tsx';
import type { DesignDocFieldInput } from '../../../design-doc-field.ts';
import type { ElementRef } from '../element-ref.ts';
import { Field } from '../field.tsx';
import { DetailSection } from './detail-section.tsx';

interface ScenarioStepsSectionProps {
  element: ElementRef;
  given: DesignDocFieldInput<string>;
  when: DesignDocFieldInput<string>;
  then: DesignDocFieldInput<string>;
}

export function ScenarioStepsSection({
  given,
  when,
  then,
}: ScenarioStepsSectionProps) {
  return (
    <DetailSection>
      <Text>
        <strong>Given</strong> <Field field={given} />
      </Text>
      <Text>
        <strong>When</strong> <Field field={when} />
      </Text>
      <Text>
        <strong>Then</strong> <Field field={then} />
      </Text>
    </DetailSection>
  );
}
