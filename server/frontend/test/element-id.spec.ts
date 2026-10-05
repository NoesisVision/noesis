import { describe, expect, it } from 'bun:test';
import {
  asBehaviour,
  asBuildingBlock,
  behaviourIdAt,
  blockIdAt,
  blockOfRef,
  kindOf,
  moduleOf,
  ownerOf,
  parentOf,
} from '../src/features/design-docs/element-id';

const module = 'module|sales.orders';
const block = 'building_block|sales.orders.Refund';
const behaviour = 'behavior|sales.orders.Refund.issue';

describe('kindOf', () => {
  it('reads the kind off the prefix', () => {
    expect(kindOf(module)).toBe('module');
    expect(kindOf(block)).toBe('building_block');
    expect(kindOf(behaviour)).toBe('behaviour');
  });

  it.each(['need|refunds', 'sales.orders', ''])(
    'refuses %p, which is no element id, rather than call it a module',
    (id) => {
      expect(() => kindOf(id)).toThrow('Not an element id');
    },
  );
});

describe('moduleOf', () => {
  it('finds the module a building block or a behaviour is in', () => {
    expect(moduleOf(block)).toBe(moduleOf(behaviour));
    expect(moduleOf(block) as string).toBe(module);
  });

  it('is a module itself for a module', () => {
    expect(moduleOf(module) as string).toBe(module);
    expect(moduleOf('module|sales') as string).toBe('module|sales');
  });

  it('refuses an id of no element kind', () => {
    expect(() => moduleOf('need|refunds')).toThrow('Not an element id');
  });
});

describe('ownerOf and parentOf', () => {
  it('hangs a behaviour under its building block', () => {
    expect(ownerOf(behaviour) as string).toBe(block);
    expect(parentOf(behaviour) as string | null).toBe(block);
  });

  it('hangs a building block and a submodule under their module, a root module under nothing', () => {
    expect(parentOf(block) as string | null).toBe(module);
    expect(parentOf(module) as string | null).toBe('module|sales');
    expect(parentOf('module|sales')).toBeNull();
  });

  it('takes no id branded as another kind', () => {
    const moduleId = moduleOf(block);
    // @ts-expect-error A ModuleId is not a behaviour's id.
    expect(() => ownerOf(moduleId)).toThrow('Not a behaviour id');
  });
});

describe('blockOfRef', () => {
  it('names the building block a reference holds, through a collection', () => {
    expect(blockOfRef({ collectionOf: block }) as string | null).toBe(block);
    expect(blockOfRef('string')).toBeNull();
  });
});

describe('blockIdAt and behaviourIdAt', () => {
  it('build the id an address names, as the server writes it', () => {
    expect(blockIdAt('sales.orders.Refund') as string).toBe(block);
    expect(behaviourIdAt('sales.orders.Refund.issue') as string).toBe(
      behaviour,
    );
  });
});

describe('asBuildingBlock and asBehaviour', () => {
  it('take a wire id of their kind as it is', () => {
    expect(asBuildingBlock(block) as string).toBe(block);
    expect(asBehaviour(behaviour) as string).toBe(behaviour);
  });

  it('refuse a wire id of another kind', () => {
    expect(() => asBuildingBlock(behaviour)).toThrow('Not a building block id');
    expect(() => asBehaviour(module)).toThrow('Not a behaviour id');
  });
});
