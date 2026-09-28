import type { ReactElement } from 'react';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type { DesignedBuildingBlockInput } from '#backend/app/design-docs/design-doc.ts';
import { partItems, propertyItems, refItems } from './change-list-items.ts';
import { childSections } from './child-sections.tsx';
import type { ElementRef } from './element-ref.ts';
import { section } from './section.ts';
import { ChangeListSection } from './sections/change-list-section.tsx';
import { DescriptionSection } from './sections/description-section.tsx';

export const buildingBlockSections = (
  block: DesignedBuildingBlockInput,
  tree: OutlineTree,
): ReactElement[] => {
  const element: ElementRef = { collection: 'buildingBlocks', id: block.id };
  return [
    ...section(DescriptionSection, 'description', {
      element,
      field: block.description,
    }),
    ...section(ChangeListSection, 'implements', {
      element,
      title: 'Implements',
      kind: 'building_block',
      items: refItems(block.implements),
      monospace: true,
    }),
    ...section(ChangeListSection, 'properties', {
      element,
      title: 'Properties',
      kind: 'property',
      items: propertyItems(block.id, block.properties),
      monospace: true,
    }),
    ...childSections(element, 'building_block', block.id, tree),
    ...section(ChangeListSection, 'rules', {
      element,
      title: 'Rules',
      kind: 'rule',
      items: partItems(block.id, 'rule', block.rules),
    }),
    ...section(ChangeListSection, 'scenarios', {
      element,
      title: 'Scenarios',
      kind: 'scenario',
      items: partItems(block.id, 'scenario', block.scenarios),
    }),
  ];
};
