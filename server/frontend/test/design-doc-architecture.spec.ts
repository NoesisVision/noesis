import { describe, expect, it } from 'bun:test';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import type {
  BuildingBlockRefInput,
  BuildingBlockType,
} from '#backend/app/system-model/system-model.ts';
import type { ArchitectureCheck } from '../src/features/design-docs/architecture-outline';
import {
  architectureTreeOf,
  checkPath,
  defaultArchitectureExpansion,
  needPath,
} from '../src/features/design-docs/architecture-tree';
import {
  architectureOf,
  inferredFlowOf,
} from '../src/features/design-docs/design-doc-architecture';
import { qdocArchitectureFixture } from './fixtures/design-doc-architecture.fixture';

const agent = <const T>(value: T) => ({ value, author: 'agent' as const });

const block = (
  address: string,
  type: BuildingBlockType,
  uses: string[] = [],
) => ({
  id: `building_block|${address}`,
  type: agent(type),
  properties: {
    added: uses.map((used, index) => ({
      name: `p${index}`,
      type: agent(`building_block|${used}`),
    })),
  },
});

const behaviour = (
  address: string,
  visibility: { kind: 'private' } | { kind: 'public'; actors: string[] },
  io: {
    input?: BuildingBlockRefInput[];
    output?: BuildingBlockRefInput[];
  } = {},
) => ({
  id: `behavior|${address}`,
  type: agent('Command'),
  visibility: agent<typeof visibility>(visibility),
  input: {
    added: (io.input ?? []).map((type, index) => ({
      name: `in${index}`,
      type: agent(type),
    })),
  },
  output: { added: (io.output ?? []).map((type) => ({ type })) },
});

const PRIVATE = { kind: 'private' } as const;

/** A design of two hexagons that keeps to the architecture. */
const clean = {
  id: '2026-01-01-orders',
  name: 'Orders',
  description: '',
  buildingBlocks: {
    added: [
      block('sales.orders.OrderService', 'application_service'),
      block('sales.orders.Order', 'aggregate', ['sales.orders.OrderLine']),
      block('sales.orders.OrderLine', 'value_object'),
      block('sales.orders.Orders', 'repository'),
      block('sales.billing.BillingService', 'application_service'),
      block('sales.billing.Invoice', 'aggregate'),
    ],
  },
  behaviours: {
    added: [
      behaviour(
        'sales.orders.OrderService.place',
        { kind: 'public', actors: ['Customer'] },
        { input: [{ collectionOf: 'building_block|sales.orders.OrderLine' }] },
      ),
      behaviour('sales.orders.Orders.save', PRIVATE, {
        input: ['building_block|sales.orders.Order'],
      }),
      behaviour(
        'sales.billing.BillingService.bill',
        { kind: 'public', actors: ['Clerk'] },
        { output: ['building_block|sales.billing.Invoice'] },
      ),
    ],
  },
} satisfies DesignDocumentInput;

const checkOf = (document: DesignDocumentInput, id: string) =>
  architectureOf(document).checks.find((check) => check.id === id);

const levelsOf = (checks: ArchitectureCheck[]) =>
  Object.fromEntries(checks.map(({ id, level }) => [id, level]));

describe('architectureOf', () => {
  const outline = architectureOf(clean);
  const [orders, billing] = outline.hexagons;

  it('draws a hexagon for each module that holds building blocks', () => {
    expect(outline.hexagons.map(({ module }) => module)).toEqual([
      { id: 'module|sales.orders', name: 'orders' },
      { id: 'module|sales.billing', name: 'billing' },
    ]);
  });

  it('places each building block in the ring its type puts it in', () => {
    expect(orders?.applicationServices.map(({ name }) => name)).toEqual([
      'OrderService',
    ]);
    expect(orders?.domainCore.map(({ name }) => name)).toEqual([
      'Order',
      'OrderLine',
    ]);
    expect(orders?.drivenPorts.map(({ name }) => name)).toEqual(['Orders']);
  });

  it('makes a public behaviour of an application service a driving port, with its actors', () => {
    expect(orders?.drivingPorts).toEqual([
      expect.objectContaining({
        behaviour: expect.objectContaining({ name: 'place' }),
        service: 'building_block|sales.orders.OrderService',
        actors: ['Customer'],
      }),
    ]);
  });

  it('reads a type through a collection', () => {
    expect(orders?.drivingPorts[0]?.behaviour.uses).toEqual([
      'building_block|sales.orders.OrderLine',
    ]);
  });

  it('counts a block’s own behaviours in what it uses', () => {
    const repository = orders?.drivenPorts[0];
    expect(repository?.uses).toEqual(['building_block|sales.orders.Order']);
  });

  it('passes every check on a design that keeps to the architecture', () => {
    expect(levelsOf(outline.checks)).toEqual({
      'domain-depends-on-no-port': 'pass',
      'only-application-services-are-public': 'pass',
      'no-type-crosses-hexagons': 'pass',
      'type-in-no-contract': 'pass',
      'caller-unknown': 'pass',
    });
  });

  it('lists what a pass looked at', () => {
    expect(checkOf(clean, 'domain-depends-on-no-port')?.elementIds).toEqual([
      'building_block|sales.orders.Order',
      'building_block|sales.orders.OrderLine',
      'building_block|sales.billing.Invoice',
    ]);
  });

  it('places nothing it cannot: every type here is set', () => {
    expect(outline.unplaced).toEqual([]);
    expect(billing?.drivenPorts).toEqual([]);
  });
});

describe('the checks', () => {
  it('warn when a domain block uses a port', () => {
    const check = checkOf(
      {
        ...clean,
        buildingBlocks: {
          added: [
            ...clean.buildingBlocks.added,
            block('sales.orders.Pricing', 'domain_service', [
              'sales.orders.Orders',
            ]),
          ],
        },
      },
      'domain-depends-on-no-port',
    );
    expect(check).toMatchObject({
      level: 'warning',
      elementIds: [
        'building_block|sales.orders.Pricing',
        'building_block|sales.orders.Orders',
      ],
    });
    expect(check?.text).toStartWith('Pricing uses Orders');
  });

  it('warn when a block other than an application service is public', () => {
    const check = checkOf(
      {
        ...clean,
        behaviours: {
          added: [
            ...clean.behaviours.added,
            behaviour('sales.orders.Order.cancel', {
              kind: 'public',
              actors: [],
            }),
          ],
        },
      },
      'only-application-services-are-public',
    );
    expect(check).toMatchObject({
      level: 'warning',
      elementIds: ['behavior|sales.orders.Order.cancel'],
    });
  });

  it('warn when a type of one hexagon is used in another', () => {
    const check = checkOf(
      {
        ...clean,
        buildingBlocks: {
          added: [
            ...clean.buildingBlocks.added,
            block('sales.billing.InvoiceLine', 'value_object', [
              'sales.orders.OrderLine',
            ]),
          ],
        },
      },
      'no-type-crosses-hexagons',
    );
    expect(check).toMatchObject({
      level: 'warning',
      elementIds: [
        'building_block|sales.billing.InvoiceLine',
        'building_block|sales.orders.OrderLine',
      ],
    });
  });

  it('warn about a type nothing uses', () => {
    const check = checkOf(
      {
        ...clean,
        buildingBlocks: {
          added: [
            ...clean.buildingBlocks.added,
            block('sales.orders.Discount', 'value_object'),
          ],
        },
      },
      'type-in-no-contract',
    );
    expect(check).toMatchObject({
      level: 'warning',
      elementIds: ['building_block|sales.orders.Discount'],
    });
  });

  it('note a public behaviour with no actors as called by another subsystem', () => {
    const check = checkOf(
      {
        ...clean,
        behaviours: {
          added: [
            behaviour('sales.billing.BillingService.bill', {
              kind: 'public',
              actors: [],
            }),
          ],
        },
      },
      'caller-unknown',
    );
    expect(check).toMatchObject({
      level: 'note',
      elementIds: ['behavior|sales.billing.BillingService.bill'],
    });
  });
});

describe('an element the design leaves the type of alone', () => {
  const outline = architectureOf({
    ...clean,
    buildingBlocks: {
      added: clean.buildingBlocks.added,
      modified: [{ id: 'building_block|sales.orders.Customer' }],
    },
  });

  it('is listed as unplaced rather than guessed into a ring', () => {
    expect(outline.unplaced.map(({ name }) => name)).toEqual(['Customer']);
    expect(
      outline.hexagons.flatMap(({ domainCore }) => domainCore),
    ).not.toContainEqual(expect.objectContaining({ name: 'Customer' }));
  });
});

describe('the qdoc design', () => {
  const outline = architectureOf(qdocArchitectureFixture);
  const check = (id: string) => outline.checks.find((c) => c.id === id);

  it('finds the warning, the note and the passes the plan names', () => {
    expect(outline.checks.map(({ id, level }) => [id, level])).toEqual([
      ['type-in-no-contract', 'warning'],
      ['caller-unknown', 'note'],
      ['domain-depends-on-no-port', 'pass'],
      ['only-application-services-are-public', 'pass'],
      ['no-type-crosses-hexagons', 'pass'],
    ]);
  });

  it('finds NewQDocNotification in no contract', () => {
    expect(check('type-in-no-contract')?.elementIds).toEqual([
      'building_block|qdocmanagement.preparation.NewQDocNotification',
    ]);
  });

  it('finds notifyUsers called by another subsystem', () => {
    expect(check('caller-unknown')?.elementIds).toEqual([
      'behavior|qdocmanagement.notifications.NotificationService.notifyUsers',
    ]);
  });

  it('finds each need at the ports whose rules answer it, and one at none', () => {
    expect(
      outline.needsAtPorts.map(({ need, ports }) => [need.id, ports]),
    ).toEqual([
      [
        'start-a-qdoc',
        ['behavior|qdocmanagement.preparation.QDocCreationService.createQDoc'],
      ],
      [
        'know-about-new-qdocs',
        [
          'behavior|qdocmanagement.preparation.QDocCreationService.createQDoc',
          'behavior|qdocmanagement.notifications.NotificationService.notifyUsers',
        ],
      ],
      ['ready-to-write', []],
    ]);
  });

  it('infers that the number QDoc.create takes is the one the generator gives', () => {
    expect(
      inferredFlowOf(
        qdocArchitectureFixture,
        outline,
        'behavior|qdocmanagement.preparation.QDoc.create',
      ),
    ).toContainEqual({
      direction: 'takes',
      type: 'building_block|qdocmanagement.preparation.DocumentNumber',
      other: {
        id: 'behavior|qdocmanagement.preparation.DocumentNumberGenerator.next',
        name: 'next',
        owner: 'DocumentNumberGenerator',
      },
      typeMatchOnly: false,
    });
  });
});

describe('an inferred flow', () => {
  it('is a type match only when a private behaviour of another hexagon would take it', () => {
    const document = {
      ...clean,
      behaviours: {
        added: [
          ...clean.behaviours.added,
          behaviour('sales.orders.Order.invoice', PRIVATE, {
            input: ['building_block|sales.billing.Invoice'],
          }),
        ],
      },
    } satisfies DesignDocumentInput;
    expect(
      inferredFlowOf(
        document,
        architectureOf(document),
        'behavior|sales.billing.BillingService.bill',
      ),
    ).toEqual([
      {
        direction: 'gives',
        type: 'building_block|sales.billing.Invoice',
        other: {
          id: 'behavior|sales.orders.Order.invoice',
          name: 'invoice',
          owner: 'Order',
        },
        typeMatchOnly: true,
      },
    ]);
  });
});

describe('architectureTreeOf', () => {
  const outline = architectureOf(qdocArchitectureFixture);
  const nodes = architectureTreeOf(outline, new Set(['start-a-qdoc']));
  const byPath = new Map(nodes.map((node) => [node.path, node]));
  const unused = outline.checks[0];

  it('lists the checks, then the needs at the ports', () => {
    expect(
      nodes.filter(({ depth }) => depth === 0).map(({ name }) => name),
    ).toEqual(['Checks', 'Needs at the ports']);
  });

  it('puts each element a check concerns under it, by its element id', () => {
    const rows = nodes.filter(
      ({ parentPath }) =>
        unused !== undefined && parentPath === checkPath(unused),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        name: 'NewQDocNotification',
        elementId:
          'building_block|qdocmanagement.preparation.NewQDocNotification',
        kind: 'building_block',
        patternLabel: 'Value Object',
      }),
    ]);
  });

  it('marks a check with its level, searchable by the word', () => {
    expect(unused && byPath.get(checkPath(unused))).toMatchObject({
      kind: 'check',
      pattern: 'warning',
      patternLabel: 'Warning',
    });
  });

  it('opens the checks that found something and every need, and leaves the passes shut', () => {
    const open = defaultArchitectureExpansion(outline);
    expect(open.has(checkPath(outline.checks[0]!))).toBe(true);
    expect(open.has(checkPath(outline.checks.at(-1)!))).toBe(false);
    expect(open.has(needPath('ready-to-write'))).toBe(true);
  });
});
