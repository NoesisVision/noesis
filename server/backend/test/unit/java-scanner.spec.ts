import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SystemModelSchema } from '@repo/shared-contracts';
import {
  commonPackagePrefix,
  findSources,
  findUnits,
  javaScanner,
} from '../../src/scanner/languages/java/java-scanner.js';
import {
  packageOf,
  stereotypeOf,
  typesOf,
} from '../../src/scanner/languages/java/java-source.js';
import { ScannerService } from '../../src/scanner/scanner.service.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

let t: TestNoesis;
let scanner: ScannerService;

beforeEach(async () => {
  t = await testNoesis();
  scanner = new ScannerService(t.root, t.systemModelRepository, {
    scanners: [javaScanner],
    now: () => '2026-09-15T12:00:00.000Z',
  });
});

afterEach(() => t.cleanup());

/*
 * Java under test lives in test/fixtures/java as real .java files:
 * `sources/` holds one file per extraction case, the other directories are
 * Maven modules copied whole into the throwaway root.
 */
const FIXTURES = join(import.meta.dir, '..', 'fixtures', 'java');

function javaSource(name: string): Promise<string> {
  return readFile(join(FIXTURES, 'sources', `${name}.java`), 'utf8');
}

/** Copies a fixture tree into the root; the unit layout is the fixture's. */
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

function pom(artifactId: string, parent?: string): string {
  return `<?xml version="1.0"?>
<project>
  <!-- <artifactId>commented-out</artifactId> -->
  ${parent ? `<parent>\n    <groupId>com.acme</groupId>\n    <artifactId>${parent}</artifactId>\n  </parent>` : ''}
  <groupId>com.acme</groupId>
  <artifactId>${artifactId}</artifactId>
  <dependencies>
    <dependency><artifactId>junit</artifactId></dependency>
  </dependencies>
</project>
`;
}

/* ------------------------------------------------------------ extraction */

describe('typesOf', () => {
  it('finds an annotated class, its public methods and their lines, skipping constructors and the Object trio', async () => {
    const source = await javaSource('Order');
    const [order] = typesOf(source);
    expect(order).toMatchObject({
      name: 'Order',
      kind: 'class',
      line: 7,
      topLevel: true,
      annotations: ['AggregateRoot'],
      implements: ['Comparable', 'Serializable'],
    });
    expect(order?.methods).toEqual([
      { name: 'place', line: 16 },
      { name: 'apply', line: 21 },
      { name: 'draft', line: 26 },
    ]);
  });

  it('reads interface members as public unless private, including default and static ones', async () => {
    const source = await javaSource('OrderRepository');
    const [port] = typesOf(source);
    expect(port).toMatchObject({
      name: 'OrderRepository',
      kind: 'interface',
      annotations: ['Port'],
      implements: ['Repository', 'AutoCloseable'],
    });
    expect(port?.methods.map((m) => m.name)).toEqual([
      'save',
      'findById',
      'exists',
      'inMemory',
    ]);
  });

  it('reads records, with their header parameters ignored and compact constructors skipped', async () => {
    const source = await javaSource('Money');
    const [money] = typesOf(source);
    expect(money).toMatchObject({
      name: 'Money',
      kind: 'record',
      line: 4,
      annotations: ['ValueObject'],
      implements: ['Comparable'],
    });
    expect(money?.methods.map((m) => m.name)).toEqual([
      'add',
      'zero',
      'compareTo',
    ]);
  });

  it('reads enums without behaviours', async () => {
    const [status] = typesOf(await javaSource('OrderStatus'));
    expect(status).toMatchObject({ name: 'OrderStatus', kind: 'enum' });
    expect(status?.methods).toEqual([]);
  });

  it('finds nested types, marks them as not top-level and keeps their methods apart from the outer type', async () => {
    const source = await javaSource('OrderWithNestedTypes');
    const found = typesOf(source);
    expect(found.map((f) => [f.name, f.topLevel, f.annotations])).toEqual([
      ['Order', true, []],
      ['Placed', false, ['Event']],
      ['Helper', false, []],
    ]);
    expect(found[0]?.methods.map((m) => m.name)).toEqual(['place', 'cancel']);
    expect(found[1]?.methods.map((m) => m.name)).toEqual(['isRecent']);
    expect(found[2]?.methods.map((m) => m.name)).toEqual(['hidden']);
  });

  it('reads annotations with arguments and qualified names, and ignores annotation type declarations and class literals', async () => {
    const source = await javaSource('JpaOrderRepository');
    const found = typesOf(source);
    expect(found.map((f) => f.name)).toEqual(['JpaOrderRepository']);
    expect(found[0]?.annotations).toEqual([
      'Adapter',
      'SuppressWarnings',
      'Component',
      'Scope',
    ]);
    expect(found[0]?.implements).toEqual(['OrderRepository']);
    expect(found[0]?.methods.map((m) => m.name)).toEqual(['save']);
  });

  it('is not fooled by braces, keywords or declarations inside strings, text blocks and comments', async () => {
    const source = await javaSource('Templates');
    const found = typesOf(source);
    expect(found.map((f) => f.name)).toEqual(['Templates']);
    expect(found[0]?.methods).toEqual([{ name: 'render', line: 13 }]);
  });

  it('does not read fields, initialisers or generic-typed fields as methods', async () => {
    const source = await javaSource('Cache');
    expect(typesOf(source)[0]?.methods.map((m) => m.name)).toEqual(['entries']);
  });

  it('handles several top-level types in one file and a file in the default package', async () => {
    const source = await javaSource('DefaultPackage');
    expect(packageOf(source)).toBeNull();
    expect(typesOf(source).map((f) => [f.name, f.kind, f.topLevel])).toEqual([
      ['A', 'class', true],
      ['B', 'interface', true],
    ]);
  });
});

describe('stereotypeOf', () => {
  it('maps the stereotype annotations onto the contract, first stereotype wins, others are ignored', () => {
    expect(stereotypeOf(['AggregateRoot'])).toBe('aggregate');
    expect(stereotypeOf(['Identifier'])).toBe('value_object');
    expect(stereotypeOf(['Port'])).toBe('external_integration');
    expect(stereotypeOf(['Adapter'])).toBe('external_integration');
    expect(stereotypeOf(['Component', 'Entity', 'Repository'])).toBe('entity');
    expect(stereotypeOf(['Component', 'Override'])).toBeNull();
    expect(stereotypeOf([])).toBeNull();
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

/* ----------------------------------------------------------------- units */

/*
 * Unit detection is about directory layout, not Java syntax, so these two
 * lay their trees out inline: build files of both tools, skipped
 * directories, a nested unit.
 */
describe('findUnits and findSources', () => {
  it('names Maven units by their own artifactId, not the parent or a dependency, and Gradle units by directory', async () => {
    await files({
      'pom.xml': pom('acme-parent'),
      'orders/pom.xml': pom('acme-orders', 'acme-parent'),
      'billing/build.gradle.kts': 'plugins { java }\n',
      'shipping/build.gradle': 'apply plugin: "java"\n',
      'shipping/pom.xml': pom('acme-shipping'),
      'target/classes/pom.xml': pom('not-a-unit'),
      'build/generated/build.gradle': '',
      'node_modules/dep/pom.xml': pom('not-a-unit-either'),
    });

    const units = await findUnits(t.root);
    expect(units.map((u) => [u.name, u.dir.slice(t.root.length)])).toEqual([
      ['acme-parent', ''],
      ['billing', '/billing'],
      ['acme-orders', '/orders'],
      ['acme-shipping', '/shipping'],
    ]);
  });

  it('lists main sources only: no tests, no package-info, no build output, nothing from a nested unit', async () => {
    await files({
      'pom.xml': pom('root'),
      'src/main/java/com/acme/A.java': 'package com.acme; class A {}',
      'src/main/java/com/acme/package-info.java': 'package com.acme;',
      'src/main/java/module-info.java': 'module acme {}',
      'src/test/java/com/acme/ATest.java': 'package com.acme; class ATest {}',
      'target/generated-sources/com/acme/Gen.java': 'class Gen {}',
      'inner/pom.xml': pom('inner'),
      'inner/src/main/java/com/acme/inner/B.java':
        'package com.acme.inner; class B {}',
    });

    const units = await findUnits(t.root);
    const [root, inner] = units;
    expect(root && inner).toBeTruthy();
    if (!root || !inner) return;
    const sources = (await findSources(root, units)).map((s) =>
      s.slice(t.root.length),
    );
    expect(sources).toEqual(['/src/main/java/com/acme/A.java']);
    const innerSources = (await findSources(inner, units)).map((s) =>
      s.slice(t.root.length),
    );
    expect(innerSources).toEqual([
      '/inner/src/main/java/com/acme/inner/B.java',
    ]);
  });
});

/* ------------------------------------------------------------- the model */

describe('ScannerService with the Java scanner', () => {
  it('writes a system model with the unit as bounded context, packages below the common prefix as modules, annotated types as typed blocks', async () => {
    await fixtureTree('acme-orders');

    const report = await scanner.scan();

    expect(
      report.units.map((u) => [u.scanner, u.name, u.buildingBlocks]),
    ).toEqual([['noesis-java', 'acme-orders', 9]]);
    const [stored] = await t.systemModelRepository.list();
    const model = SystemModelSchema.parse(stored?.entity);
    expect(model.name).toBe('acme-orders');
    expect(model.scanned_at).toBe('2026-09-15T12:00:00.000Z');
    expect(model.scanner).toEqual({ name: 'noesis-java', version: '0.1.0' });
    expect(model.boundedContexts).toEqual([
      {
        id: 'bc:acme-orders',
        name: 'acme-orders',
        description: '',
        source: { path: 'orders', line: null },
      },
    ]);
    // The common prefix is com.acme.orders; the segment below it is the module.
    expect(model.domainModules).toEqual([
      {
        id: 'mod:acme-orders/application',
        name: 'application',
        boundedContextId: 'bc:acme-orders',
        description: '',
        source: {
          path: 'orders/src/main/java/com/acme/orders/application',
          line: null,
        },
      },
      {
        id: 'mod:acme-orders/infrastructure',
        name: 'infrastructure',
        boundedContextId: 'bc:acme-orders',
        description: '',
        source: {
          path: 'orders/src/main/java/com/acme/orders/infrastructure',
          line: null,
        },
      },
      {
        id: 'mod:acme-orders/order',
        name: 'order',
        boundedContextId: 'bc:acme-orders',
        description: '',
        source: {
          path: 'orders/src/main/java/com/acme/orders/order',
          line: null,
        },
      },
    ]);

    const byName = new Map(model.buildingBlocks.map((b) => [b.name, b]));
    expect(
      [...byName.values()].map((b) => [b.name, b.type, b.domainModuleId]),
    ).toEqual([
      [
        'OrderApplicationService',
        'application_service',
        'mod:acme-orders/application',
      ],
      [
        'PaymentGateway',
        'external_integration',
        'mod:acme-orders/infrastructure',
      ],
      [
        'InMemoryOrderRepository',
        'external_integration',
        'mod:acme-orders/infrastructure',
      ],
      ['Order', 'aggregate', 'mod:acme-orders/order'],
      ['OrderId', 'value_object', 'mod:acme-orders/order'],
      ['OrderPlaced', 'domain_event', 'mod:acme-orders/order'],
      ['OrderRepository', 'external_integration', 'mod:acme-orders/order'],
      ['PlaceOrder', 'domain_command', 'mod:acme-orders/order'],
      // A type in the prefix package itself belongs to no module.
      ['OrdersModule', null, null],
    ]);

    expect(byName.get('Order')).toMatchObject({
      id: 'bb:orders/src/main/java/com/acme/orders/order/Order.java#Order',
      source: {
        path: 'orders/src/main/java/com/acme/orders/order/Order.java',
        line: 4,
      },
    });
    // `implements` resolves to a block of the unit, by simple name.
    expect(byName.get('InMemoryOrderRepository')?.implements).toEqual([
      'bb:orders/src/main/java/com/acme/orders/order/OrderRepository.java#OrderRepository',
    ]);

    expect(
      model.behaviours.map((b) => [b.name, b.buildingBlockId.split('#')[1]]),
    ).toEqual([
      ['handle', 'OrderApplicationService'],
      ['charge', 'PaymentGateway'],
      ['save', 'InMemoryOrderRepository'],
      ['place', 'Order'],
      ['save', 'OrderRepository'],
    ]);
    expect(model.behaviours.find((b) => b.name === 'place')).toMatchObject({
      id: 'bb:orders/src/main/java/com/acme/orders/order/Order.java#Order.place',
      source: {
        path: 'orders/src/main/java/com/acme/orders/order/Order.java',
        line: 6,
      },
    });
  });

  it('includes a nested type only when a stereotype names it', async () => {
    await fixtureTree('nested-stereotype');
    await scanner.scan();
    const [stored] = await t.systemModelRepository.list();
    const model = SystemModelSchema.parse(stored?.entity);
    expect(model.buildingBlocks.map((b) => [b.name, b.type])).toEqual([
      ['Order', null],
      ['Placed', 'domain_event'],
    ]);
  });

  it('puts every type of a single-package unit directly under the bounded context', async () => {
    await fixtureTree('single-package');
    await scanner.scan();
    const [stored] = await t.systemModelRepository.list();
    const model = SystemModelSchema.parse(stored?.entity);
    expect(model.domainModules).toEqual([]);
    expect(model.buildingBlocks.map((b) => b.domainModuleId)).toEqual([
      null,
      null,
    ]);
  });
});
