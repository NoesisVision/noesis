import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import type { DesignDocSummary } from '#backend/app/design-docs/design-docs.service.ts';
import type { OutlineNode } from '#backend/app/model-outline/model-outline.ts';

/** A small document in the form the API serves: enough to tell apart from another. */
export const designDocFixture = {
  id: 'doc-refunds',
  name: { value: 'Partial refunds', reviewedByHuman: true },
  description: { value: 'Refund single order lines.', reviewedByHuman: false },
  modules: { added: [], removed: [], modified: [] },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        type: { value: 'aggregate', reviewedByHuman: false },
        description: { value: null, reviewedByHuman: false },
      },
    ],
    removed: [],
    modified: [],
  },
  behaviours: { added: [], removed: [], modified: [] },
  implemented: false,
} satisfies DesignDocumentInput;

/**
 * The same document as a tree, as the server rebuilds it: the two modules the
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
export const designDocDetailFixture = {
  summary: {
    // The wire carries the id as the string it is written as; the client's
    // type brands it back, and a fixture cannot mint a brand of its own.
    id: designDocFixture.id as DesignDocSummary['id'],
    name: designDocFixture.name.value,
    implemented: false,
  },
  document: designDocFixture,
  outline: designDocOutlineFixture,
};
