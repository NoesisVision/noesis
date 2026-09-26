import {
  DesignDoc,
  type DesignDocInput,
} from '#backend/app/changes/model/design-doc.ts';
import type { OutlineNode } from '../../src/shared/ui/model-tree/model-outline.ts';

/** A small document in the form the API serves: enough to tell apart from another. */
export const designDocFixture = {
  id: '0199a1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1b',
  name: 'Partial refunds',
  description: 'Refund single order lines.',
  modules: { added: [], removed: [], modified: [] },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        name: { changed: true, value: 'Refund', author: 'agent' },
        type: { changed: true, value: 'aggregate', author: 'agent' },
        description: { changed: false },
      },
    ],
    removed: [],
    modified: [],
  },
  behaviours: { added: [], removed: [], modified: [] },
  implemented: false,
} satisfies DesignDocInput;

/**
 * The same document as a tree, as the client rebuilds it: the two modules the
 * block's id implies are in the outline though the document names neither.
 */
const designDocOutlineFixture: OutlineNode[] = [
  {
    path: 'module|sales',
    parentPath: null,
    elementId: 'module|sales',
    kind: 'module',
    name: 'sales',
    depth: 0,
    change: 'unchanged',
    pattern: null,
    patternLabel: null,
    hasDiagram: false,
  },
  {
    path: 'module|sales.refunds',
    parentPath: 'module|sales',
    elementId: 'module|sales.refunds',
    kind: 'module',
    name: 'refunds',
    depth: 1,
    change: 'unchanged',
    pattern: null,
    patternLabel: null,
    hasDiagram: false,
  },
  {
    path: 'building_block|sales.refunds.Refund',
    parentPath: 'module|sales.refunds',
    elementId: 'building_block|sales.refunds.Refund',
    kind: 'building_block',
    name: 'Refund',
    depth: 2,
    change: 'added',
    pattern: 'aggregate',
    patternLabel: 'aggregate',
    hasDiagram: false,
  },
];

/** The whole of what `GET /ui/changes/:change/design-docs/:id` answers. */
export const designDocPayloadFixture = {
  document: DesignDoc.parse(designDocFixture),
};

/** What the page is handed: the answer, with the tree rebuilt from it. */
export const designDocDetailFixture = {
  ...designDocPayloadFixture,
  outline: designDocOutlineFixture,
};
