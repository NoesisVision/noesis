import type { ReactElement } from 'react';
import type { DesignedRuleInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef, OwnerRef } from './element-ref.ts';
import { DescriptionSection } from './sections/description-section.tsx';

export const ruleSections = (
  owner: OwnerRef,
  rule: DesignedRuleInput,
): ReactElement[] => {
  const element: ElementRef = { owner, part: 'rules', name: rule.name };
  return [
    <DescriptionSection
      key="description"
      element={element}
      field={rule.description}
    />,
  ];
};
