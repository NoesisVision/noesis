import type { ReactElement } from 'react';
import type {
  DesignDocumentInput,
  DesignedBehaviorInput,
} from '#backend/app/design-docs/design-doc.ts';
import {
  parameterItems,
  ruleItems,
  resultItems,
} from '../change-list-items.ts';
import type { ElementRef } from '../element-ref.ts';
import { section } from './section.ts';
import { ChangeListSection } from './sections/change-list-section.tsx';
import { DiagramSection } from './sections/diagram-section.tsx';
import { InputOutputSection } from './sections/input-output-section.tsx';

export const behaviorSections = (
  behavior: DesignedBehaviorInput,
  doc: DesignDocumentInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'behaviors', id: behavior.id };
  return [
    ...section(InputOutputSection, 'input-output', {
      element,
      input: parameterItems(behavior.input),
      output: resultItems(behavior.output),
    }),
    ...section(ChangeListSection, 'rules', {
      element,
      title: 'Rules',
      kind: 'rule',
      items: ruleItems(behavior.id, behavior.rules, doc.needs),
    }),
    ...section(DiagramSection, 'diagram', {
      element,
      field: behavior.diagram,
    }),
  ];
};
