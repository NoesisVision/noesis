import { valueOf } from '#/features/design-docs/design-doc-field.ts';
import { keywordOf } from '#/features/design-docs/scenario-steps.ts';
import { DataList } from '#/shared/design-system/data-list.tsx';
import type { DesignedScenarioInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef } from '../../element-ref.ts';
import { WrittenBy } from '../../human-mark.tsx';
import { DetailSection } from './detail-section.tsx';
import classes from './scenario-steps-section.module.css';

interface ScenarioStepsSectionProps {
  element: ElementRef;
  scenario: DesignedScenarioInput;
}

export function ScenarioStepsSection({ scenario }: ScenarioStepsSectionProps) {
  return (
    <DetailSection title="Scenario">
      <ScenarioSteps scenario={scenario} />
    </DetailSection>
  );
}

/**
 * The steps in the order they are read: one indented block, each step by its
 * keyword, and one going on with the kind before it by "And". Steps the
 * design leaves as the model has them read so.
 */
export function ScenarioSteps({
  scenario,
}: {
  scenario: DesignedScenarioInput;
}) {
  const steps = valueOf(scenario.steps);
  return (
    <DataList
      orientation="horizontal"
      labelWidth={48}
      className={classes.steps}
    >
      {steps === null ? (
        <DataList.Item className={classes.step}>
          <DataList.ItemLabel className={classes.keyword}>
            Steps
          </DataList.ItemLabel>
          <DataList.ItemValue className={classes.value}>
            unchanged
          </DataList.ItemValue>
        </DataList.Item>
      ) : (
        steps.map((step, index) => (
          <DataList.Item
            // Steps have no identity but their place.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            className={classes.step}
            data-kind={step.kind}
          >
            <DataList.ItemLabel className={classes.keyword}>
              {keywordOf(steps, index)}
            </DataList.ItemLabel>
            <DataList.ItemValue className={classes.value}>
              <WrittenBy fields={[scenario.steps]}>{step.text}</WrittenBy>
            </DataList.ItemValue>
          </DataList.Item>
        ))
      )}
    </DataList>
  );
}
