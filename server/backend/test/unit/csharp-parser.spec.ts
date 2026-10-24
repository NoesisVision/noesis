import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { CSharpParser } from '#backend/adapters/out/scanner/parsers/csharp-parser';
import { NamespaceConfig } from '#backend/app/scanner/system-model-builder/namespace-config';
import type { Scanner } from '#backend/app/scanner/scanner';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import {
  INVOKES,
  MODULES,
  UNREACHED,
  behaviour as invocation,
} from '../support/csharp-fixture-expectations';
import { fixedClock } from '../support/fixed-clock';
import { scannerOver } from '../support/test-scanner';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

/*
 * The C# parser runs `noesis-parse-csharp`; the scanner builds the system
 * model of what it wrote. Here
 * the tool is a bun script (test/support/fake-parse-csharp.ts) that copies the
 * .NET parser's golden code model of the fixture solution under
 * parsers/dotnet/test/fixtures into `--out`, so the whole chain runs without
 * .NET. The real tool runs over the same fixture in
 * test/e2e-toolchain/csharp-parser.e2e.spec.ts.
 */

const REPOSITORY = join(import.meta.dir, '..', '..', '..', '..');
const FIXTURE = join(REPOSITORY, 'parsers', 'dotnet', 'test', 'fixtures');
const GOLDEN = join(
  REPOSITORY,
  'parsers',
  'dotnet',
  'test',
  'Noesis.Parser.Tests',
  'golden',
);
const FAKE_TOOL = join(
  import.meta.dir,
  '..',
  'support',
  'fake-parse-csharp.ts',
);
const SOURCES = 'parsers/dotnet/test/fixtures/CSharpSyntax/Projection';

let t: TestNoesis;
let scanner: Scanner;

/** The fixture's own namespace settings. */
const FIXTURE_NAMESPACES = NamespaceConfig.of(
  await Bun.file(join(FIXTURE, '.noesis', 'settings.json')).json(),
);

/** A scanner whose parser runs the fake tool with `flags` of its own. */
const scannerWith = (
  flags: string[],
  namespaces: NamespaceConfig = FIXTURE_NAMESPACES,
) =>
  scannerOver(
    t.noesis,
    new CSharpParser({
      noesis: t.noesis,
      command: ['bun', FAKE_TOOL, ...flags],
    }),
    namespaces,
    fixedClock(NOW),
  );

beforeEach(async () => {
  t = await testNoesis();
  scanner = scannerWith(['--golden', GOLDEN]);
});

afterEach(() => t.cleanup());

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
const block = (name: string) => `building_block|Projection.Blocks.${name}`;
const form = (name: string) =>
  `behavior|Projection.Behaviours.BehaviourForms.${name}`;

describe('Scanning through the C# parser', () => {
  it('runs the first stage into a fresh .noesis/tmp/<uuid>/, over the repository root, named after it', async () => {
    const record = join(t.root, 'fake-parse-args.json');
    await scannerWith(['--golden', GOLDEN, '--record', record]).scan();

    const args = (await Bun.file(record).json()) as string[];
    const out = args[args.indexOf('--out') + 1];
    expect<unknown>(args).toEqual([
      '--golden',
      GOLDEN,
      '--record',
      record,
      t.root,
      '--out',
      out,
      '--repository-root',
      t.root,
      '--repository',
      basename(t.root),
      '--cache',
      t.noesis.resolve('cache', 'parser', 'csharp'),
    ]);
    expect<unknown>(out).toMatch(
      new RegExp(`^${t.noesis.resolve('tmp')}/[0-9a-f-]{36}$`),
    );
  });

  it('builds the system model of the code model the parser wrote', async () => {
    const model = SystemModel.parse(await scanner.scan());

    expect<unknown>(SystemModelId.safeParse(model.id).success).toBe(true);
    expect<unknown>(model.name).toBe(basename(t.root));
    expect<unknown>(model.scanned_at).toBe(NOW);

    // CSharpSyntax is skipped by .noesis/settings.json, *.ExcludedNamespace
    // excluded; only namespaces that hold a block become modules.
    expect<unknown>(ids(model.modules)).toEqual(MODULES);
    expect<unknown>(
      model.modules.find((m) => m.id === 'module|Projection.Blocks')?.source,
    ).toEqual({ path: `${SOURCES}/Blocks/BlockKinds.cs`, line: 7 });

    // One block per annotation; nested types get the enclosing type's name
    // first; a name override that is no element name gives way to the code's
    // name; neither the delegate, the unannotated types nor the excluded
    // namespace's block appear.
    expect<unknown>(
      model.buildingBlocks
        .filter((b) => b.id.startsWith('building_block|Projection.Blocks.'))
        .map((b) => [b.id, b.type]),
    ).toEqual([
      [block('AbstractBlock'), 'entity'],
      [block('AggregateBlock'), 'aggregate'],
      [block('AggregateBlock NestedEvent'), 'value_object'],
      [block('AggregateBlock Repository'), 'repository'],
      [block('ApplicationServiceBlock'), 'application_service'],
      [block('CommandBlock'), 'value_object'],
      [block('DomainEventBlock'), 'value_object'],
      [block('DomainServiceBlock'), 'domain_service'],
      [block('EntityBlock'), 'entity'],
      [block('EnumBlock'), 'value_object'],
      [block('EventBlock'), 'value_object'],
      [block('ExternalIntegrationBlock'), 'external_integration'],
      [block('FactoryBlock'), 'factory'],
      [block('GenericRepositoryBlock'), 'repository'],
      [block('ImplementsBlocksAndOthers'), 'entity'],
      [block('NameOverrideIsNoElementName'), 'value_object'],
      [block('Named nested entity'), 'entity'],
      [block('QueryBlock'), 'value_object'],
      [block('ReadModelBlock'), 'value_object'],
      [block('RecordStructBlock'), 'value_object'],
      [block('StructBlock'), 'value_object'],
      [block('ValueObjectBlock'), 'value_object'],
    ]);
    expect<unknown>(ids(model.buildingBlocks)).toContain(
      'building_block|OtherProject.Projection.BlockFromOtherProject',
    );
    expect<unknown>(ids(model.buildingBlocks)).not.toContain(
      'building_block|Projection.ExcludedNamespace.ExcludedBlock',
    );

    const aggregate = model.buildingBlocks.find(
      (b) => b.id === block('AggregateBlock'),
    );
    expect<unknown>(aggregate).toMatchObject({
      description: 'An aggregate with a *short* description.',
      implements: [],
      scenarios: [{ name: 'Aggregate scenario', description: null, steps: [] }],
      source: { path: `${SOURCES}/Blocks/BlockKinds.cs`, line: 10 },
    });
    // Public instance members only; the dictionary and the unannotated
    // interface have no word in the model; the excluded property is dropped.
    expect<unknown>(aggregate?.properties).toEqual([
      {
        name: 'Entities',
        type: { collectionOf: block('EntityBlock') },
        description: 'A collection, backed by a field of the same name.',
        optional: false,
      },
      {
        name: 'OptionalValueObject',
        type: block('ValueObjectBlock'),
        description: null,
        optional: true,
      },
      {
        name: 'OptionalPrimitive',
        type: 'primitive|datetime',
        description: null,
        optional: true,
      },
      {
        name: 'Enum',
        type: block('EnumBlock'),
        description: null,
        optional: false,
      },
    ]);
    // Positional record properties are properties too.
    expect<unknown>(
      model.buildingBlocks.find((b) => b.id === block('CommandBlock'))
        ?.properties,
    ).toEqual([
      {
        name: 'Id',
        type: block('ValueObjectBlock'),
        description: null,
        optional: false,
      },
      {
        name: 'Note',
        type: 'primitive|string',
        description: null,
        optional: true,
      },
    ]);
    expect<unknown>(
      model.buildingBlocks.find((b) => b.id === block('EnumBlock'))?.properties,
    ).toEqual([]);
    // Direct supertypes that are blocks only (R4.4).
    expect<unknown>(
      model.buildingBlocks.find(
        (b) => b.id === block('ImplementsBlocksAndOthers'),
      )?.implements,
    ).toEqual([block('AbstractBlock'), block('ExternalIntegrationBlock')]);

    // Public methods become behaviours: static ones too; not the excluded,
    // technical, non-public ones nor the operator. Overloads collapse into
    // one that the widest stands for; Task<T> is unwrapped, Task is void.
    expect<unknown>(
      model.behaviours
        .filter((b) => b.id.startsWith('behavior|Projection.Behaviours.'))
        .map((b) => [
          b.id,
          b.type,
          b.visibility,
          b.input.map((i) => [i.name, i.type, i.optional]),
          b.output.map((o) => [o.type, o.optional]),
        ]),
    ).toEqual([
      [
        form('ArrayOutput'),
        'Command',
        { kind: 'public', actors: [] },
        [],
        [[{ collectionOf: block('ValueObjectBlock') }, false]],
      ],
      [
        form('CollectionOutput'),
        'Command',
        { kind: 'public', actors: [] },
        [],
        [[{ collectionOf: block('ValueObjectBlock') }, false]],
      ],
      [
        form('EntryPointCommand'),
        'Command',
        { kind: 'public', actors: [] },
        [],
        [],
      ],
      [
        form('EntryPointQuery'),
        'Query',
        { kind: 'public', actors: [] },
        [],
        [[block('ValueObjectBlock'), false]],
      ],
      [
        form('InputWithoutWord'),
        'Command',
        { kind: 'public', actors: [] },
        [],
        [],
      ],
      [
        form('Named behaviour'),
        'Command',
        { kind: 'public', actors: [] },
        [],
        [],
      ],
      [
        form('OptionalInputs'),
        'Command',
        { kind: 'public', actors: [] },
        [
          ['nullable', block('ValueObjectBlock'), true],
          ['withDefault', 'primitive|integer', true],
        ],
        [],
      ],
      [
        form('OptionalOutput'),
        'Command',
        { kind: 'public', actors: [] },
        [],
        [[block('ValueObjectBlock'), true]],
      ],
      [
        form('Overloaded'),
        'Command',
        { kind: 'public', actors: [] },
        [
          ['first', 'primitive|integer', false],
          ['second', 'primitive|integer', false],
        ],
        [],
      ],
      [
        form('StaticFactory'),
        'Command',
        { kind: 'public', actors: [] },
        [],
        [['building_block|Projection.Behaviours.BehaviourForms', false]],
      ],
      [
        form('TaskOutputIsVoid'),
        'Command',
        { kind: 'public', actors: [] },
        [],
        [],
      ],
      [
        form('TaskOutputUnwrapped'),
        'Command',
        { kind: 'public', actors: [] },
        [],
        [[block('ValueObjectBlock'), false]],
      ],
      [
        form('WithActor'),
        'Command',
        { kind: 'public', actors: ['Customer'] },
        [],
        [],
      ],
    ]);
    expect<unknown>(
      model.behaviours.find((b) => b.id === form('Named behaviour')),
    ).toMatchObject({
      description: 'Named by its annotation.',
      scenarios: [{ name: 'Behaviour scenario' }],
      source: { path: `${SOURCES}/Behaviours/BehaviourForms.cs`, line: 23 },
    });
    // An annotated private method is a private behaviour; an explicit
    // interface implementation and a member inherited from a non-block base
    // give the block no behaviour of their own.
    expect<unknown>(
      model.behaviours.find(
        (b) => b.id === invocation('CallChains.Private behaviour'),
      )?.visibility,
    ).toEqual({ kind: 'private' });
    expect<unknown>(ids(model.behaviours)).not.toContain(
      invocation('ExplicitBlockImplementor.Contract'),
    );
    expect<unknown>(ids(model.behaviours)).not.toContain(
      invocation('SatisfiedByBaseMember.Provided'),
    );
  });

  it('derives invokes from the invocation chains of the fixture, by the rules of section 11', async () => {
    const model = SystemModel.parse(await scanner.scan());

    const invocations = model.behaviours.filter(
      (b) =>
        b.id.startsWith('behavior|Projection.Invocations.') &&
        !b.id.startsWith('behavior|Projection.Invocations.Reached.'),
    );
    expect<unknown>(
      Object.fromEntries(invocations.map((b) => [b.id, b.invokes])),
    ).toEqual(INVOKES);

    // The leaves invoke nothing, and some of them nothing reaches.
    const leaves = model.behaviours.filter((b) =>
      b.id.startsWith('behavior|Projection.Invocations.Reached.'),
    );
    expect<unknown>(leaves.length).toBeGreaterThan(40);
    expect<unknown>(leaves.every((b) => b.invokes.length === 0)).toBe(true);
    const reachedByAnyone = new Set<string>(
      model.behaviours.flatMap((b) => b.invokes),
    );
    for (const leaf of UNREACHED) {
      expect<unknown>(ids(leaves)).toContain(leaf);
      expect<unknown>(reachedByAnyone.has(leaf)).toBe(false);
    }
  });

  it('maps every namespace to itself without namespace settings', async () => {
    const model = await scannerWith(
      ['--golden', GOLDEN],
      NamespaceConfig.of({}),
    ).scan();

    expect<unknown>(ids(model.modules)).toEqual([
      'module|CSharpSyntax',
      'module|CSharpSyntax.OtherProject',
      'module|CSharpSyntax.OtherProject.Projection',
      'module|CSharpSyntax.Projection',
      'module|CSharpSyntax.Projection.Behaviours',
      'module|CSharpSyntax.Projection.Blocks',
      'module|CSharpSyntax.Projection.ExcludedNamespace',
      'module|CSharpSyntax.Projection.Invocations',
    ]);
  });

  it('fails with the tool output when the first stage exits with an error', async () => {
    await expect<unknown>(scannerWith(['--fail', '2']).scan()).rejects.toThrow(
      /exit code 2[\s\S]*failing as asked/,
    );
  });

  it('fails when the first stage wrote no manifest', async () => {
    await expect<unknown>(scannerWith([]).scan()).rejects.toThrow(
      'no readable manifest',
    );
  });

  it('fails when the tool is not installed', async () => {
    const missing = scannerOver(
      t.noesis,
      new CSharpParser({
        noesis: t.noesis,
        command: ['noesis-parse-csharp-that-does-not-exist'],
      }),
      FIXTURE_NAMESPACES,
      fixedClock(NOW),
    );

    await expect<unknown>(missing.scan()).rejects.toThrow('Cannot run');
  });

  it('removes its tmp directory after a scan, whether it succeeds or fails', async () => {
    await scanner.scan();
    await expect<unknown>(
      scannerWith(['--fail', '2']).scan(),
    ).rejects.toThrow();
    await expect<unknown>(scannerWith([]).scan()).rejects.toThrow();

    expect<unknown>(await readdir(t.noesis.resolve('tmp'))).toEqual([]);
  });
});
