import { describe, expect, it } from 'bun:test';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { publicOutline } from '../src/features/design-docs/ui/model-tree/outline-scope';
import { outlineFixture } from './fixtures/outline.fixture';

const designWith = (
  visibility: { kind: 'public'; actors: string[] } | { kind: 'private' },
) =>
  ({
    id: 'shop',
    name: 'Shop',
    description: '',
    behaviours: {
      added: [
        {
          id: 'behavior|shop.orders.Order.place',
          visibility: { changed: true, value: visibility, author: 'agent' },
        },
      ],
    },
  }) as unknown as DesignDocumentInput;

describe('publicOutline', () => {
  it('keeps a public behaviour, its block and the modules down to it', () => {
    const paths = publicOutline(
      outlineFixture,
      designWith({ kind: 'public', actors: [] }),
    ).map((node) => node.path);
    expect(paths).toEqual([
      'module|shop',
      'module|shop.orders',
      'building_block|shop.orders.Order',
      'behavior|shop.orders.Order.place',
    ]);
  });

  it('leaves out a module with nothing public in it, and everything else', () => {
    const paths = publicOutline(
      outlineFixture,
      designWith({ kind: 'public', actors: [] }),
    ).map((node) => node.path);
    expect(paths).not.toContain('module|shop.legacy');
    expect(paths).not.toContain('building_block|shop.orders.Orders');
  });

  it('shows nothing where nothing is public', () => {
    expect(
      publicOutline(outlineFixture, designWith({ kind: 'private' })),
    ).toEqual([]);
  });
});
