import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  BehaviorId,
  BuildingBlockId,
  createElementId,
  createTestableElementId,
  ElementIdSchema,
  ElementNameSchema,
  ModuleId,
  TestableElementIdSchema,
  tryCreateElementId,
  tryCreateTestableElementId,
} from '#backend/app/element-id';
import { ValueObjectError } from '#backend/app/vo';

const BAD_NAMES = ['', ' ', ' a', 'a ', 'a.b', '.', 'a\tb ', 'a|b', '|'];

describe('ElementNameSchema', () => {
  it('accepts a name with no separator and no padding', () => {
    for (const name of ['a', 'Refund', 'two words', 'x-y_z']) {
      expect(ElementNameSchema.safeParse(name).success).toBe(true);
    }
  });

  it.each(BAD_NAMES)('rejects %j', (name) => {
    expect(ElementNameSchema.safeParse(name).success).toBe(false);
  });
});

describe('ModuleId', () => {
  describe('tryCreate', () => {
    it('accepts an address of any depth with the module kind', () => {
      for (const value of [
        'module|sales',
        'module|sales.orders',
        'module|a.b.c.d',
      ]) {
        expect(ModuleId.tryCreate(value).isOk()).toBe(true);
      }
    });

    it.each([
      '',
      'sales',
      'module|',
      '|sales',
      'building_block|sales',
      'module|sales|module',
      'module|a.',
      'module|.a',
      'module|a..b',
      'module|a. b',
      'module| a.b',
    ])('rejects %j with a message naming the value', (value) => {
      const result = ModuleId.tryCreate(value);
      expect(result.isErr()).toBe(true);
      expect(result.isErr() && result.error[0]?.message).toContain(
        JSON.stringify(value),
      );
    });

    it('create throws a ValueObjectError', () => {
      expect(() => ModuleId.create('module|a..b')).toThrow(ValueObjectError);
    });
  });

  describe('behavior', () => {
    it('composes from a root and nested names', () => {
      const root = ModuleId.root('sales');
      const child = root.child('orders');
      expect(root.value).toBe('module|sales');
      expect(child.value).toBe('module|sales.orders');
      expect(child.address).toBe('sales.orders');
      expect(child.name).toBe('orders');
      expect(child.parent?.equals(root)).toBe(true);
      expect(root.parent).toBeNull();
    });

    it.each(BAD_NAMES)('refuses %j as a name', (name) => {
      expect(ModuleId.tryRoot(name).isErr()).toBe(true);
      expect(ModuleId.root('sales').tryChild(name).isErr()).toBe(true);
      expect(ModuleId.root('sales').tryBuildingBlock(name).isErr()).toBe(true);
    });

    it('addresses a building block within itself', () => {
      const block = ModuleId.create('module|sales.orders').buildingBlock(
        'Refund',
      );
      expect(block).toBeInstanceOf(BuildingBlockId);
      expect(block.value).toBe('building_block|sales.orders.Refund');
    });

    it('equals by value, which carries the kind', () => {
      const id = ModuleId.create('module|sales.orders');
      expect(id.equals(ModuleId.create('module|sales.orders'))).toBe(true);
      expect(id.equals(ModuleId.create('module|sales'))).toBe(false);
      expect(
        id.equals(BuildingBlockId.create('building_block|sales.orders')),
      ).toBe(false);
    });

    it('is its value as a string and in JSON', () => {
      const id = ModuleId.create('module|sales.orders');
      expect(`${id}`).toBe('module|sales.orders');
      expect(JSON.stringify({ id })).toBe('{"id":"module|sales.orders"}');
    });
  });

  describe('schema', () => {
    it('round-trips wire -> VO -> wire', () => {
      const id = z.decode(ModuleId.schema, 'module|sales.orders');
      expect(id).toBeInstanceOf(ModuleId);
      expect(z.encode(ModuleId.schema, id)).toBe('module|sales.orders');
    });

    it('rejects a bad value and another kind', () => {
      expect(ModuleId.schema.safeParse('module|a..b').success).toBe(false);
      expect(ModuleId.schema.safeParse('behavior|a.b.c').success).toBe(false);
    });

    it('advertises the pattern', () => {
      expect(z.toJSONSchema(ModuleId.schema, { io: 'input' })).toMatchObject({
        type: 'string',
        pattern: expect.stringContaining('module'),
      });
    });
  });
});

describe('BuildingBlockId', () => {
  it('needs a module before its name', () => {
    expect(
      BuildingBlockId.tryCreate('building_block|sales.orders.Refund').isOk(),
    ).toBe(true);
    expect(BuildingBlockId.tryCreate('building_block|Refund').isErr()).toBe(
      true,
    );
    expect(BuildingBlockId.tryCreate('module|sales.Refund').isErr()).toBe(true);
  });

  it('knows its name and module', () => {
    const block = BuildingBlockId.create('building_block|sales.orders.Refund');
    expect(block.name).toBe('Refund');
    expect(block.address).toBe('sales.orders.Refund');
    expect(block.module.equals(ModuleId.create('module|sales.orders'))).toBe(
      true,
    );
  });

  it('addresses a behavior within itself', () => {
    const block = BuildingBlockId.create('building_block|sales.orders.Refund');
    expect(block.behavior('issue').value).toBe(
      'behavior|sales.orders.Refund.issue',
    );
    for (const name of BAD_NAMES) {
      expect(block.tryBehavior(name).isErr()).toBe(true);
    }
  });

  it('round-trips through its schema', () => {
    const wire = 'building_block|sales.Refund';
    expect(
      z.encode(BuildingBlockId.schema, z.decode(BuildingBlockId.schema, wire)),
    ).toBe(wire);
    expect(
      BuildingBlockId.schema.safeParse('building_block|Refund').success,
    ).toBe(false);
  });
});

describe('BehaviorId', () => {
  it('needs a building block before its name', () => {
    expect(BehaviorId.tryCreate('behavior|sales.Refund.issue').isOk()).toBe(
      true,
    );
    expect(BehaviorId.tryCreate('behavior|sales.Refund').isErr()).toBe(true);
    expect(
      BehaviorId.tryCreate('building_block|sales.Refund.issue').isErr(),
    ).toBe(true);
  });

  it('knows its name and building block', () => {
    const behavior = BehaviorId.create('behavior|sales.orders.Refund.issue');
    expect(behavior.name).toBe('issue');
    expect(
      behavior.buildingBlock.equals(
        BuildingBlockId.create('building_block|sales.orders.Refund'),
      ),
    ).toBe(true);
    expect(behavior.buildingBlock.module.value).toBe('module|sales.orders');
  });

  it('round-trips through its schema', () => {
    const wire = 'behavior|sales.Refund.issue';
    expect(z.encode(BehaviorId.schema, z.decode(BehaviorId.schema, wire))).toBe(
      wire,
    );
    expect(BehaviorId.schema.safeParse('behavior|sales.Refund').success).toBe(
      false,
    );
  });
});

describe('ElementId', () => {
  it('creates each kind as its own class', () => {
    expect(createElementId('module|a')).toBeInstanceOf(ModuleId);
    expect(createElementId('building_block|a.b')).toBeInstanceOf(
      BuildingBlockId,
    );
    expect(createElementId('behavior|a.b.c')).toBeInstanceOf(BehaviorId);
  });

  it('rejects an unknown kind, a missing kind and a value too shallow for its kind', () => {
    for (const value of ['thing|a', 'a', '|a', 'module|', 'behavior|a.b']) {
      const result = tryCreateElementId(value);
      expect(result.isErr()).toBe(true);
      expect(result.isErr() && result.error[0]?.message).toContain(
        JSON.stringify(value),
      );
    }
    expect(() => createElementId('thing|a')).toThrow(ValueObjectError);
  });

  it('testable ids leave modules out', () => {
    expect(createTestableElementId('building_block|a.b')).toBeInstanceOf(
      BuildingBlockId,
    );
    expect(createTestableElementId('behavior|a.b.c')).toBeInstanceOf(
      BehaviorId,
    );
    const result = tryCreateTestableElementId('module|a');
    expect(result.isErr() && result.error[0]?.message).toContain(
      'not testable',
    );
  });

  describe('schema', () => {
    it('decodes each kind and encodes it back to the same string', () => {
      for (const wire of ['module|a', 'building_block|a.b', 'behavior|a.b.c']) {
        const id = z.decode(ElementIdSchema, wire);
        expect(id.value).toBe(wire);
        expect(z.encode(ElementIdSchema, id)).toBe(wire);
      }
    });

    it('holds an array of mixed kinds', () => {
      const Dto = z.object({ elements: z.array(ElementIdSchema) });
      const wire = { elements: ['module|a', 'behavior|a.b.c'] };
      const dto = Dto.parse(wire);
      expect(dto.elements[0]).toBeInstanceOf(ModuleId);
      expect(dto.elements[1]).toBeInstanceOf(BehaviorId);
      expect(z.encode(Dto, dto)).toEqual(wire);
    });

    it('reports a bad element at its path', () => {
      const Dto = z.object({ elements: z.array(ElementIdSchema) });
      const result = Dto.safeParse({ elements: ['module|a', 'behavior|a.b'] });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['elements', 1]);
    });

    it('rejects an unknown kind on the wire', () => {
      expect(ElementIdSchema.safeParse('thing|a').success).toBe(false);
      expect(TestableElementIdSchema.safeParse('module|a').success).toBe(false);
      expect(
        z.decode(TestableElementIdSchema, 'building_block|a.b'),
      ).toBeInstanceOf(BuildingBlockId);
    });

    it('advertises one string pattern', () => {
      expect(z.toJSONSchema(ElementIdSchema, { io: 'input' })).toMatchObject({
        type: 'string',
        pattern: expect.stringContaining('behavior'),
      });
    });
  });
});
