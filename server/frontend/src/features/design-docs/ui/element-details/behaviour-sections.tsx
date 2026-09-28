import type { ReactElement } from 'react';
import type { DesignedBehaviourInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef } from './element-ref.ts';
import { section } from './section.ts';
import { DescriptionSection } from './sections/description-section.tsx';
import { RefsSection } from './sections/refs-section.tsx';
import { VisibilitySection } from './sections/visibility-section.tsx';

export const behaviourSections = (
  behaviour: DesignedBehaviourInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'behaviours', id: behaviour.id };
  return [
    ...section(VisibilitySection, 'visibility', {
      element,
      field: behaviour.visibility,
    }),
    ...section(DescriptionSection, 'description', {
      element,
      field: behaviour.description,
    }),
    ...section(RefsSection, 'input', {
      element,
      title: 'Input',
      set: behaviour.input,
    }),
    ...section(RefsSection, 'output', {
      element,
      title: 'Output',
      set: behaviour.output,
    }),
  ];
};
