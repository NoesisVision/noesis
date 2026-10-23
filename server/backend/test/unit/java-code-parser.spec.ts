import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { cp, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { JavaCodeParser } from '#backend/adapters/out/scanner/parsers/java-code-parser';
import { SystemModel } from '#backend/app/scanner/system-model/system-model';
import { SystemModelId } from '#backend/app/scanner/system-model/system-model-id';
import { settingsScanner } from '../support/test-scanner';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

/*
 * A Java repository declares the Noesis Maven plugin in its build and runs
 * it through the `code-model` scanner (test/fixtures/java/shop/.noesis/settings.json).
 * Here the build is a bun script (test/support/fake-code-model-tool.ts) that
 * copies the committed code model of the fixture into `-Dnoesis.out`, so the
 * Java system model is built without a JDK. The real build runs in
 * test/e2e-toolchain/java-parser.e2e.spec.ts.
 */

const FIXTURE = join(import.meta.dir, '..', 'fixtures', 'java', 'shop');
const FAKE_TOOL = join(
  import.meta.dir,
  '..',
  'support',
  'fake-code-model-tool.ts',
);

let t: TestNoesis;
let scanner: ReturnType<typeof settingsScanner>;

beforeEach(async () => {
  t = await testNoesis();
  scanner = settingsScanner(
    t.noesis,
    () =>
      new JavaCodeParser({
        noesis: t.noesis,
        codeModel: {
          command: [
            'bun',
            FAKE_TOOL,
            '--source',
            FIXTURE,
            '-Dnoesis.out={out}',
          ],
        },
      }),
    () => NOW,
  );
  await cp(
    join(FIXTURE, '.noesis', 'settings.json'),
    t.noesis.resolve('settings.json'),
  );
});

afterEach(() => t.cleanup());

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

describe('A Java repository scanned through its Maven plugin', () => {
  it('builds the system model of the code model the plugin wrote by the Java vocabulary', async () => {
    const model = SystemModel.parse(await scanner.scan());

    expect<unknown>(SystemModelId.safeParse(model.id).success).toBe(true);
    expect<unknown>(model.name).toBe(basename(t.root));
    expect<unknown>(model.scanned_at).toBe(NOW);

    // com.acme is skipped by .noesis/settings.json, *.internal excluded; the
    // infrastructure module has no blocks.
    const domain = 'shop-domain/src/main/java/com/acme/shop';
    expect<unknown>(model.modules.map((m) => [m.id, m.source])).toEqual([
      ['module|shop', { path: `${domain}/internal/Hidden.java`, line: 1 }],
      ['module|shop.orders', { path: `${domain}/orders/Money.java`, line: 1 }],
      [
        'module|shop.pricing',
        { path: `${domain}/pricing/PriceRepository.java`, line: 1 },
      ],
      [
        'module|shop.products',
        { path: `${domain}/products/ProductId.java`, line: 1 },
      ],
    ]);

    expect<unknown>(model.buildingBlocks.map((b) => [b.id, b.type])).toEqual([
      ['building_block|shop.orders.Money', 'value_object'],
      ['building_block|shop.orders.Order', 'aggregate'],
      ['building_block|shop.orders.Order Repository', 'repository'],
      ['building_block|shop.orders.OrderId', 'value_object'],
      ['building_block|shop.orders.OrderLine', 'entity'],
      ['building_block|shop.orders.OrderLineAdded', 'value_object'],
      ['building_block|shop.orders.OrderStatus', 'value_object'],
      ['building_block|shop.orders.PlaceOrder', 'value_object'],
      ['building_block|shop.orders.PlaceOrderHandler', 'application_service'],
      ['building_block|shop.pricing.PriceRepository', 'repository'],
      ['building_block|shop.pricing.PricingService', 'domain_service'],
      ['building_block|shop.products.ProductId', 'value_object'],
    ]);

    const order = model.buildingBlocks.find((b) => b.name === 'Order');
    expect<unknown>(order).toMatchObject({
      description: 'An order *placed* by a customer.',
      implements: [],
      source: { path: `${domain}/orders/Order.java`, line: 14 },
    });
    // A class's private fields are no properties unless a getter exposes
    // them (R5.8), and Order has none; a record's components are (R5.7),
    // the UUID a primitive, OrderId a block.
    expect<unknown>(order?.properties).toEqual([]);
    expect<unknown>(
      model.buildingBlocks.find((b) => b.name === 'PlaceOrder')?.properties,
    ).toEqual([
      {
        name: 'note',
        type: 'primitive|string',
        description: null,
        optional: false,
      },
      {
        name: 'orderId',
        type: 'building_block|shop.orders.OrderId',
        description: null,
        optional: false,
      },
    ]);
    expect<unknown>(
      model.buildingBlocks.find((b) => b.name === 'OrderId')?.properties,
    ).toEqual([
      {
        name: 'value',
        type: 'primitive|uuid',
        description: null,
        optional: false,
      },
    ]);
    // A public field is a property too, and so is a private one behind the
    // fluent getter product() (R5.8), which is then no behaviour; a record's
    // accessors are not behaviours.
    expect<unknown>(
      model.buildingBlocks.find((b) => b.name === 'OrderLine')?.properties,
    ).toEqual([
      {
        name: 'product',
        type: 'building_block|shop.products.ProductId',
        description: null,
        optional: false,
      },
      {
        name: 'unitPrice',
        type: 'building_block|shop.orders.Money',
        description: null,
        optional: false,
      },
    ]);
    expect<unknown>(ids(model.behaviours)).not.toContain(
      'behavior|shop.orders.Money.amount',
    );
    expect<unknown>(ids(model.behaviours)).not.toContain(
      'behavior|shop.orders.OrderLine.product',
    );

    expect<unknown>(
      model.behaviours.map((b) => [
        b.id,
        b.type,
        b.input.map((i) => i.name),
        b.output.map((o) => o.type),
      ]),
    ).toEqual([
      [
        'behavior|shop.orders.Money.add',
        'Command',
        ['other'],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.orders.Money.zero',
        'Command',
        ['currency'],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.orders.Order Repository.getBy',
        'Command',
        ['id'],
        ['building_block|shop.orders.Order'],
      ],
      ['behavior|shop.orders.Order Repository.save', 'Command', ['order'], []],
      // The overload with the most parameters stands for both addLine methods.
      [
        'behavior|shop.orders.Order.addLine',
        'Command',
        ['product', 'quantity'],
        [],
      ],
      [
        'behavior|shop.orders.Order.create',
        'Command',
        ['id'],
        ['building_block|shop.orders.Order'],
      ],
      ['behavior|shop.orders.Order.persist', 'Command', ['repository'], []],
      ['behavior|shop.orders.Order.placeOrder', 'Command', [], []],
      // @QueryHandler fixes the type (R9.4).
      [
        'behavior|shop.orders.Order.total',
        'Query',
        [],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.orders.OrderLine.price',
        'Command',
        [],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.orders.PlaceOrderHandler.handle',
        'Command',
        ['command'],
        [],
      ],
      [
        'behavior|shop.pricing.PriceRepository.get',
        'Command',
        ['id'],
        ['building_block|shop.orders.Order'],
      ],
      ['behavior|shop.pricing.PricingService.discount', 'Command', [], []],
      // List<Money> is a collection, Optional<Money> and CompletableFuture<Money> are looked through.
      [
        'behavior|shop.pricing.PricingService.history',
        'Command',
        ['id'],
        [{ collectionOf: 'building_block|shop.orders.Money' }],
      ],
      [
        'behavior|shop.pricing.PricingService.priceFor',
        'Command',
        ['order'],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.pricing.PricingService.priceLater',
        'Command',
        ['order'],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.pricing.PricingService.tryPrice',
        'Command',
        ['order'],
        ['building_block|shop.orders.Money'],
      ],
    ]);
    expect<unknown>(
      model.behaviours.find((b) => b.name === 'tryPrice')?.output[0]?.optional,
    ).toBe(true);
    expect<unknown>(
      model.behaviours.find((b) => b.name === 'placeOrder'),
    ).toMatchObject({
      description: 'Places the order.',
      source: { path: `${domain}/orders/Order.java`, line: 42 },
    });

    // Calls, directly and through methods that are no behaviour: handle →
    // logTotal → total; the SqlOrderRepository implementation's calls count
    // for the interface's behaviours.
    expect<unknown>(
      Object.fromEntries(model.behaviours.map((b) => [b.name, b.invokes])),
    ).toMatchObject({
      handle: [
        'behavior|shop.orders.Order Repository.getBy',
        'behavior|shop.orders.Order Repository.save',
        'behavior|shop.orders.Order.placeOrder',
        'behavior|shop.orders.Order.total',
        'behavior|shop.pricing.PricingService.priceFor',
      ],
      save: ['behavior|shop.orders.Order.total'],
      getBy: ['behavior|shop.orders.Order.create'],
      placeOrder: ['behavior|shop.orders.Order.total'],
      total: [
        'behavior|shop.orders.Money.add',
        'behavior|shop.orders.Money.zero',
        'behavior|shop.orders.OrderLine.price',
      ],
      persist: ['behavior|shop.orders.Order Repository.save'],
    });
    expect<unknown>(ids(model.behaviours)).not.toContain(
      'behavior|shop.orders.Order.debug',
    );
    expect<unknown>(ids(model.behaviours)).not.toContain(
      'behavior|shop.orders.Order.toString',
    );
  });

  it('maps packages by .noesis/settings.json, every package to itself without one', async () => {
    await writeFile(t.noesis.resolve('settings.json'), '{}');

    const model = await scanner.scan();

    expect<unknown>(ids(model.modules)).toEqual([
      'module|com',
      'module|com.acme',
      'module|com.acme.shop',
      'module|com.acme.shop.internal',
      'module|com.acme.shop.orders',
      'module|com.acme.shop.pricing',
      'module|com.acme.shop.products',
    ]);
  });
});
