import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
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
  it('finds an annotated class, its public methods and their lines, skipping constructors and the Object trio', () => {
    const source = `package com.acme.orders;

import vision.noesis.annotations.AggregateRoot;

/** An order. { not a brace that counts } */
@AggregateRoot
public class Order implements Comparable<Order>, Serializable {

    private final OrderId id;
    private final List<OrderLine> lines = new ArrayList<>();

    public Order(OrderId id) {
        this.id = id;
    }

    public OrderPlaced place(String item) {
        // place() is a behaviour; this comment's "}" is not
        return new OrderPlaced(id, item);
    }

    public <T extends Discount> T apply(T discount) throws DiscountRejected {
        if (discount == null) { throw new DiscountRejected("}"); }
        return discount;
    }

    public static Order draft() {
        return new Order(OrderId.next());
    }

    protected void audit() {}
    private void recompute() {}
    void packagePrivate() {}

    @Override
    public boolean equals(Object other) { return false; }
    @Override
    public int hashCode() { return 0; }
    @Override
    public String toString() { return ""; }
}
`;
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

  it('reads interface members as public unless private, including default and static ones', () => {
    const source = `package com.acme.orders;

@Port(Direction.SECONDARY)
public interface OrderRepository extends Repository<Order, OrderId>, AutoCloseable {
    void save(Order order);
    Optional<Order> findById(OrderId id);
    default boolean exists(OrderId id) { return findById(id).isPresent(); }
    static OrderRepository inMemory() { return new InMemoryOrderRepository(); }
    private void helper() {}
}
`;
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

  it('reads records, with their header parameters ignored and compact constructors skipped', () => {
    const source = `package com.acme.orders;

@ValueObject
public record Money(BigDecimal amount, Currency currency) implements Comparable<Money> {
    public Money {
        Objects.requireNonNull(amount);
    }
    public Money add(Money other) { return new Money(amount.add(other.amount), currency); }
    public static Money zero(Currency currency) { return new Money(BigDecimal.ZERO, currency); }
    @Override public int compareTo(Money other) { return amount.compareTo(other.amount); }
}
`;
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

  it('reads enums without behaviours', () => {
    const [status] = typesOf(`package com.acme;
public enum OrderStatus {
    NEW, PAID { public boolean isFinal() { return true; } };
    public boolean isFinal() { return false; }
}
`);
    expect(status).toMatchObject({ name: 'OrderStatus', kind: 'enum' });
    expect(status?.methods).toEqual([]);
  });

  it('finds nested types, marks them as not top-level and keeps their methods apart from the outer type', () => {
    const source = `package com.acme.orders;

public class Order {
    public void place() {}

    @Event
    public record Placed(OrderId id) {
        public boolean isRecent() { return true; }
    }

    private static class Helper {
        public void hidden() {}
    }

    public void cancel() {}
}
`;
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

  it('reads annotations with arguments and qualified names, and ignores annotation type declarations and class literals', () => {
    const source = `package com.acme;

@vision.noesis.annotations.Adapter(Direction.SECONDARY)
@SuppressWarnings({"unchecked", "class interface enum"})
@Component(value = "orders", scope = @Scope("singleton"))
public final class JpaOrderRepository extends JpaBase implements OrderRepository {
    private static final Class<?> TYPE = Order.class;
    public @interface Marker {}
    public void save(Order order) {}
}
`;
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

  it('is not fooled by braces, keywords or declarations inside strings, text blocks and comments', () => {
    const source = `package com.acme;

// public class Commented {}
/* public class BlockCommented { public void nope() {} } */
public class Templates {
    private static final String OPEN = "{";
    private static final char CLOSE = '}';
    private static final String SNIPPET = """
        public class InText {
            public void nope() {}
        }
        """;
    public String render() { return OPEN + "\\"}" + CLOSE; }
}
`;
    const found = typesOf(source);
    expect(found.map((f) => f.name)).toEqual(['Templates']);
    expect(found[0]?.methods).toEqual([{ name: 'render', line: 13 }]);
  });

  it('does not read fields, initialisers or generic-typed fields as methods', () => {
    const source = `package com.acme;
public class Cache {
    public final Map<String, List<Integer>> entries = new HashMap<>();
    public int[] sizes = { 1, 2 };
    public static int count;
    static { count = 0; }
    { entries.clear(); }
    public Map<String, List<Integer>> entries() { return entries; }
}
`;
    expect(typesOf(source)[0]?.methods.map((m) => m.name)).toEqual(['entries']);
  });

  it('handles several top-level types in one file and a file in the default package', () => {
    const source = `class A { public void a() {} }
interface B { void b(); }
`;
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
    await files({
      'orders/pom.xml': pom('acme-orders'),
      'orders/src/main/java/com/acme/orders/OrdersModule.java': `package com.acme.orders;
public class OrdersModule {}
`,
      'orders/src/main/java/com/acme/orders/order/Order.java': `package com.acme.orders.order;
import vision.noesis.annotations.AggregateRoot;
@AggregateRoot
public class Order {
    public Order(OrderId id) {}
    public OrderPlaced place(String item) { return null; }
}
`,
      'orders/src/main/java/com/acme/orders/order/OrderId.java': `package com.acme.orders.order;
@Identifier
public record OrderId(String value) {}
`,
      'orders/src/main/java/com/acme/orders/order/OrderPlaced.java': `package com.acme.orders.order;
@Event
public record OrderPlaced(OrderId orderId, String item) {}
`,
      'orders/src/main/java/com/acme/orders/order/PlaceOrder.java': `package com.acme.orders.order;
@Command
public record PlaceOrder(String item) {}
`,
      'orders/src/main/java/com/acme/orders/order/OrderRepository.java': `package com.acme.orders.order;
@Port(Direction.SECONDARY)
public interface OrderRepository {
    void save(Order order);
}
`,
      'orders/src/main/java/com/acme/orders/application/OrderApplicationService.java': `package com.acme.orders.application;
@ApplicationService
public class OrderApplicationService {
    public void handle(PlaceOrder command) {}
}
`,
      'orders/src/main/java/com/acme/orders/infrastructure/persistence/InMemoryOrderRepository.java': `package com.acme.orders.infrastructure.persistence;
@Adapter(Direction.SECONDARY)
public class InMemoryOrderRepository implements OrderRepository {
    @Override
    public void save(Order order) {}
}
`,
      'orders/src/main/java/com/acme/orders/infrastructure/PaymentGateway.java': `package com.acme.orders.infrastructure;
public class PaymentGateway {
    public void charge(Money amount) {}
}
`,
      'orders/src/test/java/com/acme/orders/order/OrderTest.java': `package com.acme.orders.order;
@AggregateRoot
public class OrderTest { public void notScanned() {} }
`,
    });

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
      // A type in the prefix package itself belongs to no module.
      ['OrdersModule', null, null],
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
    await files({
      'pom.xml': pom('acme'),
      'src/main/java/com/acme/Order.java': `package com.acme;
public class Order {
    @Event
    public record Placed(String id) {}
    public static class Builder { public Order build() { return null; } }
}
`,
    });
    await scanner.scan();
    const [stored] = await t.systemModelRepository.list();
    const model = SystemModelSchema.parse(stored?.entity);
    expect(model.buildingBlocks.map((b) => [b.name, b.type])).toEqual([
      ['Order', null],
      ['Placed', 'domain_event'],
    ]);
  });

  it('puts every type of a single-package unit directly under the bounded context', async () => {
    await files({
      'pom.xml': pom('acme'),
      'src/main/java/com/acme/A.java': 'package com.acme; public class A {}',
      'src/main/java/com/acme/B.java': 'package com.acme; public class B {}',
    });
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
