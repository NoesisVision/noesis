import type { ReactElement } from 'react';
import type { DesignedScenarioInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef, OwnerRef } from './element-ref.ts';
import { section } from './section.ts';
import { DescriptionSection } from './sections/description-section.tsx';
import { ScenarioStepsSection } from './sections/scenario-steps-section.tsx';

export const scenarioSections = (
  owner: OwnerRef,
  scenario: DesignedScenarioInput,
): ReactElement[] => {
  const element: ElementRef = { owner, part: 'scenarios', name: scenario.name };
  return [
    ...section(DescriptionSection, 'description', {
      element,
      field: scenario.description,
    }),
    ...section(ScenarioStepsSection, 'steps', {
      element,
      scenario,
    }),
  ];
};
