import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { CSharpParser } from '#backend/adapters/out/scanners/code-parsers/csharp-parser';
import type { Scanner } from '#backend/app/scanners/scanner';
import { NamespaceConfig } from '#backend/app/scanners/system-model-builders/namespace-config';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import {
  INVOKES,
  MODULES,
  UNREACHED,
  behavior as invocation,
} from '../support/csharp-fixture-expectations';
import { trackFeatureFiles } from '../support/feature-files';
import { fixedClock } from '../support/fixed-clock';
import {
  extendsOf,
  inputOf,
  invokedTargetsOf,
  outputOf,
  stateOf,
} from '../support/relations';
import { scannerOver } from '../support/test-scanner';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

/*
 * The C# parser runs `noesis-parse-csharp`; the scanner builds the system
 * model of what it wrote. Here
 * the tool is a bun script (test/support/fake-parse-csharp.ts) that copies the
 * .NET parser's golden code model of the fixture solution under
 * code-parsers/dotnet/test/fixtures into `--out`, so the whole chain runs without
 * .NET. The real tool runs over the same fixture in
 * test/e2e-toolchain/csharp-parser.e2e.spec.ts.
 */

const REPOSITORY = join(import.meta.dir, '..', '..', '..', '..');
const FIXTURE = join(REPOSITORY, 'code-parsers', 'dotnet', 'test', 'fixtures');
const GOLDEN = join(
  REPOSITORY,
  'code-parsers',
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
const SOURCES = 'code-parsers/dotnet/test/fixtures/CSharpSyntax/Projection';

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
  `behavior|Projection.Behaviors.BehaviorForms.${name}`;

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
    ).toEqual({
      path: `${SOURCES}/Blocks/BlockKinds.cs`,
      startLine: 7,
      endLine: 7,
    });

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
      [block('AggregateBlock NestedEvent'), 'event'],
      [block('AggregateBlock Repository'), 'repository'],
      [block('ApplicationServiceBlock'), 'application_service'],
      [block('CommandBlock'), 'command'],
      [block('DomainEventBlock'), 'event'],
      [block('DomainServiceBlock'), 'domain_service'],
      [block('EntityBlock'), 'entity'],
      [block('EnumBlock'), 'value_object'],
      [block('EventBlock'), 'event'],
      [block('ExternalIntegrationBlock'), 'external_integration'],
      [block('FactoryBlock'), 'factory'],
      [block('GenericRepositoryBlock'), 'repository'],
      [block('ImplementsBlocksAndOthers'), 'entity'],
      [block('NameOverrideIsNoElementName'), 'value_object'],
      [block('Named nested entity'), 'entity'],
      [block('QueryBlock'), 'query'],
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
      source: {
        path: `${SOURCES}/Blocks/BlockKinds.cs`,
        startLine: 10,
        endLine: 52,
      },
    });
    expect<unknown>(extendsOf(model, block('AggregateBlock'))).toEqual([]);
    // Public instance members only; the dictionary and the unannotated
    // interface have no word in the model; the excluded property is dropped.
    expect<unknown>(stateOf(model, block('AggregateBlock'))).toEqual([
      ['Entities', block('EntityBlock'), '*'],
      ['Enum', block('EnumBlock'), '1'],
      ['OptionalValueObject', block('ValueObjectBlock'), '0..1'],
      ['OptionalPrimitive', 'primitive|datetime', '0..1'],
    ]);
    // Positional record properties are state too.
    expect<unknown>(stateOf(model, block('CommandBlock'))).toEqual([
      ['Id', block('ValueObjectBlock'), '1'],
      ['Note', 'primitive|string', '0..1'],
    ]);
    expect<unknown>(stateOf(model, block('EnumBlock'))).toEqual([]);
    // Direct supertypes that are blocks only (R4.4).
    expect<unknown>(
      extendsOf(model, block('ImplementsBlocksAndOthers')),
    ).toEqual([block('AbstractBlock'), block('ExternalIntegrationBlock')]);

    // Public methods become behaviors: static ones too; not the excluded,
    // technical, non-public ones nor the operator. Overloads collapse into
    // one that the widest stands for; Task<T> is unwrapped, Task is void.
    expect<unknown>(
      model.behaviors
        .filter((b) => b.id.startsWith('behavior|Projection.Behaviors.'))
        .map((b) => [b.id, inputOf(model, b.id), outputOf(model, b.id)]),
    ).toEqual([
      [form('ArrayOutput'), [], [[block('ValueObjectBlock'), '*']]],
      [form('CollectionOutput'), [], [[block('ValueObjectBlock'), '*']]],
      [form('EntryPointCommand'), [], []],
      [form('EntryPointQuery'), [], [[block('ValueObjectBlock'), '1']]],
      [form('InputWithoutWord'), [], []],
      [form('Named behavior'), [], []],
      [
        form('OptionalInputs'),
        [
          ['nullable', block('ValueObjectBlock'), '0..1'],
          ['withDefault', 'primitive|integer', '0..1'],
        ],
        [],
      ],
      [form('OptionalOutput'), [], [[block('ValueObjectBlock'), '0..1']]],
      [
        form('Overloaded'),
        [
          ['first', 'primitive|integer', '1'],
          ['second', 'primitive|integer', '1'],
        ],
        [],
      ],
      [
        form('StaticFactory'),
        [],
        [['building_block|Projection.Behaviors.BehaviorForms', '1']],
      ],
      [form('TaskOutputIsVoid'), [], []],
      [form('TaskOutputUnwrapped'), [], [[block('ValueObjectBlock'), '1']]],
      [form('WithActor'), [], []],
    ]);
    expect<unknown>(
      model.behaviors.find((b) => b.id === form('Named behavior')),
    ).toMatchObject({
      description: 'Named by its annotation.',
      source: {
        path: `${SOURCES}/Behaviors/BehaviorForms.cs`,
        startLine: 23,
        endLine: 24,
      },
    });
    // R13: each project that declares a block is a deployable unit when it
    // builds an executable, a library otherwise.
    expect<unknown>(ids(model.deployableUnits)).toEqual([
      'deployable_unit|CSharpSyntax',
    ]);
    expect<unknown>(model.deployableUnits[0]?.source).toEqual({
      path: 'code-parsers/dotnet/test/fixtures/CSharpSyntax',
      startLine: null,
      endLine: null,
    });
    // The dots of a project's name are part of it.
    expect<unknown>(ids(model.libraries)).toEqual([
      'library|CSharpSyntax.OtherProject',
    ]);
    // An actor annotation on a behavior names an actor of the model, and
    // nothing on the behavior.
    expect<unknown>(model.actors).toEqual([
      {
        id: 'actor|Customer',
        name: 'Customer',
        description: null,
        source: {
          path: `${SOURCES}/Behaviors/BehaviorForms.cs`,
          startLine: 13,
          endLine: 14,
        },
      },
    ]);
    // An annotated private method is a behavior too; an explicit interface
    // implementation and a member inherited from a non-block base give the
    // block no behavior of their own.
    expect<unknown>(ids(model.behaviors)).toContain(
      invocation('CallChains.Private behavior'),
    );
    expect<unknown>(ids(model.behaviors)).not.toContain(
      invocation('ExplicitBlockImplementor.Contract'),
    );
    expect<unknown>(ids(model.behaviors)).not.toContain(
      invocation('SatisfiedByBaseMember.Provided'),
    );
  });

  it("makes the rules and scenarios of the fixture's feature file, governed by the behaviors its Reqnroll steps invoke", async () => {
    const FEATURE = `${SOURCES}/Rules/behavior-forms.feature`;
    await trackFeatureFiles(t.root, REPOSITORY, [FEATURE]);
    const WIDEST = 'rule|Projection.Behaviors.Overloads take the widest';
    const NAMED = 'rule|Projection.Behaviors.Named behaviors keep their name';

    const model = SystemModel.parse(await scanner.scan());

    expect<unknown>(model.rules).toEqual([
      {
        id: NAMED,
        name: 'Named behaviors keep their name',
        kind: 'post',
        description: null,
        source: { path: FEATURE, startLine: 15, endLine: null },
      },
      {
        id: WIDEST,
        name: 'Overloads take the widest',
        kind: 'validation',
        description:
          'The overload with the most parameters stands for the behavior.',
        source: { path: FEATURE, startLine: 7, endLine: null },
      },
    ]);
    expect<unknown>(model.scenarios).toEqual([
      {
        id: `scenario|${NAMED.slice(5)}.The named behavior runs`,
        name: 'The named behavior runs',
        description: null,
        steps: [
          { kind: 'given', text: 'a behavior form' },
          { kind: 'when', text: 'the named behavior runs' },
          { kind: 'then', text: 'nothing is returned' },
        ],
        source: { path: FEATURE, startLine: 16, endLine: null },
      },
      {
        id: `scenario|${WIDEST.slice(5)}.One argument`,
        name: 'One argument',
        description: null,
        steps: [
          { kind: 'given', text: 'a behavior form' },
          { kind: 'when', text: 'the overloaded behavior runs with 1' },
          { kind: 'then', text: 'nothing is returned' },
        ],
        source: { path: FEATURE, startLine: 10, endLine: null },
      },
    ]);
    expect<unknown>(
      model.relations.filter((r) => r.kind === 'governs'),
    ).toEqual([
      { kind: 'governs', from: form('Named behavior'), to: NAMED },
      { kind: 'governs', from: form('Overloaded'), to: WIDEST },
    ]);
    // The step definitions' class is no building block, its methods no behaviors.
    expect<unknown>(
      ids(model.buildingBlocks).filter((id) => id.includes('Rules')),
    ).toEqual([]);
  });

  it('derives invokes from the invocation chains of the fixture, by the rules of section 11', async () => {
    const model = SystemModel.parse(await scanner.scan());

    const invocations = model.behaviors.filter(
      (b) =>
        b.id.startsWith('behavior|Projection.Invocations.') &&
        !b.id.startsWith('behavior|Projection.Invocations.Reached.'),
    );
    expect<unknown>(
      Object.fromEntries(
        invocations.map((b) => [b.id, invokedTargetsOf(model, b.id)]),
      ),
    ).toEqual(INVOKES);

    // The leaves invoke nothing, and some of them nothing reaches.
    const leaves = model.behaviors.filter((b) =>
      b.id.startsWith('behavior|Projection.Invocations.Reached.'),
    );
    expect<unknown>(leaves.length).toBeGreaterThan(40);
    expect<unknown>(
      leaves.every((b) => invokedTargetsOf(model, b.id).length === 0),
    ).toBe(true);
    const reachedByAnyone = new Set<string>(
      model.relations.flatMap((r) =>
        r.kind === 'behavior_invokes_behavior' ? [r.to] : [],
      ),
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
      'module|CSharpSyntax.Projection.Behaviors',
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
