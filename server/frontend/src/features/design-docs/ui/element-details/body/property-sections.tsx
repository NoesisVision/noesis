import type { ReactElement } from 'react';
import type {
  DesignedCollaboratorInput,
  DesignedStateInput,
} from '../../../relations.ts';
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

/** A collaborator reads as a property does, the block it works with as its type; it holds exactly one. */
export const collaboratorSections = (
  owner: OwnerRef,
  collaborator: DesignedCollaboratorInput,
): ReactElement[] =>
  section(PropertySignatureSection, 'signature', {
    element: { owner, part: 'collaborators', name: collaborator.name },
    name: collaborator.name,
    type: collaborator.to,
    cardinality: collaborator.cardinality,
  });
