import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { JavaSourceCodeScanner } from '#backend/adapters/out/scanners/java.scanner';
import { findJavaSources } from '#backend/adapters/out/scanners/java/java-files';
import { commonPackagePrefix } from '#backend/adapters/out/scanners/java/java-model';
import {
  parseTypeText,
  resolveType,
} from '#backend/adapters/out/scanners/java/type-refs';
import { BuildingBlockId, ModuleId } from '#backend/app/element-id';
import type { ScannedSystemModel } from '#backend/app/system-model/source-code-scanner';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let scanner: JavaSourceCodeScanner;

beforeEach(async () => {
  t = await testNoesis();
  scanner = new JavaSourceCodeScanner({ noesis: t.noesis, now: () => NOW });
});

afterEach(() => t.cleanup());

const FIXTURES = join(import.meta.dir, '..', 'fixtures', 'java');

/** Copies a fixture tree into the throwaway repository root. */
function fixtureTree(name: string): Promise<void> {
  return cp(join(FIXTURES, name), t.root, { recursive: true });
}

/** Lays out files under the root, given as path → content. */
async function files(entries: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(entries)) {
    await mkdir(join(t.root, path, '..'), { recursive: true });
    await writeFile(join(t.root, path), content);
  }
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

/* ----------------------------------------------------------- the files */

describe('findJavaSources', () => {
  it('lists main sources only: no tests, no package-info, no build output, no tool caches', async () => {
    await files({
      'src/main/java/com/acme/A.java': 'package com.acme; class A {}',
      'src/main/java/com/acme/package-info.java': 'package com.acme;',
      'src/main/java/module-info.java': 'module acme {}',
      'src/test/java/com/acme/ATest.java': 'package com.acme; class ATest {}',
      'target/generated-sources/com/acme/Gen.java': 'class Gen {}',
      'build/generated/com/acme/Gen.java': 'class Gen {}',
      '.gradle/caches/X.java': 'class X {}',
      'lib/src/main/java/com/acme/lib/B.java':
        'package com.acme.lib; class B {}',
    });

    const sources = await findJavaSources(t.root);
    expect(sources.map((s) => s.slice(t.root.length))).toEqual([
      '/lib/src/main/java/com/acme/lib/B.java',
      '/src/main/java/com/acme/A.java',
    ]);
  });
});

/* ----------------------------------------------------------- the types */

describe('parseTypeText', () => {
  it('reads simple, qualified, generic, array and varargs types', () => {
    expect(parseTypeText('Order')).toEqual({
      name: 'Order',
      args: [],
      array: false,
    });
    expect(parseTypeText('java.util.UUID')).toEqual({
      name: 'UUID',
      args: [],
      array: false,
    });
    expect(parseTypeText('Map<String, List<Integer>>')).toEqual({
      name: 'Map',
      args: [
        { name: 'String', args: [], array: false },
        {
          name: 'List',
          args: [{ name: 'Integer', args: [], array: false }],
          array: false,
        },
      ],
      array: false,
    });
    expect(parseTypeText('int[]')).toEqual({
      name: 'int',
      args: [],
      array: true,
    });
    expect(parseTypeText('String...')).toEqual({
      name: 'String',
      args: [],
      array: true,
    });
    expect(parseTypeText('? extends Discount')).toEqual({
      name: 'Discount',
      args: [],
      array: false,
    });
    expect(parseTypeText('?')).toBeNull();
    expect(parseTypeText('void')).toBeNull();
  });
});

describe('resolveType', () => {
  const order = BuildingBlockId.within(ModuleId.root('sales'), 'Order');
  const blocks = (name: string) => (name === 'Order' ? order : null);

  it('resolves blocks by simple name, primitives by the model vocabulary, collections and optionals around them', () => {
    expect<unknown>(resolveType('Order', blocks)).toEqual({
      ref: order,
      optional: false,
    });
    expect<unknown>(resolveType('int', blocks)).toEqual({
      ref: 'primitive|integer',
      optional: false,
    });
    expect<unknown>(resolveType('java.math.BigDecimal', blocks)).toEqual({
      ref: 'primitive|decimal',
      optional: false,
    });
    expect<unknown>(resolveType('List<Order>', blocks)).toEqual({
      ref: { collectionOf: order },
      optional: false,
    });
    expect<unknown>(resolveType('Order[]', blocks)).toEqual({
      ref: { collectionOf: order },
      optional: false,
    });
    expect<unknown>(resolveType('Option<Order>', blocks)).toEqual({
      ref: order,
      optional: true,
    });
    expect<unknown>(resolveType('Optional<List<String>>', blocks)).toEqual({
      ref: { collectionOf: 'primitive|string' },
      optional: true,
    });
  });

  it('resolves nothing the model has no word for: maps, unknown classes, wildcards, void', () => {
    expect<unknown>(resolveType('Map<String, Order>', blocks)).toBeNull();
    expect<unknown>(resolveType('HttpClient', blocks)).toBeNull();
    expect<unknown>(resolveType('List<?>', blocks)).toBeNull();
    expect<unknown>(resolveType('List<Unknown>', blocks)).toBeNull();
    expect<unknown>(resolveType('void', blocks)).toBeNull();
  });
});

describe('commonPackagePrefix', () => {
  it('is the longest shared leading run of segments', () => {
    expect(commonPackagePrefix([])).toEqual([]);
    expect(commonPackagePrefix(['com.acme.orders'])).toEqual([
      'com',
      'acme',
      'orders',
    ]);
    expect(
      commonPackagePrefix(['com.acme.orders', 'com.acme.billing.model']),
    ).toEqual(['com', 'acme']);
    expect(commonPackagePrefix(['com.acme', 'org.other'])).toEqual([]);
  });
});

/* ----------------------------------------------------------- the model */

async function scanned(): Promise<ScannedSystemModel> {
  const model = await scanner.scan();
  // Whatever the scanner finds must fit the contract once the server adds the id.
  SystemModel.parse({ ...model, id: SystemModelId.mint() });
  return model;
}

describe('The Java scanner', () => {
  it('refuses a root without Java sources rather than answering an empty model', async () => {
    await files({ 'README.md': '# nothing to scan' });
    await expect(scanner.scan()).rejects.toThrow('No Java sources');
  });

  it('models the repository: packages below the common prefix as nested modules, stereotyped types as blocks, their methods and fields as behaviours and properties', async () => {
    await fixtureTree('acme-orders');

    const model = await scanned();

    expect(model.name).toBe(basename(t.noesis.root));
    expect(model.scanned_at).toBe(NOW);
    // The common prefix is com.acme.orders; its last segment is the root module.
    expect(
      model.modules.map((m): unknown[] => [m.id, m.name, m.source.path]),
    ).toEqual([
      ['module|orders', 'orders', 'orders/src/main/java/com/acme/orders'],
      [
        'module|orders.application',
        'application',
        'orders/src/main/java/com/acme/orders/application',
      ],
      [
        'module|orders.infrastructure',
        'infrastructure',
        'orders/src/main/java/com/acme/orders/infrastructure',
      ],
      [
        'module|orders.infrastructure.persistence',
        'persistence',
        'orders/src/main/java/com/acme/orders/infrastructure/persistence',
      ],
      [
        'module|orders.order',
        'order',
        'orders/src/main/java/com/acme/orders/order',
      ],
    ]);

    // A type without a stereotype (OrdersApplication, PaymentGateway) is no block.
    expect(model.buildingBlocks.map((b): unknown[] => [b.id, b.type])).toEqual([
      [
        'building_block|orders.application.OrderApplicationService',
        'application_service',
      ],
      [
        'building_block|orders.infrastructure.persistence.InMemoryOrderRepository',
        'external_integration',
      ],
      ['building_block|orders.order.Order', 'aggregate'],
      ['building_block|orders.order.OrderId', 'value_object'],
      ['building_block|orders.order.OrderPlaced', 'domain_event'],
      ['building_block|orders.order.OrderRepository', 'external_integration'],
      ['building_block|orders.order.PlaceOrder', 'domain_command'],
    ]);

    const block = (name: string) =>
      model.buildingBlocks.find((b) => b.name === name);
    expect(block('InMemoryOrderRepository')).toMatchObject({
      implements: ['building_block|orders.order.OrderRepository'],
      source: {
        path: 'orders/src/main/java/com/acme/orders/infrastructure/persistence/InMemoryOrderRepository.java',
        line: 3,
      },
    });
    expect<unknown>(block('OrderPlaced')?.properties).toEqual([
      {
        name: 'orderId',
        type: 'building_block|orders.order.OrderId',
        description: null,
        optional: false,
      },
      {
        name: 'item',
        type: 'primitive|string',
        description: null,
        optional: false,
      },
    ]);

    expect(
      model.behaviours.map((b): unknown[] => [
        b.id,
        b.type,
        b.visibility.kind,
        b.input,
        b.output,
      ]),
    ).toEqual([
      [
        'behavior|orders.application.OrderApplicationService.handle',
        'Command',
        'public',
        ['building_block|orders.order.PlaceOrder'],
        [],
      ],
      [
        'behavior|orders.infrastructure.persistence.InMemoryOrderRepository.save',
        'Command',
        'public',
        ['building_block|orders.order.Order'],
        [],
      ],
      [
        'behavior|orders.order.Order.place',
        'Command',
        'public',
        ['primitive|string'],
        ['building_block|orders.order.OrderPlaced'],
      ],
      [
        'behavior|orders.order.OrderRepository.save',
        'Command',
        'public',
        ['building_block|orders.order.Order'],
        [],
      ],
    ]);
    expect(model.behaviours.find((b) => b.name === 'place')).toMatchObject({
      buildingBlockId: 'building_block|orders.order.Order',
      source: {
        path: 'orders/src/main/java/com/acme/orders/order/Order.java',
        line: 6,
      },
    });
    // src/test/ holds an annotated aggregate that must not show up.
    expect(ids(model.buildingBlocks)).not.toContain(
      'building_block|orders.order.OrderInTestNotForScanning',
    );
  });

  it('takes a nested type as a block only when a stereotype names it, in the module of its file', async () => {
    await fixtureTree('nested-stereotype');

    const model = await scanned();

    expect(ids(model.modules)).toEqual(['module|acme']);
    expect(model.buildingBlocks.map((b): unknown[] => [b.id, b.type])).toEqual([
      ['building_block|acme.Placed', 'domain_event'],
    ]);
    expect(model.behaviours).toEqual([]);
  });

  it('pools overloads into one behaviour, reads Javadoc as descriptions, and asks a question with a get/is name', async () => {
    await files({
      'src/main/java/com/acme/shop/Basket.java': `package com.acme.shop;
import vision.noesis.annotations.AggregateRoot;
/** What a customer fills. Then checks out. */
@AggregateRoot
public class Basket {
    /** The coupon, if any. */
    private Option<Coupon> coupon;
    public void add(Product p, int q) {}
    public void add(Product p) {}
    public boolean isEmpty() { return true; }
    public Option<Coupon> getCoupon() { return coupon; }
    void audit() {}
}`,
      'src/main/java/com/acme/shop/Coupon.java': `package com.acme.shop;
@vision.noesis.annotations.ValueObject
public record Coupon(String code) {}`,
      'src/main/java/com/acme/shop/Product.java': `package com.acme.shop;
@vision.noesis.annotations.ValueObject
public record Product(String sku) {}`,
    });

    const model = await scanned();

    expect(model.buildingBlocks.find((b) => b.name === 'Basket')).toMatchObject(
      {
        description: 'What a customer fills.',
        properties: [
          {
            name: 'coupon',
            type: 'building_block|shop.Coupon',
            description: 'The coupon, if any.',
            optional: true,
          },
        ],
      },
    );
    expect(
      model.behaviours.map((b): unknown[] => [
        b.name,
        b.type,
        b.visibility.kind,
        b.input,
        b.output,
      ]),
    ).toEqual([
      [
        'add',
        'Command',
        'public',
        ['building_block|shop.Product', 'primitive|integer'],
        [],
      ],
      ['audit', 'Command', 'private', [], []],
      ['getCoupon', 'Query', 'public', [], ['building_block|shop.Coupon']],
      ['isEmpty', 'Query', 'public', [], ['primitive|boolean']],
    ]);
  });

  it('resolves a simple name to the block in the same module when two modules declare it', async () => {
    await files({
      'src/main/java/com/acme/sales/Order.java': `package com.acme.sales;
@vision.noesis.annotations.AggregateRoot
public class Order { public void ship(Order other) {} }`,
      'src/main/java/com/acme/billing/Order.java': `package com.acme.billing;
@vision.noesis.annotations.DomainEntity
public class Order {}`,
      'src/main/java/com/acme/billing/Invoice.java': `package com.acme.billing;
@vision.noesis.annotations.AggregateRoot
public class Invoice { public void issue(Order order) {} }`,
    });

    const model = await scanned();

    expect(ids(model.modules)).toEqual([
      'module|acme',
      'module|acme.billing',
      'module|acme.sales',
    ]);
    expect(model.behaviours.map((b): unknown[] => [b.id, b.input])).toEqual([
      [
        'behavior|acme.billing.Invoice.issue',
        ['building_block|acme.billing.Order'],
      ],
      ['behavior|acme.sales.Order.ship', ['building_block|acme.sales.Order']],
    ]);
  });
});
