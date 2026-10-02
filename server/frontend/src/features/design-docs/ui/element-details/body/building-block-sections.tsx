import type { ReactElement } from 'react';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type {
  DesignDocumentInput,
  DesignedBuildingBlockInput,
} from '#backend/app/design-docs/design-doc.ts';
import { ruleItems, propertyItems, refItems } from '../change-list-items.ts';
import type { ElementRef } from '../element-ref.ts';
import { childSections } from './child-sections.tsx';
import { section } from './section.ts';
import { ChangeListSection } from './sections/change-list-section.tsx';
import { DescriptionSection } from './sections/description-section.tsx';
import { DiagramSection } from './sections/diagram-section.tsx';

export const buildingBlockSections = (
  block: DesignedBuildingBlockInput,
  tree: OutlineTree,
  doc: DesignDocumentInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'buildingBlocks', id: block.id };
  return [
    ...section(ChangeListSection, 'implements', {
      element,
      title: 'Implements',
      kind: 'building_block',
      items: refItems(block.implements),
    }),
    // What it does reads before what it holds.
    ...childSections(element, 'building_block', block.id, tree, doc),
    ...section(ChangeListSection, 'properties', {
      element,
      title: 'Properties',
      kind: 'property',
      items: propertyItems(block.id, block.properties),
    }),
    ...section(ChangeListSection, 'rules', {
      element,
      title: 'Rules',
      kind: 'rule',
      items: ruleItems(block.id, block.rules),
    }),
    ...section(DiagramSection, 'diagram', {
      element,
      field: block.diagram,
    }),
    ...section(DescriptionSection, 'description', {
      element,
      field: block.description,
    }),
  ];
};
