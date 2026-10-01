import type { ReactElement } from 'react';
import type { DesignedBehaviourInput } from '#backend/app/design-docs/design-doc.ts';
import { parameterItems, partItems, resultItems } from './change-list-items.ts';
import type { ElementRef } from './element-ref.ts';
import { section } from './section.ts';
import { ChangeListSection } from './sections/change-list-section.tsx';
import { DescriptionSection } from './sections/description-section.tsx';

export const behaviourSections = (
  behaviour: DesignedBehaviourInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'behaviours', id: behaviour.id };
  return [
    ...section(DescriptionSection, 'description', {
      element,
      field: behaviour.description,
    }),
    ...section(ChangeListSection, 'input', {
      element,
      title: 'Input',
      kind: 'building_block',
      items: parameterItems(behaviour.input),
    }),
    ...section(ChangeListSection, 'output', {
      element,
      title: 'Output',
      kind: 'building_block',
      items: resultItems(behaviour.output),
    }),
    ...section(ChangeListSection, 'rules', {
      element,
      title: 'Rules',
      kind: 'rule',
      items: partItems(behaviour.id, 'rule', behaviour.rules),
    }),
    ...section(ChangeListSection, 'scenarios', {
      element,
      title: 'Scenarios',
      kind: 'scenario',
      items: partItems(behaviour.id, 'scenario', behaviour.scenarios),
    }),
  ];
};
