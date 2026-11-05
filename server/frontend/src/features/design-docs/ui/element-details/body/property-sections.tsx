import type { ReactElement } from 'react';
import type { DesignedStateInput } from '../../../relations.ts';
import type { ElementRef, OwnerRef } from '../element-ref.ts';
import { section } from './section.ts';
import { PropertySignatureSection } from './sections/property-signature-section.tsx';

export const propertySections = (
  owner: OwnerRef,
  property: DesignedStateInput,
): ReactElement[] => {
  const element: ElementRef = {
    owner,
    part: 'properties',
    name: property.name,
  };
  return section(PropertySignatureSection, 'signature', {
    element,
    name: property.name,
    type: property.to,
    cardinality: property.cardinality,
  });
};
