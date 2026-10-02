import type { DesignDocFieldInput } from '#/features/design-docs/design-doc-field.ts';
import { DataList } from '#/shared/design-system/data-list.tsx';
import type { DesignedScenarioInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef } from '../../element-ref.ts';
import { Field } from '../../field.tsx';
import { DetailSection } from './detail-section.tsx';
import classes from './scenario-steps-section.module.css';

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

/** Given, when, then: one indented block, each step by its keyword. */
export function ScenarioSteps({
  scenario,
}: {
  scenario: DesignedScenarioInput;
}) {
  return (
    <DataList
      orientation="horizontal"
      labelWidth={48}
      className={classes.steps}
    >
      <Step label="Given" field={scenario.given} />
      <Step label="When" field={scenario.when} />
      <Step label="Then" field={scenario.then} />
    </DataList>
  );
}

function Step({
  label,
  field,
}: {
  label: string;
  field: DesignDocFieldInput<string>;
}) {
  return (
    <DataList.Item className={classes.step}>
      <DataList.ItemLabel className={classes.keyword}>
        {label}
      </DataList.ItemLabel>
      <DataList.ItemValue className={classes.value}>
        <Field field={field} />
      </DataList.ItemValue>
    </DataList.Item>
  );
}
