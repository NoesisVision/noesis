import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  blankAnnotationArguments,
  blankOut,
  javadocBefore,
  type JavaType,
  parametersOf,
  parseJavaSource,
  stereotypeOf,
} from '#backend/adapters/out/scanners/java/java-source';

/*
 * Java under test lives in test/fixtures/java/sources as real .java files,
 * one per extraction case, so an editor highlights them and a reader sees
 * the trap each one sets.
 */
const SOURCES = join(import.meta.dir, '..', 'fixtures', 'java', 'sources');

async function types(name: string): Promise<JavaType[]> {
  const content = await readFile(join(SOURCES, `${name}.java`), 'utf8');
  return parseJavaSource(content).types;
}

const names = (items: { name: string }[]) => items.map((item) => item.name);
const lines = (items: { name: string; line: number }[]) =>
  items.map((item) => [item.name, item.line]);

describe('parseJavaSource', () => {
  it('reads the package, or null in the default package', async () => {
    expect(
      parseJavaSource('package com.acme.orders;\nclass A {}').package,
    ).toBe('com.acme.orders');
    expect(parseJavaSource('class A {}').package).toBeNull();
  });

  it('finds an annotated class with its supertypes, fields, non-private methods and their lines, skipping constructors and the Object trio', async () => {
    const [order] = await types('Order');
    expect(order).toMatchObject({
      name: 'Order',
      kind: 'class',
      line: 7,
      topLevel: true,
      isPublic: true,
      stereotype: 'aggregate',
      supertypes: ['Comparable', 'Serializable'],
      javadoc: 'An order.',
    });
    expect(lines(order?.fields ?? [])).toEqual([
      ['id', 9],
      ['lines', 10],
    ]);
    expect(lines(order?.methods ?? [])).toEqual([
      ['place', 16],
      ['apply', 21],
      ['draft', 26],
      ['audit', 30],
      ['packagePrivate', 32],
    ]);
    expect(
      order?.methods.map((m) => [m.name, m.isPublic, m.returnType]),
    ).toEqual([
      ['place', true, 'OrderPlaced'],
      ['apply', true, 'T'],
      ['draft', true, 'Order'],
      ['audit', false, 'void'],
      ['packagePrivate', false, 'void'],
    ]);
  });

  it('reads interface members as public unless private, including default and static ones, and no fields', async () => {
    const [port] = await types('OrderRepository');
    expect(port).toMatchObject({
      name: 'OrderRepository',
      kind: 'interface',
      stereotype: 'external_integration',
      supertypes: ['Repository', 'AutoCloseable'],
      fields: [],
    });
    expect(
      port?.methods.map((m) => [m.name, m.isPublic, m.returnType]),
    ).toEqual([
      ['save', true, 'void'],
      ['findById', true, 'Optional<Order>'],
      ['exists', true, 'boolean'],
      ['inMemory', true, 'OrderRepository'],
    ]);
  });

  it('reads a record with its header components as fields and its compact constructor skipped', async () => {
    const [money] = await types('Money');
    expect(money).toMatchObject({
      name: 'Money',
      kind: 'record',
      line: 4,
      stereotype: 'value_object',
      supertypes: ['Comparable'],
    });
    expect(money?.fields.map((f) => [f.name, f.type, f.line])).toEqual([
      ['amount', 'BigDecimal', 4],
      ['currency', 'Currency', 4],
    ]);
    expect(names(money?.methods ?? [])).toEqual(['add', 'zero', 'compareTo']);
  });

  it('reads enums without fields or behaviours', async () => {
    const [status] = await types('OrderStatus');
    expect(status).toMatchObject({
      name: 'OrderStatus',
      kind: 'enum',
      fields: [],
      methods: [],
    });
  });

  it('finds nested types, marks them as not top-level and keeps their members apart from the outer type', async () => {
    const found = await types('OrderWithNestedTypes');
    expect(found.map((f) => [f.name, f.topLevel, f.stereotype])).toEqual([
      ['Order', true, null],
      ['Placed', false, 'value_object'],
      ['Helper', false, null],
    ]);
    expect(names(found[0]?.methods ?? [])).toEqual(['place', 'cancel']);
    expect(names(found[1]?.methods ?? [])).toEqual(['isRecent']);
    expect(names(found[2]?.methods ?? [])).toEqual(['hidden']);
  });

  it('reads annotations with arguments and qualified names, and ignores annotation type declarations and class literals', async () => {
    const found = await types('JpaOrderRepository');
    expect(names(found)).toEqual(['JpaOrderRepository']);
    expect(found[0]).toMatchObject({
      stereotype: 'external_integration',
      supertypes: ['JpaBase', 'OrderRepository'],
      fields: [],
    });
    expect(names(found[0]?.methods ?? [])).toEqual(['save']);
  });

  it('is not fooled by braces, keywords or declarations inside strings, text blocks and comments', async () => {
    const found = await types('Templates');
    expect(names(found)).toEqual(['Templates']);
    expect(found[0]?.fields).toEqual([]);
    expect(lines(found[0]?.methods ?? [])).toEqual([['render', 13]]);
  });

  it('keeps generic-typed and array fields apart from methods, and leaves static fields and initialisers out', async () => {
    const [cache] = await types('Cache');
    expect(cache?.fields.map((f) => [f.name, f.type])).toEqual([
      ['entries', 'Map<String, List<Integer>>'],
      ['sizes', 'int[]'],
    ]);
    expect(cache?.methods.map((m) => [m.name, m.returnType])).toEqual([
      ['entries', 'Map<String, List<Integer>>'],
    ]);
  });

  it('handles several top-level types in one file', async () => {
    const found = await types('DefaultPackage');
    expect(found.map((f) => [f.name, f.kind, f.topLevel, f.isPublic])).toEqual([
      ['A', 'class', true, false],
      ['B', 'interface', true, false],
    ]);
  });

  it('reads Javadoc first sentences, parameter types, overloads and a foreign @Entity as no stereotype', async () => {
    const [basket, line] = await types('Documented');
    expect(basket).toMatchObject({
      name: 'Basket',
      line: 16,
      stereotype: 'aggregate',
      supertypes: ['AbstractBasket', 'Comparable', 'Serializable'],
      javadoc: 'A basket a customer fills before checking out.',
    });
    expect(basket?.fields.map((f) => [f.name, f.type, f.javadoc])).toEqual([
      ['owner', 'CustomerId', 'Who fills the basket.'],
      ['lines', 'List<Line>', null],
      ['coupon', 'Option<Coupon>', null],
      ['counters', 'Map<String, Integer>', null],
      ['tags', 'String[]', null],
      ['packagePrivateCount', 'int', null],
    ]);
    expect(
      basket?.methods.map((m) => [
        m.name,
        m.parameters.map((p) => p.type),
        m.javadoc,
      ]),
    ).toEqual([
      [
        'add',
        ['Product', 'int'],
        'Adds a line; the same product twice merges into one line.',
      ],
      ['add', ['Product'], null],
      ['findLine', ['ProductId'], null],
      ['isEmpty', [], null],
      ['total', [], null],
      ['apply', ['T', 'String...'], null],
      ['audit', [], null],
      ['recompute', [], null],
      ['empty', ['CustomerId'], null],
      ['compareTo', ['Basket'], null],
    ]);
    expect(line).toMatchObject({
      name: 'Line',
      kind: 'record',
      line: 62,
      isPublic: false,
      stereotype: 'value_object',
      javadoc: 'A line of the basket.',
    });
  });
});

describe('stereotypeOf', () => {
  it('maps the stereotype annotations onto the model, first stereotype wins, others are ignored', () => {
    expect(stereotypeOf(['AggregateRoot'])).toBe('aggregate');
    expect(stereotypeOf(['Identifier'])).toBe('value_object');
    expect(stereotypeOf(['ExternalIntegration'])).toBe('external_integration');
    expect(stereotypeOf(['Adapter'])).toBe('external_integration');
    expect(stereotypeOf(['Component', 'DomainEntity', 'Repository'])).toBe(
      'entity',
    );
    expect(stereotypeOf(['Component', 'Override'])).toBeNull();
    expect(stereotypeOf([])).toBeNull();
  });

  it('takes a simple name for a foreign annotation when an import binds it elsewhere, and a qualified Noesis name always', () => {
    const foreign = new Set(['Repository']);
    expect(stereotypeOf(['Repository'], foreign)).toBeNull();
    expect(
      stereotypeOf(['vision.noesis.annotations.Repository'], foreign),
    ).toBe('repository');
    expect(
      stereotypeOf(['org.springframework.stereotype.Repository']),
    ).toBeNull();
  });
});

describe('blanking', () => {
  it('replaces comments and literals with spaces of the same length, keeping newlines', () => {
    const content = 'a // c\n"s\\"t" /* x\ny */ \'q\' """t\nb""" z';
    const blanked = blankOut(content);
    expect(blanked).toHaveLength(content.length);
    expect(blanked.split('\n')).toHaveLength(content.split('\n').length);
    expect(blanked.replace(/\s+/g, ' ').trim()).toBe('a z');
  });

  it('blanks annotation arguments however deeply they nest, keeping the name', () => {
    const text =
      '@Port(Direction.SECONDARY) @Component(value = @Scope("x")) class A';
    expect(blankAnnotationArguments(text).replace(/\s+/g, ' ')).toBe(
      '@Port @Component class A',
    );
  });
});

describe('parametersOf', () => {
  it('drops final and annotations, keeps names, generics and varargs whole', () => {
    expect(
      parametersOf(
        'final Map<String, List<Integer>> counters, @Valid Order order, String... rest',
      ),
    ).toEqual([
      { name: 'counters', type: 'Map<String, List<Integer>>' },
      { name: 'order', type: 'Order' },
      { name: 'rest', type: 'String...' },
    ]);
    expect(parametersOf('')).toEqual([]);
  });
});

describe('javadocBefore', () => {
  it('is the first sentence of the Javadoc ending right before the offset, tags left out', () => {
    const content = '/**\n * First. Second.\n * @param x\n */\n  class A';
    expect(javadocBefore(content, content.indexOf('class'))).toBe('First.');
  });

  it('is null for a plain comment, a Javadoc further away, or none', () => {
    expect(javadocBefore('/* no */ class A', 9)).toBeNull();
    const far = '/** far */\nint x;\nclass A';
    expect(javadocBefore(far, far.indexOf('class'))).toBeNull();
    expect(javadocBefore('class A', 0)).toBeNull();
  });
});
