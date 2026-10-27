import { describe, expect, it } from 'bun:test';
import {
  asBehavior,
  asBuildingBlock,
  behaviorIdAt,
  blockIdAt,
  blockOfRef,
  kindOf,
  moduleOf,
  ownerOf,
  parentOf,
} from '../src/features/design-docs/element-id';

const module = 'module|sales.orders';
const block = 'building_block|sales.orders.Refund';
const behavior = 'behavior|sales.orders.Refund.issue';

describe('kindOf', () => {
  it('reads the kind off the prefix', () => {
    expect(kindOf(module)).toBe('module');
    expect(kindOf(block)).toBe('building_block');
    expect(kindOf(behavior)).toBe('behavior');
  });

  it.each(['need|refunds', 'sales.orders', ''])(
    'refuses %p, which is no element id, rather than call it a module',
    (id) => {
      expect(() => kindOf(id)).toThrow('Not an element id');
    },
  );
});

describe('moduleOf', () => {
  it('finds the module a building block or a behavior is in', () => {
    expect(moduleOf(block)).toBe(moduleOf(behavior));
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
  it('hangs a behavior under its building block', () => {
    expect(ownerOf(behavior) as string).toBe(block);
    expect(parentOf(behavior) as string | null).toBe(block);
  });

  it('hangs a building block and a submodule under their module, a root module under nothing', () => {
    expect(parentOf(block) as string | null).toBe(module);
    expect(parentOf(module) as string | null).toBe('module|sales');
    expect(parentOf('module|sales')).toBeNull();
  });

  it('takes no id branded as another kind', () => {
    const moduleId = moduleOf(block);
    // @ts-expect-error A ModuleId is not a behavior's id.
    expect(() => ownerOf(moduleId)).toThrow('Not a behavior id');
  });
});

describe('blockOfRef', () => {
  it('names the building block a reference holds, through a collection', () => {
    expect(blockOfRef({ collectionOf: block }) as string | null).toBe(block);
    expect(blockOfRef('string')).toBeNull();
  });
});

describe('blockIdAt and behaviorIdAt', () => {
  it('build the id an address names, as the server writes it', () => {
    expect(blockIdAt('sales.orders.Refund') as string).toBe(block);
    expect(behaviorIdAt('sales.orders.Refund.issue') as string).toBe(behavior);
  });
});

describe('asBuildingBlock and asBehavior', () => {
  it('take a wire id of their kind as it is', () => {
    expect(asBuildingBlock(block) as string).toBe(block);
    expect(asBehavior(behavior) as string).toBe(behavior);
  });

  it('refuse a wire id of another kind', () => {
    expect(() => asBuildingBlock(behavior)).toThrow('Not a building block id');
    expect(() => asBehavior(module)).toThrow('Not a behavior id');
  });
});
