import { DataList } from '#/shared/design-system/data-list.tsx';
import type { DesignedScenarioInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef } from '../element-ref.ts';
import { Field } from '../field.tsx';
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
  console.info(scenario);
  return (
    <DetailSection title="Scenario">
      <DataList orientation="vertical">
        <DataList.Item>
          <DataList.ItemLabel>Given</DataList.ItemLabel>
          <DataList.ItemValue>
            <Field field={scenario.given} />
          </DataList.ItemValue>
        </DataList.Item>
        <DataList.Item>
          <DataList.ItemLabel>When</DataList.ItemLabel>
          <DataList.ItemValue>
            <Field field={scenario.when} />
          </DataList.ItemValue>
        </DataList.Item>
        <DataList.Item>
          <DataList.ItemLabel>Then</DataList.ItemLabel>
          <DataList.ItemValue>
            <Field field={scenario.then} />
          </DataList.ItemValue>
        </DataList.Item>
      </DataList>
    </DetailSection>
  );
}
