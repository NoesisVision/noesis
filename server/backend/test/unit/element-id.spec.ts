import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import { z } from 'zod';
import {
  BehaviourId,
  BuildingBlockId,
  ElementId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';

const BAD_NAMES = ['', ' ', ' a', 'a ', 'a.b', '.', 'a\tb ', 'a|b', '|'];

describe('ElementName', () => {
  it('accepts a name with no separator and no padding', () => {
    for (const name of ['a', 'Refund', 'two words', 'x-y_z']) {
      expect(ElementName.safeParse(name).success).toBe(true);
    }
  });

  it.each(BAD_NAMES)('rejects %j', (name) => {
    expect(ElementName.safeParse(name).success).toBe(false);
  });
});

describe('ModuleId', () => {
  it('accepts a path of any depth with the module kind', () => {
    for (const value of [
      'module|sales',
      'module|sales.orders',
      'module|a.b.c.d',
    ]) {
      expect(ModuleId.safeParse(value).success).toBe(true);
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
  ])('rejects %j', (value) => {
    expect(ModuleId.safeParse(value).success).toBe(false);
  });

  it('builds a root module and one within it', () => {
    const root = ModuleId.root('sales');
    expect(root).toBe(ModuleId.parse('module|sales'));
    expect(ModuleId.within(root, 'orders')).toBe(
      ModuleId.parse('module|sales.orders'),
    );
  });

  it.each(BAD_NAMES)('refuses to build from the name %j', (name) => {
    expect(() => ModuleId.root(name)).toThrow(z.ZodError);
    expect(() => ModuleId.within(ModuleId.root('sales'), name)).toThrow(
      z.ZodError,
    );
  });

  it('knows its parent and name', () => {
    const root = ModuleId.root('sales');
    const child = ModuleId.within(root, 'orders');
    expect(ModuleId.parentOf(child)).toBe(root);
    expect(ModuleId.parentOf(root)).toBeNull();
    expect(ElementId.nameOf(child)).toBe('orders');
  });

  it('advertises the pattern', () => {
    expect(z.toJSONSchema(ModuleId, { io: 'input' })).toMatchObject({
      type: 'string',
      pattern: expect.stringContaining('module'),
    });
  });
});

describe('BuildingBlockId', () => {
  it('needs a module before its name', () => {
    expect(
      BuildingBlockId.safeParse('building_block|sales.orders.Refund').success,
    ).toBe(true);
    expect(BuildingBlockId.safeParse('building_block|Refund').success).toBe(
      false,
    );
    expect(BuildingBlockId.safeParse('module|sales.Refund').success).toBe(
      false,
    );
  });

  it('is built in its module and knows it', () => {
    const module = ModuleId.within(ModuleId.root('sales'), 'orders');
    const block = BuildingBlockId.within(module, 'Refund');
    expect(block).toBe(
      BuildingBlockId.parse('building_block|sales.orders.Refund'),
    );
    expect(ModuleId.containing(block)).toBe(module);
    expect(ElementId.nameOf(block)).toBe('Refund');
  });

  it('refuses a name that would nest it one level deeper', () => {
    expect(() => BuildingBlockId.within(ModuleId.root('sales'), 'x.y')).toThrow(
      z.ZodError,
    );
  });
});

describe('BehaviourId', () => {
  it('needs a building block before its name', () => {
    expect(BehaviourId.safeParse('behaviour|sales.Refund.issue').success).toBe(
      true,
    );
    expect(BehaviourId.safeParse('behaviour|sales.Refund').success).toBe(false);
    expect(
      BehaviourId.safeParse('building_block|sales.Refund.issue').success,
    ).toBe(false);
  });

  it('is built on its building block and knows it', () => {
    const block = BuildingBlockId.parse('building_block|sales.orders.Refund');
    const behaviour = BehaviourId.within(block, 'issue');
    expect(behaviour).toBe(
      BehaviourId.parse('behaviour|sales.orders.Refund.issue'),
    );
    expect(BuildingBlockId.containing(behaviour)).toBe(block);
    expect(ModuleId.containing(behaviour)).toBe(
      ModuleId.parse('module|sales.orders'),
    );
    expect(ElementId.nameOf(behaviour)).toBe('issue');
  });
});

describe('ElementId', () => {
  it('accepts each kind and rejects an unknown kind or a value too shallow for its kind', () => {
    for (const value of ['module|a', 'building_block|a.b', 'behaviour|a.b.c']) {
      expect(ElementId.parse(value)).toBe(value as ElementId);
    }
    for (const value of ['thing|a', 'a', '|a', 'module|', 'behaviour|a.b']) {
      expect(ElementId.safeParse(value).success).toBe(false);
    }
  });

  it('tells the kinds apart', () => {
    const ids = ['module|a', 'building_block|a.b', 'behaviour|a.b.c'].map((v) =>
      ElementId.parse(v),
    );
    expect(ids.map(ElementId.isModule)).toEqual([true, false, false]);
    expect(ids.map(ElementId.isBuildingBlock)).toEqual([false, true, false]);
    expect(ids.map(ElementId.isBehaviour)).toEqual([false, false, true]);
    expect(
      ids.map((id) =>
        ElementId.match(id, {
          module: () => 'module',
          buildingBlock: () => 'building block',
          behaviour: () => 'behaviour',
        }),
      ),
    ).toEqual(['module', 'building block', 'behaviour']);
  });

  it('reports a bad element at its path', () => {
    const Dto = z.object({ elements: z.array(ElementId) });
    const result = Dto.safeParse({ elements: ['module|a', 'behaviour|a.b'] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['elements', 1]);
  });

  it('is the same string on the wire and in the domain', () => {
    const Dto = z.object({ elements: z.array(ElementId) });
    const wire = { elements: ['module|a', 'behaviour|a.b.c'] };
    expect(z.encode(Dto, Dto.parse(wire))).toEqual(wire);
  });
});

/** Any text `ElementName` takes: no separator, nothing padded on. */
const elementName = fc
  .string({ unit: 'grapheme', minLength: 1 })
  .map((text) => text.replace(/[.|]/g, '-').trim())
  .filter((text) => ElementName.safeParse(text).success);

describe('element ids, for any names', () => {
  it('give back the names and the containers they were built from', () => {
    fc.assert(
      fc.property(
        elementName,
        elementName,
        elementName,
        elementName,
        (a, b, c, d) => {
          const root = ModuleId.root(a);
          const module = ModuleId.within(root, b);
          const block = BuildingBlockId.within(module, c);
          const behaviour = BehaviourId.within(block, d);

          expect(ModuleId.parentOf(root)).toBeNull();
          expect(ModuleId.parentOf(module)).toBe(root);
          expect(ModuleId.containing(block)).toBe(module);
          expect(BuildingBlockId.containing(behaviour)).toBe(block);
          expect(ModuleId.containing(behaviour)).toBe(module);
          expect(
            [root, module, block, behaviour].map((id) => ElementId.nameOf(id)),
          ).toEqual([a, b, c, d]);
        },
      ),
    );
  });

  it('tell the kinds apart by their prefix alone', () => {
    fc.assert(
      fc.property(elementName, elementName, elementName, (a, b, c) => {
        const module = ModuleId.root(a);
        const block = BuildingBlockId.within(module, b);
        const behaviour = BehaviourId.within(block, c);
        const kind = (id: ElementId) =>
          ElementId.match(id, {
            module: () => 'module',
            buildingBlock: () => 'buildingBlock',
            behaviour: () => 'behaviour',
          });
        expect([module, block, behaviour].map(kind)).toEqual([
          'module',
          'buildingBlock',
          'behaviour',
        ]);
      }),
    );
  });
});
