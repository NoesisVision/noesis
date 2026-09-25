import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';

/** A small document in the form the API serves: enough to tell apart from another. */
export const designDocFixture = {
  id: '2026-01-01-partial-refunds',
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
} satisfies DesignDocumentInput;
