import { describe, expect, it } from 'bun:test';
import type { DiagramPlan } from '#backend/app/system-model/diagram-plan.ts';
import {
  describeStep,
  resolveDiagramPlan,
} from '../src/features/system-model/diagram-plan';
import {
  type Exploration,
  type ExploredElement,
  neighboursOf,
} from '../src/features/system-model/system-model-exploration';

const element = (
  id: string,
  kind: ExploredElement['kind'],
  container: string | null,
  pattern: ExploredElement['pattern'] = null,
): ExploredElement => ({
  id,
  kind,
  name: id.slice(id.lastIndexOf('.') + 1).replace(/^.*\|/, ''),
  pattern,
  container,
});

// sales holds Order (aggregate) and OrderRepository; Order.place invokes
// Stock.reserve in another module; Order uses Money.
const exploration: Exploration = {
  elements: [
    element('module|sales', 'module', null),
    element(
      'building_block|sales.Order',
      'building_block',
      'module|sales',
      'aggregate',
    ),
    element(
      'behavior|sales.Order.place',
      'behavior',
      'building_block|sales.Order',
      'Command',
    ),
    element(
      'building_block|sales.OrderRepository',
      'building_block',
      'module|sales',
      'repository',
    ),
    element(
      'building_block|sales.Money',
      'building_block',
      'module|sales',
      'value_object',
    ),
    element('module|stock', 'module', null),
    element(
      'building_block|stock.Stock',
      'building_block',
      'module|stock',
      'aggregate',
    ),
    element(
      'behavior|stock.Stock.reserve',
      'behavior',
      'building_block|stock.Stock',
      'Command',
    ),
  ],
  uses: [['building_block|sales.Order', 'building_block|sales.Money']],
  invokes: [['behavior|sales.Order.place', 'behavior|stock.Stock.reserve']],
};
const elements = new Map(exploration.elements.map((each) => [each.id, each]));
const neighbours = neighboursOf(exploration);

// Ids are branded in the contract; a spec spells them as strings.
const resolve = (steps: unknown[]) =>
  resolveDiagramPlan(
    { summary: '', steps: steps as DiagramPlan['steps'] },
    elements,
    neighbours,
  );

describe('resolveDiagramPlan', () => {
  it('adds an element with everything inside it', () => {
    const plan = resolve([{ op: 'addInside', element: 'module|sales' }]);
    expect(plan.add).toEqual([
      'module|sales',
      'building_block|sales.Order',
      'behavior|sales.Order.place',
      'building_block|sales.OrderRepository',
      'building_block|sales.Money',
    ]);
    expect(plan.problems).toEqual([]);
  });

  it('adds what an element reaches, by the ways named', () => {
    const plan = resolve([
      {
        op: 'addNeighbours',
        element: 'building_block|sales.Order',
        reach: ['uses', 'isPartOf'],
      },
    ]);
    expect(plan.add).toEqual([
      'building_block|sales.Order',
      'building_block|sales.Money',
      'module|sales',
    ]);
  });

  it('follows a chain of calls across modules', () => {
    const plan = resolve([
      {
        op: 'addChain',
        element: 'building_block|sales.Order',
        reach: 'invokes',
      },
    ]);
    expect(plan.add).toContain('behavior|stock.Stock.reserve');
    expect(plan.add).toContain('building_block|stock.Stock');
  });

  it('lets a later step win, and clear forget what came before', () => {
    const plan = resolve([
      { op: 'add', elements: ['building_block|sales.Money'] },
      { op: 'remove', elements: ['building_block|sales.Money'] },
      { op: 'clear' },
      { op: 'add', elements: ['module|stock'] },
      { op: 'relations', show: ['contains'] },
      { op: 'direction', direction: 'horizontal' },
      { op: 'autoPlace' },
    ]);
    expect(plan.add).toEqual(['module|stock']);
    expect(plan.remove).toEqual([]);
    expect(plan.clear).toBe(true);
    expect([...(plan.relations ?? [])]).toEqual(['contains']);
    expect(plan.direction).toBe('horizontal');
    expect(plan.autoPlace).toBe(true);
  });

  it('names an element the model does not hold, and goes on', () => {
    const plan = resolve([
      { op: 'add', elements: ['building_block|sales.Nope', 'module|stock'] },
    ]);
    expect(plan.add).toEqual(['module|stock']);
    expect(plan.problems).toEqual([
      'The model has no element building_block|sales.Nope.',
    ]);
  });
});

describe('describeStep', () => {
  it('says each step as the page would do it', () => {
    expect(
      describeStep(
        {
          op: 'addChain',
          element: 'building_block|sales.Order',
          reach: 'usedBy',
        } as never,
        elements,
      ),
    ).toBe('Add Order and the chain of what uses it');
    expect(describeStep({ op: 'relations', show: [] }, null)).toBe(
      'Draw no relations',
    );
    expect(
      describeStep({ op: 'add', elements: ['module|stock'] } as never, null),
    ).toBe('Add stock');
  });
});
