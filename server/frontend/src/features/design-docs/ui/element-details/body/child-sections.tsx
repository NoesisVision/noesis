import type { ReactElement } from 'react';
import type { OutlineKind } from '#/shared/ui/model-tree/model-outline.ts';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { childItems } from '../change-list-items.ts';
import { findById } from '../change-set.ts';
import type { ElementRef } from '../element-ref.ts';
import { section } from './section.ts';
import { BehavioursSection } from './sections/behaviours-section.tsx';
import { ChangeListSection } from './sections/change-list-section.tsx';

/**
 * What changed directly under an element, read off the tree: a module's
 * submodules and building blocks, a building block's behaviours — each of
 * those with what the document says it takes, gives and is. The rest of
 * what an element keeps — properties, rules, scenarios — its own sections
 * list from the document, where they say more than a name.
 */
export const childSections = (
  element: ElementRef,
  kind: OutlineKind,
  path: string,
  tree: OutlineTree,
  /** Where a behaviour listed under a block says what it takes and gives. */
  doc: DesignDocumentInput,
): ReactElement[] => {
  if (kind === 'module')
    return [
      ...section(ChangeListSection, 'modules', {
        element,
        title: 'Modules',
        kind: 'module',
        items: childItems(tree, path, 'module'),
      }),
      ...section(ChangeListSection, 'building-blocks', {
        element,
        title: 'Building blocks',
        kind: 'building_block',
        items: childItems(tree, path, 'building_block'),
      }),
    ];
  if (kind === 'building_block')
    return section(BehavioursSection, 'behaviours', {
      element,
      behaviours: tree
        .childrenOf(path)
        .filter((child) => child.kind === 'behaviour')
        .map((node) => ({
          node,
          behaviour:
            node.elementId === null
              ? null
              : findById(doc.behaviours, node.elementId),
        })),
    });
  return [];
};
