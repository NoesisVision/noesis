import { describe, expect, it } from 'bun:test';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { publicOutline } from '../src/features/design-docs/ui/model-tree/outline-scope';
import { outlineFixture } from './fixtures/outline.fixture';

const designWith = (type: string) =>
  ({
    id: 'shop',
    name: 'Shop',
    description: '',
    buildingBlocks: {
      modified: [
        {
          id: 'building_block|shop.orders.Order',
          type: { changed: true, value: type, author: 'agent' },
        },
      ],
    },
    behaviors: { added: [{ id: 'behavior|shop.orders.Order.place' }] },
  }) as unknown as DesignDocumentInput;

describe('publicOutline', () => {
  it('keeps a behavior of an application service — a driving port — its block and the modules down to it', () => {
    const paths = publicOutline(
      outlineFixture,
      designWith('application_service'),
    ).map((node) => node.path);
    expect(paths).toEqual([
      'module|shop',
      'module|shop.orders',
      'building_block|shop.orders.Order',
      'behavior|shop.orders.Order.place',
    ]);
  });

  it('leaves out a module with no driving port in it, and everything else', () => {
    const paths = publicOutline(
      outlineFixture,
      designWith('application_service'),
    ).map((node) => node.path);
    expect(paths).not.toContain('module|shop.legacy');
    expect(paths).not.toContain('building_block|shop.orders.Orders');
  });

  it('shows nothing where no block is an application service', () => {
    expect(publicOutline(outlineFixture, designWith('aggregate'))).toEqual([]);
  });
});
