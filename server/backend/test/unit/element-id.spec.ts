import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  ActorId,
  BehaviorId,
  BuildingBlockId,
  DeployableUnitId,
  ElementId,
  ElementName,
  LibraryId,
  ManualProcessId,
  ModuleId,
  RuleId,
  ScenarioId,
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

describe('BehaviorId', () => {
  it('needs a building block before its name', () => {
    expect(BehaviorId.safeParse('behavior|sales.Refund.issue').success).toBe(
      true,
    );
    expect(BehaviorId.safeParse('behavior|sales.Refund').success).toBe(false);
    expect(
      BehaviorId.safeParse('building_block|sales.Refund.issue').success,
    ).toBe(false);
  });

  it('is built on its building block and knows it', () => {
    const block = BuildingBlockId.parse('building_block|sales.orders.Refund');
    const behavior = BehaviorId.within(block, 'issue');
    expect(behavior).toBe(
      BehaviorId.parse('behavior|sales.orders.Refund.issue'),
    );
    expect(BuildingBlockId.containing(behavior)).toBe(block);
    expect(ModuleId.containing(behavior)).toBe(
      ModuleId.parse('module|sales.orders'),
    );
    expect(ElementId.nameOf(behavior)).toBe('issue');
  });
});

describe('RuleId', () => {
  it('needs a module before its name', () => {
    expect(RuleId.safeParse('rule|sales.Non-empty order').success).toBe(true);
    expect(RuleId.safeParse('rule|Non-empty order').success).toBe(false);
  });

  it('is built on the module of the behavior that governs it', () => {
    const rule = RuleId.within(
      ModuleId.parse('module|sales.orders'),
      'Non-empty order',
    );
    expect(rule).toBe(RuleId.parse('rule|sales.orders.Non-empty order'));
    expect(ElementId.nameOf(rule)).toBe('Non-empty order');
  });
});

describe('ScenarioId', () => {
  it('needs a rule before its name', () => {
    expect(
      ScenarioId.safeParse('scenario|sales.Non-empty order.Refused').success,
    ).toBe(true);
    expect(ScenarioId.safeParse('scenario|sales.Refused').success).toBe(false);
  });

  it('is built on its rule', () => {
    const rule = RuleId.parse('rule|sales.Non-empty order');
    expect(ScenarioId.within(rule, 'Refused')).toBe(
      ScenarioId.parse('scenario|sales.Non-empty order.Refused'),
    );
  });
});

describe('ElementId', () => {
  it('accepts each kind and rejects an unknown kind or a value too shallow for its kind', () => {
    for (const value of [
      'module|a',
      'building_block|a.b',
      'behavior|a.b.c',
      'rule|a.b',
      'scenario|a.b.c',
    ]) {
      expect(ElementId.parse(value)).toBe(value as ElementId);
    }
    for (const value of ['thing|a', 'a', '|a', 'module|', 'behavior|a.b']) {
      expect(ElementId.safeParse(value).success).toBe(false);
    }
  });

  it('tells the kinds apart', () => {
    const ids = [
      'module|a',
      'building_block|a.b',
      'behavior|a.b.c',
      'rule|a.b',
      'scenario|a.b.c',
      'actor|Support agent',
      'manual_process|Refund a return',
      'deployable_unit|shop-api',
      'library|MyCompany.Sales.DeepModel',
    ].map((v) => ElementId.parse(v));
    const only = (index: number) => ids.map((_, i) => i === index);
    expect(ids.map(ElementId.isModule)).toEqual(only(0));
    expect(ids.map(ElementId.isBuildingBlock)).toEqual(only(1));
    expect(ids.map(ElementId.isBehavior)).toEqual(only(2));
    expect(ids.map(ElementId.isRule)).toEqual(only(3));
    expect(ids.map(ElementId.isScenario)).toEqual(only(4));
    expect(ids.map(ElementId.isActor)).toEqual(only(5));
    expect(ids.map(ElementId.isManualProcess)).toEqual(only(6));
    expect(ids.map(ElementId.isDeployableUnit)).toEqual(only(7));
    expect(ids.map(ElementId.isLibrary)).toEqual(only(8));
    expect(
      ids.map((id) =>
        ElementId.match(id, {
          module: () => 'module',
          buildingBlock: () => 'building block',
          behavior: () => 'behavior',
          rule: () => 'rule',
          scenario: () => 'scenario',
          actor: () => 'actor',
          manualProcess: () => 'manual process',
          deployableUnit: () => 'deployable unit',
          library: () => 'library',
        }),
      ),
    ).toEqual([
      'module',
      'building block',
      'behavior',
      'rule',
      'scenario',
      'actor',
      'manual process',
      'deployable unit',
      'library',
    ]);
  });

  it('names an actor and a manual process by their name alone', () => {
    expect<string>(ActorId.of('Support agent')).toBe('actor|Support agent');
    expect<string>(ManualProcessId.of('Refund a return')).toBe(
      'manual_process|Refund a return',
    );
    expect(() => ActorId.of('Support.agent')).toThrow();
    expect(ActorId.safeParse('actor|a.b').success).toBe(false);
    expect(ManualProcessId.safeParse('manual_process|a.b').success).toBe(false);
  });

  it('names a deployable unit and a library by the whole name the build gives, dots and all', () => {
    expect<string>(DeployableUnitId.of('shop-api')).toBe(
      'deployable_unit|shop-api',
    );
    const library = LibraryId.of('MyCompany.Sales.DeepModel');
    expect<string>(library).toBe('library|MyCompany.Sales.DeepModel');
    expect(ElementId.nameOf(library)).toBe('MyCompany.Sales.DeepModel');
    expect(() => LibraryId.of('a|b')).toThrow();
    expect(() => DeployableUnitId.of(' api')).toThrow();
    expect(LibraryId.safeParse('library|').success).toBe(false);
  });

  it('reports a bad element at its path', () => {
    const Dto = z.object({ elements: z.array(ElementId) });
    const result = Dto.safeParse({ elements: ['module|a', 'behavior|a.b'] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['elements', 1]);
  });

  it('is the same string on the wire and in the domain', () => {
    const Dto = z.object({ elements: z.array(ElementId) });
    const wire = { elements: ['module|a', 'behavior|a.b.c'] };
    expect(z.encode(Dto, Dto.parse(wire))).toEqual(wire);
  });
});
