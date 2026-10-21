import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { CSharpSourceCodeScanner } from '#backend/adapters/out/scanners/csharp/csharp.scanner';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

/*
 * The C# scanner runs `noesis-scan-csharp` and projects what it wrote. Here
 * the tool is a bun script (test/support/fake-code-model-tool.ts) that copies the
 * committed code model of the fixture solution under test/fixtures/csharp/shop
 * into `--out`, so the whole chain runs without .NET. The real tool runs in
 * test/e2e/csharp-scanner.e2e.spec.ts.
 */

const FIXTURE = join(import.meta.dir, '..', 'fixtures', 'csharp', 'shop');
const FAKE_TOOL = join(
  import.meta.dir,
  '..',
  'support',
  'fake-code-model-tool.ts',
);

let t: TestNoesis;
let scanner: CSharpSourceCodeScanner;

/** A scanner whose first stage is the fake tool with `flags` of its own. */
const scannerWith = (...flags: string[]) =>
  new CSharpSourceCodeScanner({
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

describe('The C# scanner', () => {
  it('runs the first stage into the session directory, over the repository root, named after it', async () => {
    await scanner.scan();

    const out = t.noesis.resolve('sessions', 'scanner');
    const args = (await Bun.file(
      join(out, 'fake-scan-args.json'),
    ).json()) as string[];
    expect<unknown>(args).toEqual([
      '--source',
      FIXTURE,
      t.root,
      '--out',
      out,
      '--repository-root',
      t.root,
      '--repository',
      basename(t.root),
    ]);
  });

  it('projects the code model the first stage wrote onto a system model', async () => {
    const model = SystemModel.parse(await scanner.scan());

    expect<unknown>(SystemModelId.safeParse(model.id).success).toBe(true);
    expect<unknown>(model.name).toBe(basename(t.root));
    expect<unknown>(model.scanned_at).toBe(NOW);

    // Acme is skipped by noesis-config.json, *.Internal excluded; the
    // Technical project is [assembly: ExcludeFromDocs]; Infrastructure has no blocks.
    expect<unknown>(model.modules.map((m) => [m.id, m.source])).toEqual([
      // The namespace Acme.Shop is first declared, in node order, in Internal/Hidden.cs.
      ['module|Shop', { path: 'Shop.Domain/Internal/Hidden.cs', line: 3 }],
      ['module|Shop.Orders', { path: 'Shop.Domain/Orders/Money.cs', line: 3 }],
      [
        'module|Shop.Pricing',
        { path: 'Shop.Domain/Pricing/PricingService.cs', line: 5 },
      ],
      [
        'module|Shop.Products',
        { path: 'Shop.Domain/Products/ProductId.cs', line: 3 },
      ],
    ]);

    expect<unknown>(model.buildingBlocks.map((b) => [b.id, b.type])).toEqual([
      ['building_block|Shop.Orders.BadlyNamed', 'value_object'],
      ['building_block|Shop.Orders.Money', 'value_object'],
      ['building_block|Shop.Orders.Order', 'aggregate'],
      ['building_block|Shop.Orders.Order LineAdded', 'value_object'],
      ['building_block|Shop.Orders.Order Repository', 'repository'],
      ['building_block|Shop.Orders.Order line', 'entity'],
      ['building_block|Shop.Orders.OrderId', 'value_object'],
      ['building_block|Shop.Orders.OrderStatus', 'value_object'],
      ['building_block|Shop.Orders.PlaceOrder', 'value_object'],
      ['building_block|Shop.Orders.PlaceOrderHandler', 'application_service'],
      ['building_block|Shop.Pricing.IRepository', 'repository'],
      ['building_block|Shop.Pricing.PricingService', 'domain_service'],
      ['building_block|Shop.Products.ProductId', 'value_object'],
    ]);

    const order = model.buildingBlocks.find((b) => b.name === 'Order');
    expect<unknown>(order).toMatchObject({
      description: 'An order *placed* by a customer.',
      implements: [],
      scenarios: [{ name: 'Order is placed', description: null, steps: [] }],
      source: { path: 'Shop.Domain/Orders/Order.cs', line: 11 },
    });
    // Public instance members only; the dictionary and the unannotated
    // IClock have no word in the model; _lines/Lines are one property.
    expect<unknown>(order?.properties).toEqual([
      {
        name: 'Lines',
        type: { collectionOf: 'building_block|Shop.Orders.Order line' },
        description: "The order's lines.",
        optional: false,
      },
      {
        name: 'Discount',
        type: 'building_block|Shop.Orders.Money',
        description: null,
        optional: true,
      },
      {
        name: 'PlacedOn',
        type: 'primitive|datetime',
        description: null,
        optional: true,
      },
      {
        name: 'Status',
        type: 'building_block|Shop.Orders.OrderStatus',
        description: null,
        optional: false,
      },
    ]);
    // Positional record properties are properties too.
    expect<unknown>(
      model.buildingBlocks.find((b) => b.name === 'PlaceOrder')?.properties,
    ).toEqual([
      {
        name: 'Note',
        type: 'primitive|string',
        description: null,
        optional: true,
      },
      {
        name: 'OrderId',
        type: 'building_block|Shop.Orders.OrderId',
        description: null,
        optional: false,
      },
    ]);
    expect<unknown>(
      model.buildingBlocks.find((b) => b.name === 'OrderStatus')?.properties,
    ).toEqual([]);

    expect<unknown>(
      model.behaviours.map((b) => [
        b.id,
        b.type,
        b.visibility,
        b.input.map((i) => i.name),
        b.output.map((o) => o.type),
      ]),
    ).toEqual([
      [
        'behavior|Shop.Orders.Money.Add',
        'Command',
        { kind: 'public', actors: [] },
        ['other'],
        ['building_block|Shop.Orders.Money'],
      ],
      [
        'behavior|Shop.Orders.Money.Zero',
        'Command',
        { kind: 'public', actors: [] },
        ['currency'],
        ['building_block|Shop.Orders.Money'],
      ],
      [
        'behavior|Shop.Orders.Order Repository.GetBy',
        'Command',
        { kind: 'public', actors: [] },
        ['id'],
        ['building_block|Shop.Orders.Order'],
      ],
      [
        'behavior|Shop.Orders.Order Repository.Save',
        'Command',
        { kind: 'public', actors: [] },
        ['order'],
        [],
      ],
      [
        'behavior|Shop.Orders.Order line.Price',
        'Command',
        { kind: 'public', actors: [] },
        [],
        ['building_block|Shop.Orders.Money'],
      ],
      [
        'behavior|Shop.Orders.Order.AddLine',
        'Command',
        { kind: 'public', actors: ['Customer'] },
        ['product', 'quantity'],
        [],
      ],
      [
        'behavior|Shop.Orders.Order.Create',
        'Command',
        { kind: 'public', actors: [] },
        ['id'],
        ['building_block|Shop.Orders.Order'],
      ],
      [
        'behavior|Shop.Orders.Order.Persist',
        'Command',
        { kind: 'public', actors: [] },
        ['repository'],
        [],
      ],
      [
        'behavior|Shop.Orders.Order.Place order',
        'Command',
        { kind: 'public', actors: [] },
        [],
        [],
      ],
      [
        'behavior|Shop.Orders.Order.Total',
        'Query',
        { kind: 'public', actors: [] },
        [],
        ['building_block|Shop.Orders.Money'],
      ],
      [
        'behavior|Shop.Orders.PlaceOrderHandler.Handle',
        'Command',
        { kind: 'public', actors: ['Customer'] },
        ['command'],
        [],
      ],
      [
        'behavior|Shop.Pricing.IRepository.Get',
        'Command',
        { kind: 'public', actors: [] },
        ['id'],
        ['building_block|Shop.Orders.Order'],
      ],
      [
        'behavior|Shop.Pricing.PricingService.Discount',
        'Command',
        { kind: 'public', actors: [] },
        [],
        [],
      ],
      [
        'behavior|Shop.Pricing.PricingService.History',
        'Command',
        { kind: 'public', actors: [] },
        ['id'],
        [{ collectionOf: 'building_block|Shop.Orders.Money' }],
      ],
      [
        'behavior|Shop.Pricing.PricingService.Last',
        'Command',
        { kind: 'public', actors: [] },
        ['count'],
        [{ collectionOf: 'building_block|Shop.Orders.Money' }],
      ],
      [
        'behavior|Shop.Pricing.PricingService.PriceFor',
        'Command',
        { kind: 'public', actors: [] },
        ['order'],
        ['building_block|Shop.Orders.Money'],
      ],
      [
        'behavior|Shop.Pricing.PricingService.TryPrice',
        'Command',
        { kind: 'public', actors: [] },
        ['order'],
        ['building_block|Shop.Orders.Money'],
      ],
    ]);

    const behaviour = (name: string) =>
      model.behaviours.find((b) => b.name === name);
    expect<unknown>(behaviour('Place order')).toMatchObject({
      description: 'Places the order.',
      scenarios: [{ name: 'Placed with lines' }],
      source: { path: 'Shop.Domain/Orders/Order.cs', line: 47 },
    });

    // Calls, directly and through methods that are no behaviour: Handle →
    // LogTotal → Total; the SqlOrderRepository implementation's calls count
    // for the interface's behaviours.
    expect<unknown>(
      Object.fromEntries(model.behaviours.map((b) => [b.name, b.invokes])),
    ).toMatchObject({
      Handle: [
        'behavior|Shop.Orders.Order Repository.GetBy',
        'behavior|Shop.Orders.Order Repository.Save',
        'behavior|Shop.Orders.Order.Place order',
        'behavior|Shop.Orders.Order.Total',
        'behavior|Shop.Pricing.PricingService.PriceFor',
      ],
      Save: ['behavior|Shop.Orders.Order.Total'],
      GetBy: ['behavior|Shop.Orders.Order.Create'],
      'Place order': ['behavior|Shop.Orders.Order.Total'],
      Total: [
        'behavior|Shop.Orders.Money.Add',
        'behavior|Shop.Orders.Money.Zero',
        'behavior|Shop.Orders.Order line.Price',
      ],
      Persist: ['behavior|Shop.Orders.Order Repository.Save'],
    });
    expect<unknown>(ids(model.behaviours)).not.toContain(
      'behavior|Shop.Orders.Order.Debug',
    );
    expect<unknown>(ids(model.behaviours)).not.toContain(
      'behavior|Shop.Orders.Order.ToString',
    );
  });

  it('maps namespaces by noesis-config.json, every namespace to itself without one', async () => {
    await writeFile(join(t.root, 'noesis-config.json'), '{}');

    const model = await scanner.scan();

    expect<unknown>(ids(model.modules)).toEqual([
      'module|Acme',
      'module|Acme.Shop',
      'module|Acme.Shop.Internal',
      'module|Acme.Shop.Orders',
      'module|Acme.Shop.Pricing',
      'module|Acme.Shop.Products',
    ]);
  });

  it('fails with the tool output when the first stage exits with an error', async () => {
    await expect<unknown>(scannerWith('--fail', '2').scan()).rejects.toThrow(
      /exit code 2[\s\S]*failing as asked/,
    );
  });

  it('fails when the first stage wrote no manifest', async () => {
    await expect<unknown>(scannerWith().scan()).rejects.toThrow(
      'no readable manifest',
    );
  });

  it('fails when the tool is not installed', async () => {
    const missing = new CSharpSourceCodeScanner({
      noesis: t.noesis,
      now: () => NOW,
      command: ['noesis-scan-csharp-that-does-not-exist'],
    });

    await expect<unknown>(missing.scan()).rejects.toThrow('Cannot run');
  });

  it('fails on a noesis-config.json of the wrong shape', async () => {
    await writeFile(
      join(t.root, 'noesis-config.json'),
      JSON.stringify({ namespacePartsToSkip: 'MyCompany' }),
    );

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      'Invalid noesis-config.json',
    );
  });

  it('starts from an empty output directory, so a stale model is never read', async () => {
    const stale = t.noesis.resolve(
      'sessions',
      'scanner',
      'code-model',
      'csharp',
    );
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
