import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { cp, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { JavaParser } from '#backend/adapters/out/scanners/code-parsers/java-parser';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { fixedClock } from '../support/fixed-clock';
import { inputOf, invokesOf, outputOf, stateOf } from '../support/relations';
import { settingsScanner } from '../support/test-scanner';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

/*
 * A Java repository declares the Noesis Maven plugin in its build and runs
 * it through the `java` parser (test/fixtures/java/shop/.noesis/settings.json).
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
      new JavaParser({
        noesis: t.noesis,
        settings: {
          language: 'java',
          command: [
            'bun',
            FAKE_TOOL,
            '--source',
            FIXTURE,
            '-Dnoesis.out={out}',
          ],
        },
      }),
    fixedClock(NOW),
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
    const firstLine = (path: string) => ({ path, startLine: 1, endLine: 1 });
    expect<unknown>(model.modules.map((m) => [m.id, m.source])).toEqual([
      ['module|shop', firstLine(`${domain}/internal/Hidden.java`)],
      ['module|shop.orders', firstLine(`${domain}/orders/Money.java`)],
      [
        'module|shop.pricing',
        firstLine(`${domain}/pricing/PriceRepository.java`),
      ],
      ['module|shop.products', firstLine(`${domain}/products/ProductId.java`)],
    ]);

    expect<unknown>(model.buildingBlocks.map((b) => [b.id, b.type])).toEqual([
      ['building_block|shop.orders.Money', 'value_object'],
      ['building_block|shop.orders.Order', 'aggregate'],
      ['building_block|shop.orders.Order Repository', 'repository'],
      ['building_block|shop.orders.OrderId', 'value_object'],
      ['building_block|shop.orders.OrderLine', 'entity'],
      ['building_block|shop.orders.OrderLineAdded', 'event'],
      ['building_block|shop.orders.OrderStatus', 'value_object'],
      ['building_block|shop.orders.PlaceOrder', 'command'],
      ['building_block|shop.orders.PlaceOrderHandler', 'application_service'],
      ['building_block|shop.pricing.PriceRepository', 'repository'],
      ['building_block|shop.pricing.PricingService', 'domain_service'],
      ['building_block|shop.products.ProductId', 'value_object'],
    ]);

    const order = model.buildingBlocks.find((b) => b.name === 'Order');
    expect<unknown>(order).toMatchObject({
      description: 'An order *placed* by a customer.',
      source: {
        path: `${domain}/orders/Order.java`,
        startLine: 14,
        endLine: 76,
      },
    });
    // A class's private fields are no properties unless a getter exposes
    // them (R5.8), and Order has none; a record's components are (R5.7),
    // the UUID a primitive, OrderId a block.
    expect<unknown>(stateOf(model, 'building_block|shop.orders.Order')).toEqual(
      [],
    );
    expect<unknown>(
      stateOf(model, 'building_block|shop.orders.PlaceOrder'),
    ).toEqual([
      ['orderId', 'building_block|shop.orders.OrderId', '1'],
      ['note', 'primitive|string', '1'],
    ]);
    expect<unknown>(
      stateOf(model, 'building_block|shop.orders.OrderId'),
    ).toEqual([['value', 'primitive|uuid', '1']]);
    // A public field is a property too, and so is a private one behind the
    // fluent getter product() (R5.8), which is then no behavior; a record's
    // accessors are not behaviors.
    expect<unknown>(
      stateOf(model, 'building_block|shop.orders.OrderLine'),
    ).toEqual([
      ['unitPrice', 'building_block|shop.orders.Money', '1'],
      ['product', 'building_block|shop.products.ProductId', '1'],
    ]);
    expect<unknown>(ids(model.behaviors)).not.toContain(
      'behavior|shop.orders.Money.amount',
    );
    expect<unknown>(ids(model.behaviors)).not.toContain(
      'behavior|shop.orders.OrderLine.product',
    );

    expect<unknown>(
      model.behaviors.map((b) => [
        b.id,
        inputOf(model, b.id).map(([name]) => name),
        outputOf(model, b.id).map(([to]) => to),
      ]),
    ).toEqual([
      [
        'behavior|shop.orders.Money.add',
        ['other'],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.orders.Money.zero',
        ['currency'],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.orders.Order Repository.getBy',
        ['id'],
        ['building_block|shop.orders.Order'],
      ],
      ['behavior|shop.orders.Order Repository.save', ['order'], []],
      // The overload with the most parameters stands for both addLine methods.
      ['behavior|shop.orders.Order.addLine', ['product', 'quantity'], []],
      [
        'behavior|shop.orders.Order.create',
        ['id'],
        ['building_block|shop.orders.Order'],
      ],
      ['behavior|shop.orders.Order.persist', ['repository'], []],
      ['behavior|shop.orders.Order.placeOrder', [], []],
      // @QueryHandler fixes the type (R9.4).
      [
        'behavior|shop.orders.Order.total',
        [],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.orders.OrderLine.price',
        [],
        ['building_block|shop.orders.Money'],
      ],
      ['behavior|shop.orders.PlaceOrderHandler.handle', ['command'], []],
      [
        'behavior|shop.pricing.PriceRepository.get',
        ['id'],
        ['building_block|shop.orders.Order'],
      ],
      ['behavior|shop.pricing.PricingService.discount', [], []],
      // List<Money> is a collection, Optional<Money> and CompletableFuture<Money> are looked through.
      [
        'behavior|shop.pricing.PricingService.history',
        ['id'],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.pricing.PricingService.priceFor',
        ['order'],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.pricing.PricingService.priceLater',
        ['order'],
        ['building_block|shop.orders.Money'],
      ],
      [
        'behavior|shop.pricing.PricingService.tryPrice',
        ['order'],
        ['building_block|shop.orders.Money'],
      ],
    ]);
    expect<unknown>(
      outputOf(model, 'behavior|shop.pricing.PricingService.history'),
    ).toEqual([['building_block|shop.orders.Money', '*']]);
    expect<unknown>(
      outputOf(model, 'behavior|shop.pricing.PricingService.tryPrice'),
    ).toEqual([['building_block|shop.orders.Money', '0..1']]);
    expect<unknown>(
      model.behaviors.find((b) => b.name === 'placeOrder'),
    ).toMatchObject({
      description: 'Places the order.',
      source: {
        path: `${domain}/orders/Order.java`,
        startLine: 42,
        endLine: 46,
      },
    });

    // Calls in the order they are made, directly and through methods that
    // are no behavior: handle → logTotal → total, at logTotal's place; the
    // SqlOrderRepository implementation's calls count for the interface's
    // behaviors.
    expect<unknown>(
      Object.fromEntries(
        model.behaviors.map((b) => [b.name, invokesOf(model, b.id)]),
      ),
    ).toMatchObject({
      handle: [
        'behavior|shop.orders.Order Repository.getBy',
        'behavior|shop.orders.Order.placeOrder',
        'behavior|shop.orders.Order.total',
        'behavior|shop.pricing.PricingService.priceFor',
        'behavior|shop.orders.Order Repository.save',
      ],
      save: ['behavior|shop.orders.Order.total'],
      getBy: ['behavior|shop.orders.Order.create'],
      placeOrder: ['behavior|shop.orders.Order.total'],
      total: [
        'behavior|shop.orders.Money.zero',
        'behavior|shop.orders.Money.add',
        'behavior|shop.orders.OrderLine.price',
      ],
      persist: ['behavior|shop.orders.Order Repository.save'],
    });
    expect<unknown>(ids(model.behaviors)).not.toContain(
      'behavior|shop.orders.Order.debug',
    );
    expect<unknown>(ids(model.behaviors)).not.toContain(
      'behavior|shop.orders.Order.toString',
    );
  });

  it('maps packages by .noesis/settings.json, every package to itself without namespace settings', async () => {
    await writeFile(
      t.noesis.resolve('settings.json'),
      JSON.stringify({ parser: { language: 'java', command: ['x'] } }),
    );

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
