// The C# parser end to end: the real `noesis-parse-csharp` (built from
// parsers/dotnet) over the fixture solution under parsers/dotnet/test/fixtures,
// then the system model builder. Needs the .NET SDK. Besides the model, the test measures
// both stages against a budget, so a performance regression in either fails
// here and the timings are printed for the record.
import { beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CSharpParser } from '#backend/adapters/out/scanner/parsers/csharp-parser';
import { ScannerSettingsFileRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import { systemClock } from '#backend/app/clock';
import {
  CodeModelFile,
  ParseManifest,
} from '#backend/app/scanner/code-model/code-model';
import { buildSystemModel } from '#backend/app/scanner/code-model/system-model-builder/build-system-model';
import { CSHARP_VOCABULARY } from '#backend/app/scanner/code-model/system-model-builder/csharp.vocabulary';
import { SystemModel } from '#backend/app/scanner/system-model/system-model';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import {
  INVOKES,
  MODULES,
  UNREACHED,
} from '../support/csharp-fixture-expectations';
import { scannerOver } from '../support/test-scanner';

const REPOSITORY = resolve(import.meta.dir, '../../../..');
const FIXTURE = join(REPOSITORY, 'parsers', 'dotnet', 'test', 'fixtures');
const CLI_PROJECT = join(
  REPOSITORY,
  'parsers',
  'dotnet',
  'src',
  'Noesis.Parser.Cli',
);

/** Generous: the first stage restores packages and loads MSBuild; a cold run takes ~20 s here. */
const FIRST_STAGE_BUDGET_MS = 180_000;
/** The builder is in-memory over a few thousand nodes; it takes ~10 ms here. */
const BUILD_BUDGET_MS = 2_000;

let command: string[];

async function run(
  cmd: string[],
  cwd: string,
): Promise<{ out: string; err: string }> {
  const process = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (code !== 0)
    throw new Error(`${cmd.join(' ')} failed (${code}):\n${out}${err}`);
  return { out, err };
}

beforeAll(async () => {
  await run(
    [
      'dotnet',
      'build',
      CLI_PROJECT,
      '-c',
      'Release',
      '-v',
      'quiet',
      '--nologo',
    ],
    REPOSITORY,
  );
  const binaries = join(CLI_PROJECT, 'bin', 'Release');
  const [framework] = await readdir(binaries);
  if (framework === undefined)
    throw new Error(`nothing built under ${binaries}`);
  command = ['dotnet', join(binaries, framework, 'noesis-parse-csharp.dll')];
}, FIRST_STAGE_BUDGET_MS);

describe('the fixture solution through the C# parser (e2e)', () => {
  it(
    'scans the solution with noesis-parse-csharp and builds the system model within budget',
    async () => {
      const noesis = new NoesisDir(FIXTURE);
      const { namespaces: config } = await new ScannerSettingsFileRepository(
        noesis,
      ).repositorySettings();
      const scanner = scannerOver(
        noesis,
        new CSharpParser({ noesis, command }),
        config,
        systemClock,
      );

      // The first stage alone, into a directory of the test's own: the
      // scanner removes its tmp directory once it has read it.
      const outDir = await mkdtemp(join(tmpdir(), 'noesis-e2e-csharp-'));
      let manifest: ParseManifest;
      let files: CodeModelFile[];
      let firstStage: number;
      try {
        const firstStart = performance.now();
        await run(
          [...command, FIXTURE, '--out', outDir, '--repository-root', FIXTURE],
          FIXTURE,
        );
        firstStage = performance.now() - firstStart;
        manifest = ParseManifest.parse(
          await Bun.file(
            join(outDir, 'code-model', 'csharp', 'manifest.json'),
          ).json(),
        );
        files = await Promise.all(
          manifest.artifacts.map(async ({ file }) =>
            CodeModelFile.parse(await Bun.file(join(outDir, file)).json()),
          ),
        );

        // The cache: the first run with --cache fills it, the second reuses
        // every model and writes the same files.
        const cacheDir = join(outDir, 'cache');
        const cached = [
          ...command,
          FIXTURE,
          '--out',
          outDir,
          '--repository-root',
          FIXTURE,
          '--cache',
          cacheDir,
        ];
        const filled = await run(cached, FIXTURE);
        expect<unknown>(filled.err).toContain('Cache: 0 of 2 model(s) reused');
        const reused = await run(cached, FIXTURE);
        expect<unknown>(reused.err).toContain('Cache: 2 of 2 model(s) reused');
        for (const { file } of manifest.artifacts) {
          expect<unknown>(
            CodeModelFile.parse(await Bun.file(join(outDir, file)).json()),
          ).toEqual(
            files[manifest.artifacts.findIndex((a) => a.file === file)],
          );
        }
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
      const buildStart = performance.now();
      const { model: built } = buildSystemModel({
        manifest,
        files,
        vocabulary: CSHARP_VOCABULARY,
        config,
      });
      const building = performance.now() - buildStart;

      // Both stages through the scanner, which leaves no tmp directory behind.
      const model = SystemModel.parse(await scanner.scan());
      expect<unknown>(await readdir(noesis.resolve('tmp'))).toEqual([]);

      console.log(
        `[e2e] fixture: first stage ${Math.round(firstStage)} ms, builder alone ${building.toFixed(1)} ms, ${files.length} artifacts, ${model.buildingBlocks.length} blocks, ${model.behaviours.length} behaviours`,
      );
      expect<unknown>(firstStage).toBeLessThan(FIRST_STAGE_BUDGET_MS);
      expect<unknown>(building).toBeLessThan(BUILD_BUDGET_MS);
      expect<unknown>(built.buildingBlocks).toEqual(model.buildingBlocks);

      // What the real scan gives the builder, by the rules; the unit test
      // over the golden model checks the same expectations in full.
      expect<unknown>(model.name).toBe('fixtures');
      expect<unknown>(manifest.artifacts.map((a) => a.id)).toEqual([
        'A:CSharpSyntax.OtherProject',
        'A:CSharpSyntax',
      ]);
      expect<unknown>(model.modules.map((m) => m.id)).toEqual(MODULES);

      const block = (id: string) =>
        model.buildingBlocks.find((b) => b.id === id);
      expect<unknown>(
        block('building_block|Projection.Blocks.AggregateBlock'),
      ).toMatchObject({
        type: 'aggregate',
        description: 'An aggregate with a *short* description.',
        source: { path: 'CSharpSyntax/Projection/Blocks/BlockKinds.cs' },
      });
      expect<unknown>(
        block('building_block|Projection.Invocations.ImplementsTwoContracts')
          ?.implements,
      ).toEqual([
        'building_block|Projection.Invocations.FirstContract',
        'building_block|Projection.Invocations.SecondContract',
      ]);

      const invocations = model.behaviours.filter(
        (b) =>
          b.id.startsWith('behavior|Projection.Invocations.') &&
          !b.id.startsWith('behavior|Projection.Invocations.Reached.'),
      );
      expect<unknown>(
        Object.fromEntries(invocations.map((b) => [b.id, b.invokes])),
      ).toEqual(INVOKES);
      const reachedByAnyone = new Set<string>(
        model.behaviours.flatMap((b) => b.invokes),
      );
      for (const leaf of UNREACHED)
        expect<unknown>(reachedByAnyone.has(leaf)).toBe(false);
      expect<unknown>(model.behaviours.map((b) => b.name)).not.toContain(
        'ToString',
      );
      expect<unknown>(model.behaviours.map((b) => b.name)).not.toContain(
        'Equals',
      );
    },
    FIRST_STAGE_BUDGET_MS + BUILD_BUDGET_MS,
  );
});
