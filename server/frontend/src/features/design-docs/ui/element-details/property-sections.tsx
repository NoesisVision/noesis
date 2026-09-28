import type { ReactElement } from 'react';
import type { DesignedPropertyInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef, OwnerRef } from './element-ref.ts';
import { DescriptionSection } from './sections/description-section.tsx';
import { PropertySignatureSection } from './sections/property-signature-section.tsx';

export const propertySections = (
  owner: OwnerRef,
  property: DesignedPropertyInput,
): ReactElement[] => {
  const element: ElementRef = {
    owner,
    part: 'properties',
    name: property.name,
  };
  return [
    <PropertySignatureSection
      key="signature"
      element={element}
      name={property.name}
      type={property.type}
      optional={property.optional}
    />,
    <DescriptionSection
      key="description"
      element={element}
      field={property.description}
    />,
  ];
};
