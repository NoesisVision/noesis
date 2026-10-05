import type { ReactElement } from 'react';
import type { OutlineKind } from '#/shared/ui/model-tree/model-outline.ts';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { findById } from '../../../change-set.ts';
import type { ElementRef } from '../element-ref.ts';
import { section } from './section.ts';
import { BehavioursSection } from './sections/behaviours-section.tsx';
import { ElementCardsSection } from './sections/element-cards-section.tsx';

/**
 * What changed directly under an element, read off the tree: a module's
 * submodules and building blocks as cards, a building block's behaviours —
 * each of those with what the document says it takes, gives and is. The rest of
 * what an element keeps — properties, rules, scenarios — its own sections
 * list from the document, where they say more than a name.
 */
export const childSections = (
  element: ElementRef,
  kind: OutlineKind,
  path: string,
  tree: OutlineTree,
  /** Where a card or a behaviour finds what the design says about it. */
  doc: DesignDocumentInput,
): ReactElement[] => {
  if (kind === 'module')
    return [
      ...section(ElementCardsSection, 'modules', {
        element,
        title: 'Modules',
        kind: 'module',
        nodes: tree.childrenOf(path).filter((child) => child.kind === 'module'),
        doc,
      }),
      ...section(ElementCardsSection, 'building-blocks', {
        element,
        kind: 'building_block',
        nodes: tree
          .childrenOf(path)
          .filter((child) => child.kind === 'building_block'),
        doc,
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
