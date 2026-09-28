import type { ReactElement } from 'react';
import type { DesignedBehaviourInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef } from './element-ref.ts';
import { DescriptionSection } from './sections/description-section.tsx';
import { RefsSection } from './sections/refs-section.tsx';
import { hasRefs, isPublic } from './sections/section-guards.ts';
import { VisibilitySection } from './sections/visibility-section.tsx';

export const behaviourSections = (
  behaviour: DesignedBehaviourInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'behaviours', id: behaviour.id };
  return [
    ...(isPublic(behaviour.visibility)
      ? [
          <VisibilitySection
            key="visibility"
            element={element}
            field={behaviour.visibility}
          />,
        ]
      : []),
    <DescriptionSection
      key="description"
      element={element}
      field={behaviour.description}
    />,
    ...(hasRefs(behaviour.input)
      ? [
          <RefsSection
            key="input"
            element={element}
            title="Input"
            set={behaviour.input}
          />,
        ]
      : []),
    ...(hasRefs(behaviour.output)
      ? [
          <RefsSection
            key="output"
            element={element}
            title="Output"
            set={behaviour.output}
          />,
        ]
      : []),
  ];
};
