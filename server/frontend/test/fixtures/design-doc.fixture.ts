import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';

/** A small document in the form the API serves: enough to tell apart from another. */
export const designDocFixture = {
  id: 'doc-refunds',
  name: { value: 'Partial refunds', status: 'acceptedByHuman' },
  description: { value: 'Refund single order lines.', status: 'setByAgent' },
  modules: { added: [], removed: [], modified: [] },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        type: { value: 'aggregate', status: 'setByAgent' },
        description: { value: null, status: 'setByAgent' },
      },
    ],
    removed: [],
    modified: [],
  },
  behaviours: { added: [], removed: [], modified: [] },
  implemented: false,
} satisfies DesignDocumentInput;
