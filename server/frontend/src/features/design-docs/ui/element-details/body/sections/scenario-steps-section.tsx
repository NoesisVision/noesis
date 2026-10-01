import { IconArrowDown } from '@tabler/icons-react';
import type { DesignDocFieldInput } from '#/features/design-docs/design-doc-field.ts';
import { Card } from '#/shared/design-system/card.tsx';
import { Center } from '#/shared/design-system/center.tsx';
import { DataList } from '#/shared/design-system/data-list.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import type { DesignedScenarioInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef } from '../../element-ref.ts';
import { Field } from '../../field.tsx';
import { DetailSection } from './detail-section.tsx';

interface ScenarioStepsSectionProps {
  element: ElementRef;
  /*
   * The scenario whole, not its three steps as props: a `then` key would make
   * the props object look like a promise to anything that awaited it.
   */
  scenario: DesignedScenarioInput;
}

export function ScenarioStepsSection({ scenario }: ScenarioStepsSectionProps) {
  return (
    <DetailSection title="Scenario">
      <ScenarioSteps scenario={scenario} />
    </DetailSection>
  );
}

/** Given, when, then, one under the other. */
export function ScenarioSteps({
  scenario,
}: {
  scenario: DesignedScenarioInput;
}) {
  return (
    <>
      <Case label="Given" field={scenario.given} />
      <Separator />
      <Case label="When" field={scenario.when} />
      <Separator />
      <Case label="Then" field={scenario.then} />
    </>
  );
}

function Case({
  label,
  field,
}: {
  label: string;
  field: DesignDocFieldInput<string>;
}) {
  return (
    <Card>
      <DataList orientation="horizontal" labelWidth={80}>
        <DataList.Item>
          <DataList.ItemLabel>{label}</DataList.ItemLabel>
          <DataList.ItemValue>
            <Field field={field} />
          </DataList.ItemValue>
        </DataList.Item>
      </DataList>
    </Card>
  );
}
function Separator() {
  return (
    <Center my={8}>
      <ThemeIcon variant="light">
        <IconArrowDown aria-hidden />
      </ThemeIcon>
    </Center>
  );
}
