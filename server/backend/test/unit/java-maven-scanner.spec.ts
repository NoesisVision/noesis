import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { chmod, cp, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import {
  JAVA_SCANNER_PLUGIN_VERSION,
  JavaMavenSourceCodeScanner,
} from '#backend/adapters/out/scanners/java-maven/java-maven.scanner';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

/*
 * The Java scanner runs Maven with the `noesis:scan` plugin and projects what
 * it wrote. Here Maven is a bun script (test/support/fake-code-model-tool.ts)
 * that copies the committed code model of the fixture build under
 * test/fixtures/java/shop into `-Dnoesis.out`, so the whole chain runs without
 * a JDK. The real plugin runs in test/e2e/java-maven-scanner.e2e.spec.ts.
 */

const FIXTURE = join(import.meta.dir, '..', 'fixtures', 'java', 'shop');
const FAKE_TOOL = join(
  import.meta.dir,
  '..',
  'support',
  'fake-code-model-tool.ts',
);
const SCAN_GOAL = `vision.noesis:noesis-scanner-maven-plugin:${JAVA_SCANNER_PLUGIN_VERSION}:scan`;

let t: TestNoesis;
let scanner: JavaMavenSourceCodeScanner;

/** A scanner whose first stage is the fake tool with `flags` of its own. */
const scannerWith = (...flags: string[]) =>
  new JavaMavenSourceCodeScanner({
    noesis: t.noesis,
    now: () => NOW,
    command: ['bun', FAKE_TOOL, ...flags],
  });

beforeEach(async () => {
  t = await testNoesis();
  scanner = scannerWith('--source', FIXTURE);
  await cp(
    join(FIXTURE, 'noesis-config.json'),
    join(t.root, 'noesis-config.json'),
  );
});

afterEach(() => t.cleanup());

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

describe('The Java scanner for Maven builds', () => {
  it('runs the plugin after process-classes, by its full coordinates, into the session directory', async () => {
    await scanner.scan();

    const out = t.noesis.resolve('sessions', 'scanner');
    const args = (await Bun.file(
      join(out, 'fake-scan-args.json'),
    ).json()) as string[];
    expect<unknown>(args).toEqual([
      '--source',
      FIXTURE,
      '-B',
      '-q',
      '-ntp',
      `-Dnoesis.out=${out}`,
      `-Dnoesis.repositoryRoot=${t.root}`,
      `-Dnoesis.repository=${basename(t.root)}`,
      '-Dnoesis.engine=source',
      'process-classes',
      SCAN_GOAL,
    ]);
  });

  it('passes the engine it was configured with', async () => {
    const bytecode = new JavaMavenSourceCodeScanner({
      noesis: t.noesis,
      now: () => NOW,
      command: ['bun', FAKE_TOOL, '--source', FIXTURE],
      engine: 'bytecode',
    });
    await bytecode.scan();

    const args = (await Bun.file(
      join(t.noesis.resolve('sessions', 'scanner'), 'fake-scan-args.json'),
    ).json()) as string[];
    expect<unknown>(args).toContain('-Dnoesis.engine=bytecode');
  });

  it("prefers the repository's own mvnw when no command is configured", async () => {
    const wrapper = join(t.root, 'mvnw');
    await writeFile(
      wrapper,
      `#!/bin/sh\nexec bun ${JSON.stringify(FAKE_TOOL)} --source ${JSON.stringify(FIXTURE)} "$@"\n`,
    );
    await chmod(wrapper, 0o755);
    const byWrapper = new JavaMavenSourceCodeScanner({
      noesis: t.noesis,
      now: () => NOW,
    });

    const model = await byWrapper.scan();

    expect<unknown>(model.buildingBlocks.length).toBeGreaterThan(0);
    const args = (await Bun.file(
      join(t.noesis.resolve('sessions', 'scanner'), 'fake-scan-args.json'),
    ).json()) as string[];
    expect<unknown>(args.at(-1)).toBe(SCAN_GOAL);
  });

  it('projects the code model the plugin wrote onto a system model by the Java vocabulary', async () => {
    const model = SystemModel.parse(await scanner.scan());

    expect<unknown>(SystemModelId.safeParse(model.id).success).toBe(true);
    expect<unknown>(model.name).toBe(basename(t.root));
    expect<unknown>(model.scanned_at).toBe(NOW);

    // com.acme is skipped by noesis-config.json, *.internal excluded; the
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
    // Java has no properties: a class's private fields are none, but a
    // record's components are (R5.7), the UUID a primitive, OrderId a block.
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
    // A public field is a property too; a record's accessors are not behaviours.
    expect<unknown>(
      model.buildingBlocks.find((b) => b.name === 'OrderLine')?.properties,
    ).toEqual([
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
        'behavior|shop.orders.OrderLine.product',
        'Command',
        [],
        ['building_block|shop.products.ProductId'],
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

  it('maps packages by noesis-config.json, every package to itself without one', async () => {
    await writeFile(join(t.root, 'noesis-config.json'), '{}');

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

  it('fails with the build output when Maven exits with an error', async () => {
    await expect<unknown>(scannerWith('--fail', '1').scan()).rejects.toThrow(
      /exit code 1[\s\S]*failing as asked/,
    );
  });

  it('fails when the plugin wrote no manifest', async () => {
    await expect<unknown>(scannerWith().scan()).rejects.toThrow(
      'no readable manifest',
    );
  });

  it('fails when Maven is not installed', async () => {
    const missing = new JavaMavenSourceCodeScanner({
      noesis: t.noesis,
      now: () => NOW,
      command: ['mvn-that-does-not-exist'],
    });

    await expect<unknown>(missing.scan()).rejects.toThrow(
      /Cannot run[\s\S]*mvn install/,
    );
  });

  it('starts from an empty output directory, so a stale model is never read', async () => {
    const stale = t.noesis.resolve('sessions', 'scanner', 'code-model', 'java');
    await mkdir(dirname(join(stale, 'x')), { recursive: true });
    await writeFile(join(stale, 'Stale.code-model.json'), '{}');

    await expect<unknown>(scannerWith().scan()).rejects.toThrow(
      'no readable manifest',
    );
    expect<unknown>(
      await Bun.file(join(stale, 'Stale.code-model.json')).exists(),
    ).toBe(false);
  });
});
