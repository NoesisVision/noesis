import type { ReactElement } from 'react';
import type { DesignedDomainModuleInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef } from './element-ref.ts';
import { DescriptionSection } from './sections/description-section.tsx';

export const moduleSections = (
  module: DesignedDomainModuleInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'modules', id: module.id };
  return [
    <DescriptionSection
      key="description"
      element={element}
      field={module.description}
    />,
  ];
};
