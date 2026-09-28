import type { ReactElement } from 'react';
import type { DesignedBuildingBlockInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef } from './element-ref.ts';
import { section } from './section.ts';
import { DescriptionSection } from './sections/description-section.tsx';
import { RefsSection } from './sections/refs-section.tsx';

export const buildingBlockSections = (
  block: DesignedBuildingBlockInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'buildingBlocks', id: block.id };
  console.info(block);
  return [
    ...section(DescriptionSection, 'description', {
      element,
      field: block.description,
    }),
    ...section(RefsSection, 'implements', {
      element,
      title: 'Implements',
      set: block.implements,
    }),
  ];
};
