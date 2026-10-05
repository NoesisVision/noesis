import type { ReactElement } from 'react';
import type {
  DesignDocumentInput,
  DesignedBehaviourInput,
} from '#backend/app/design-docs/design-doc.ts';
import {
  parameterItems,
  ruleItems,
  resultItems,
} from '../change-list-items.ts';
import type { ElementRef } from '../element-ref.ts';
import { section } from './section.ts';
import { ChangeListSection } from './sections/change-list-section.tsx';
import { DescriptionSection } from './sections/description-section.tsx';
import { DiagramSection } from './sections/diagram-section.tsx';
import { InputOutputSection } from './sections/input-output-section.tsx';

export const behaviourSections = (
  behaviour: DesignedBehaviourInput,
  doc: DesignDocumentInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'behaviours', id: behaviour.id };
  return [
    ...section(InputOutputSection, 'input-output', {
      element,
      input: parameterItems(behaviour.input),
      output: resultItems(behaviour.output),
    }),
    ...section(ChangeListSection, 'rules', {
      element,
      title: 'Rules',
      kind: 'rule',
      items: ruleItems(behaviour.id, behaviour.rules, doc.needs),
    }),
    ...section(DiagramSection, 'diagram', {
      element,
      field: behaviour.diagram,
    }),
    ...section(DescriptionSection, 'definition', {
      element,
      title: 'Definition',
      field: behaviour.definition,
    }),
  ];
};
