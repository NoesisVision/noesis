import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { CSharpSourceCodeScanner } from '#backend/adapters/out/scanners/csharp/csharp.scanner';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let scanner: CSharpSourceCodeScanner;

beforeEach(async () => {
  t = await testNoesis();
  scanner = new CSharpSourceCodeScanner({ noesis: t.noesis, now: () => NOW });
});

afterEach(() => t.cleanup());

async function writeSource(path: string, content: string): Promise<void> {
  const file = join(t.root, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

const ORDER = [
  'namespace MyCompany.Sales.Orders;',
  '',
  '[DddAggregate("Customer order")]',
  'public class Order',
  '{',
  '  [Actor("Customer")]',
  '  public void Place() { }',
  '  public Money Total() => _total;',
  '}',
].join('\n');

describe('Scanning C# code', () => {
  it('finds a module per namespace, a building block per annotated type and a behaviour per public method', async () => {
    await writeSource('src/Orders/Order.cs', ORDER);

    const model = SystemModel.parse(await scanner.scan());

    expect(SystemModelId.safeParse(model.id).success).toBe(true);
    expect(model.name).toBe(basename(t.root));
    expect(model.scanned_at).toBe(NOW);
    expect(model.modules.map(({ id }): string => id)).toEqual([
      'module|MyCompany',
      'module|MyCompany.Sales',
      'module|MyCompany.Sales.Orders',
    ]);
    expect(model.modules[2]!.source).toEqual({
      path: 'src/Orders/Order.cs',
      line: 1,
    });
    expect(model.buildingBlocks).toEqual([
      expect.objectContaining({
        id: 'building_block|MyCompany.Sales.Orders.Customer order',
        name: 'Customer order',
        type: 'aggregate',
        source: { path: 'src/Orders/Order.cs', line: 4 },
      }),
    ]);
    expect(
      model.behaviours.map(({ id, type, visibility, source }) => ({
        id: id as string,
        type,
        visibility,
        line: source.line,
      })),
    ).toEqual([
      {
        id: 'behavior|MyCompany.Sales.Orders.Customer order.Place',
        type: 'Command',
        visibility: { kind: 'public', actors: ['Customer'] },
        line: 7,
      },
      {
        id: 'behavior|MyCompany.Sales.Orders.Customer order.Total',
        type: 'Query',
        visibility: { kind: 'public', actors: [] },
        line: 8,
      },
    ]);
  });

  it('maps namespaces by noesis-config.json', async () => {
    await writeSource(
      'noesis-config.json',
      JSON.stringify({
        namespacePartsToSkip: ['MyCompany'],
        namespacesToExclude: ['*.TechnicalStuff.*'],
      }),
    );
    await writeSource('src/Orders/Order.cs', ORDER);
    await writeSource(
      'src/TechnicalStuff/Clock.cs',
      'namespace MyCompany.TechnicalStuff;\n[DddDomainService]\npublic class Clock {}',
    );

    const model = await scanner.scan();

    expect(model.modules.map(({ id }): string => id)).toEqual([
      'module|Sales',
      'module|Sales.Orders',
    ]);
    expect(model.buildingBlocks.map(({ id }): string => id)).toEqual([
      'building_block|Sales.Orders.Customer order',
    ]);
  });

  it('skips hidden directories, build output and files without a namespace', async () => {
    await writeSource('.noesis/Hidden.cs', ORDER);
    await writeSource('src/bin/Debug/Order.cs', ORDER);
    await writeSource('src/obj/Order.cs', ORDER);
    await writeSource('src/Loose.cs', '[DddAggregate]\npublic class Loose {}');

    const model = await scanner.scan();

    expect(model.modules).toEqual([]);
    expect(model.buildingBlocks).toEqual([]);
  });

  it('keeps the first of two building blocks with one id, in path order', async () => {
    await writeSource('b/Order.cs', ORDER);
    await writeSource('a/Order.cs', ORDER);

    const model = await scanner.scan();

    expect(model.buildingBlocks.map(({ source }) => source.path)).toEqual([
      'a/Order.cs',
    ]);
    expect(model.behaviours).toHaveLength(2);
  });

  it('falls back to the code name when an override is no element name', async () => {
    await writeSource(
      'Order.cs',
      'namespace Sales;\n[DddAggregate("Sales.Order")]\npublic class Order {}',
    );

    const model = await scanner.scan();

    expect(model.buildingBlocks.map(({ id }): string => id)).toEqual([
      'building_block|Sales.Order',
    ]);
  });

  it('fails on a noesis-config.json of the wrong shape', async () => {
    await writeSource(
      'noesis-config.json',
      JSON.stringify({ namespacePartsToSkip: 'MyCompany' }),
    );

    await expect(scanner.scan()).rejects.toThrow('Invalid noesis-config.json');
  });
});
