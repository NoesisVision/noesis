import type { ReactElement } from 'react';
import type { DesignedBuildingBlockInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef } from './element-ref.ts';
import { DescriptionSection } from './sections/description-section.tsx';
import { RefsSection } from './sections/refs-section.tsx';
import { hasRefs } from './sections/section-guards.ts';

export const buildingBlockSections = (
  block: DesignedBuildingBlockInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'buildingBlocks', id: block.id };
  return [
    <DescriptionSection
      key="description"
      element={element}
      field={block.description}
    />,
    ...(hasRefs(block.implements)
      ? [
          <RefsSection
            key="implements"
            element={element}
            title="Implements"
            set={block.implements}
          />,
        ]
      : []),
  ];
};
