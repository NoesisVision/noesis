import type { PartOwner } from '../../design-doc-edit.ts';

/**
 * Where an element sits in the design document, in the document's own terms:
 * a top-level element by its collection and id, a part by its owner, the list
 * it is in and its name — and a scenario of a rule by that rule as well. A section is told the element it shows, so that a
 * write from it can name exactly what it changes.
 */
export type OwnerRef = {
  collection: 'modules' | 'buildingBlocks' | 'behaviours';
  id: string;
};

export type ElementRef =
  | { collection: 'modules' | 'buildingBlocks' | 'behaviours'; id: string }
  | {
      owner: OwnerRef;
      part: 'properties' | 'rules' | 'scenarios';
      name: string;
      /** The rule a scenario belongs to, when it is one of a rule's own. */
      rule?: string;
    };

const KIND_OF = {
  modules: 'module',
  buildingBlocks: 'building_block',
  behaviours: 'behaviour',
} as const;

/** The element a section's parts are written in; none for a part's own section. */
export const partOwnerOf = (element: ElementRef): PartOwner | null =>
  'collection' in element
    ? { kind: KIND_OF[element.collection], id: element.id }
    : null;
