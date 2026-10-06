import { describe, expect, it } from 'bun:test';
import { parseCSharpSource } from '#backend/adapters/out/scanners/csharp/csharp-source';
import { NamespaceConfig } from '#backend/adapters/out/scanners/csharp/namespace-config';

const methodNamesOf = (source: string, type = 0) =>
  parseCSharpSource(source).types[type]!.methods.map(({ name }) => name);

describe('Reading the namespace of a C# file', () => {
  it('reads a file-scoped namespace and its line', () => {
    const source = `using System;\n\nnamespace MyCompany.ECommerce.Sales.Orders;\n\npublic class Order {}`;

    expect(parseCSharpSource(source).namespace).toEqual({
      name: 'MyCompany.ECommerce.Sales.Orders',
      line: 3,
    });
  });

  it('reads a braced namespace', () => {
    const source = `namespace MyCompany.Foo\n{\n    public class Bar {}\n}`;

    expect(parseCSharpSource(source).namespace?.name).toBe('MyCompany.Foo');
  });

  it('reads the first of several namespaces', () => {
    const source = `namespace First.One;\n\nnamespace Second.Two {}`;

    expect(parseCSharpSource(source).namespace?.name).toBe('First.One');
  });

  it('finds none in a file that declares none', () => {
    expect(parseCSharpSource('public class Loose {}').namespace).toBeNull();
  });
});

describe('Reading the annotated types of a C# file', () => {
  it('types each building block by its attribute, at the line of its name', () => {
    const source = [
      'namespace Sales;',
      '',
      '[DddAggregate]',
      'public class Order {}',
      '',
      '[DddValueObjectAttribute("Money amount")]',
      'public record Money(decimal Value);',
      '',
      '[DddRepository]',
      'public interface OrderRepository {}',
    ].join('\n');

    expect(
      parseCSharpSource(source).types.map(
        ({ buildingBlockType, name, nameOverride, line }) => ({
          buildingBlockType,
          name,
          nameOverride,
          line,
        }),
      ),
    ).toEqual([
      {
        buildingBlockType: 'aggregate',
        name: 'Order',
        nameOverride: null,
        line: 4,
      },
      {
        buildingBlockType: 'value_object',
        name: 'Money',
        nameOverride: 'Money amount',
        line: 7,
      },
      {
        buildingBlockType: 'repository',
        name: 'OrderRepository',
        nameOverride: null,
        line: 10,
      },
    ]);
  });

  it('ignores attributes that name no building block type', () => {
    const source = `
      namespace Sales;

      [DddDomainEvent]
      public record OrderPlaced(Guid Id);

      [DddBoundedContext]
      public class SalesContext {}
    `;

    expect(parseCSharpSource(source).types).toEqual([]);
  });

  it('reads a type whose header has generics and base types', () => {
    const source = `
      namespace Sales;

      [DddAggregate]
      public partial class Order<T> : Aggregate<T>, IEquatable<Order<T>> where T : class
      {
        public void Confirm() { }
      }
    `;

    expect(methodNamesOf(source)).toEqual(['Confirm']);
  });
});

describe('Reading the methods of an annotated type', () => {
  it('reads public methods, each at its line', () => {
    const source = [
      'namespace Sales.Orders;',
      '[DddAggregate]',
      'public class Order',
      '{',
      '  public void Place(ClientId id) { }',
      '  public int Total() => 42;',
      '  public static Item For(ProductAmount p) => new(p);',
      '  private void Internal() { }',
      '}',
    ].join('\n');

    expect(
      parseCSharpSource(source).types[0]!.methods.map(({ name, line }) => ({
        name,
        line,
      })),
    ).toEqual([
      { name: 'Place', line: 5 },
      { name: 'Total', line: 6 },
      { name: 'For', line: 7 },
    ]);
  });

  it('keeps a line right after comments and nested blocks', () => {
    const source = [
      'namespace Sales;',
      '[DddAggregate]',
      'public class Order',
      '{',
      '  /* a comment',
      '     over lines */',
      '  public void Add()',
      '  {',
      '    if (true) { Apply(); } // done',
      '  }',
      '  public void Place() { }',
      '}',
    ].join('\n');

    expect(
      parseCSharpSource(source).types[0]!.methods.map(({ line }) => line),
    ).toEqual([7, 11]);
  });

  it('tells methods giving nothing back from those giving a result', () => {
    const source = `
      namespace Sales;

      [DddRepository]
      public interface Orders
      {
        void Add(Order order);
        Task Save(Order order);
        ValueTask Flush();
        Task<Order> GetBy(OrderId id);
        Order Find(OrderId id);
      }
    `;

    expect(
      parseCSharpSource(source).types[0]!.methods.map(
        ({ name, returnsResult }) => [name, returnsResult],
      ),
    ).toEqual([
      ['Add', false],
      ['Save', false],
      ['Flush', false],
      ['GetBy', true],
      ['Find', true],
    ]);
  });

  it('takes the name from [DomainBehavior] and the actor from [Actor]', () => {
    const source = `
      namespace Sales;

      [DddApplicationService]
      public class OrderApi
      {
        [DomainBehavior("Place Order")]
        [Actor("Customer")]
        public void Place() { }

        [DomainBehaviorAttribute("Cancel Order")]
        [ActorAttribute("Approving Manager")]
        public void Cancel() { }

        [DomainBehavior]
        public void Plain() { }
      }
    `;

    expect(
      parseCSharpSource(source).types[0]!.methods.map(
        ({ name, nameOverride, actor }) => ({ name, nameOverride, actor }),
      ),
    ).toEqual([
      { name: 'Place', nameOverride: 'Place Order', actor: 'Customer' },
      {
        name: 'Cancel',
        nameOverride: 'Cancel Order',
        actor: 'Approving Manager',
      },
      { name: 'Plain', nameOverride: null, actor: null },
    ]);
  });

  it('ignores properties, fields, constructors and nested types', () => {
    const source = `
      namespace Sales;

      [DddAggregate]
      public class Order
      {
        public int Size { get; set; }
        public int Counter = 0;
        public static readonly Regex Pattern = new Regex("a");
        public Order(int x) { }

        public class Item
        {
          public void InnerOnly() { }
        }

        public void OuterMethod() { }
      }
    `;

    expect(methodNamesOf(source)).toEqual(['OuterMethod']);
  });

  it('reads interface members without a public modifier', () => {
    const source = `
      namespace Sales;

      [DddDomainService]
      public interface PriceChangesPolicy
      {
        bool CanChangePrices(int oldQ, int newQ);
        Task<int> GetAsync();
        private void Hidden() { }
      }
    `;

    expect(methodNamesOf(source)).toEqual(['CanChangePrices', 'GetAsync']);
  });

  it('reads one behaviour per method name, not per overload', () => {
    const source = `
      namespace Sales;

      [DddAggregate]
      public class Order
      {
        public void Confirm(Offer offer) { }
        public void Confirm(Offer offer, DateTime until) { }
      }
    `;

    expect(methodNamesOf(source)).toEqual(['Confirm']);
  });

  it('skips System.Object overrides and record-generated members', () => {
    const source = `
      namespace Sales;

      [DddValueObject]
      public record ClientId(Guid Value)
      {
        public override bool Equals(object? other) => false;
        public bool Equals(ClientId other) => true;
        public override int GetHashCode() => 0;
        public override string ToString() => "x";
        public new Type GetType() => typeof(ClientId);
        public void Deconstruct(out Guid v) { v = Value; }
        public bool PrintMembers(StringBuilder sb) => true;
        protected override void Finalize() { }
        public ClientId MemberwiseClone() => this;
        public static ClientId From(Guid g) => new(g);
      }
    `;

    expect(methodNamesOf(source)).toEqual(['From']);
  });

  it('reads none of an enum', () => {
    const source = `
      namespace Sales;

      [DddValueObject]
      public enum Status { Open, Closed }
    `;

    expect(methodNamesOf(source)).toEqual([]);
  });
});

describe('Mapping a namespace to a module path', () => {
  const modulePathOf = (
    namespace: string,
    config: Parameters<typeof NamespaceConfig.of>[0],
  ) => NamespaceConfig.of(config).modulePathOf(namespace);

  it('keeps the namespace when nothing is configured', () => {
    expect(modulePathOf('Foo.Bar', {})).toBe('Foo.Bar');
  });

  it('drops every occurrence of each sequence to skip', () => {
    const namespacePartsToSkip = ['MyCompany.ECommerce', 'RestApi', 'EF'];

    expect(
      modulePathOf('MyCompany.ECommerce.Sales.RestApi.Orders', {
        namespacePartsToSkip,
      }),
    ).toBe('Sales.Orders');
    expect(modulePathOf('Foo.EF.Bar.EF.Baz', { namespacePartsToSkip })).toBe(
      'Foo.Bar.Baz',
    );
    expect(
      modulePathOf('A.MyCompany.ECommerce.B', { namespacePartsToSkip }),
    ).toBe('A.B');
  });

  it('skips only whole parts', () => {
    expect(
      modulePathOf('MyCompany.ECommerceExtra.Foo', {
        namespacePartsToSkip: ['MyCompany.ECommerce'],
      }),
    ).toBe('MyCompany.ECommerceExtra.Foo');
  });

  it('maps a namespace skipped whole to no module', () => {
    expect(
      modulePathOf('MyCompany.ECommerce', {
        namespacePartsToSkip: ['MyCompany.ECommerce'],
      }),
    ).toBeNull();
  });

  it('ignores empty patterns', () => {
    expect(
      modulePathOf('Foo.Bar', {
        namespacePartsToSkip: [''],
        namespacesToExclude: [''],
      }),
    ).toBe('Foo.Bar');
  });

  it('excludes a namespace matching a pattern exactly, not its descendants', () => {
    const namespacesToExclude = ['Foo.Bar'];

    expect(modulePathOf('Foo.Bar', { namespacesToExclude })).toBeNull();
    expect(modulePathOf('Foo.Bar.Baz', { namespacesToExclude })).toBe(
      'Foo.Bar.Baz',
    );
    expect(modulePathOf('FooBar', { namespacesToExclude: ['Foo'] })).toBe(
      'FooBar',
    );
  });

  it('lets a star stand for any number of parts', () => {
    const excluded = (namespace: string, pattern: string) =>
      modulePathOf(namespace, { namespacesToExclude: [pattern] }) === null;

    expect(excluded('Nuke', 'Nuke.*')).toBe(true);
    expect(excluded('Nuke.Foo.Bar', 'Nuke.*')).toBe(true);
    expect(excluded('NukeExtra', 'Nuke.*')).toBe(false);
    expect(excluded('Other.Nuke', 'Nuke.*')).toBe(false);
    expect(excluded('TechnicalStuff', '*.TechnicalStuff.*')).toBe(true);
    expect(excluded('A.TechnicalStuff.Crud.Api', '*.TechnicalStuff.*')).toBe(
      true,
    );
    expect(excluded('A.Sales', '*.TechnicalStuff.*')).toBe(false);
    expect(excluded('A.B.EF', 'A.B.*.EF')).toBe(true);
    expect(excluded('A.B.Sales.Sql.EF', 'A.B.*.EF')).toBe(true);
    expect(excluded('A.B.Sales.EF.Migrations', 'A.B.*.EF')).toBe(false);
  });
});
