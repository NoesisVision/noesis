// The Java parser end to end: the shop fixture declares the `noesis:parse`
// Maven plugin (built and installed from code-parsers/java), and its
// .noesis/settings.json runs it through the java parser, then the system
// model builder. Needs a JDK and Maven. The model must equal the one built of the
// committed code model, which keeps the fixture's committed files honest.
import { beforeAll, describe, expect, it } from 'bun:test';
import { join, resolve } from 'node:path';
import { GitSourceRepository } from '#backend/adapters/out/scanners/git-source-repository';
import { ScannerSettingsFileRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import { systemClock } from '#backend/app/clock';
import {
  CodeModelFile,
  ParseManifest,
} from '#backend/app/scanners/code-parsers/code-model';
import { buildSystemModel } from '#backend/app/scanners/system-model-builders/build-system-model';
import { JAVA_VOCABULARY } from '#backend/app/scanners/system-model-builders/java.vocabulary';
import { SystemModel } from '#backend/app/system-model/system-model';
import { codeParserFor } from '#backend/boot/code-parsers';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import { scannerOver } from '../support/test-scanner';

const REPOSITORY = resolve(import.meta.dir, '../../../..');
const PARSER = join(REPOSITORY, 'code-parsers', 'java');
const FIXTURE = join(import.meta.dir, '..', 'fixtures', 'java', 'shop');

/** Generous: a cold `mvn install` downloads plugins and a cold scan compiles the fixture; ~1 min here. */
const INSTALL_BUDGET_MS = 300_000;
const SCAN_BUDGET_MS = 180_000;

async function run(cmd: string[], cwd: string): Promise<string> {
  const process = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (code !== 0)
    throw new Error(`${cmd.join(' ')} failed (${code}):\n${out}${err}`);
  return out;
}

beforeAll(async () => {
  await run(
    [
      'mvn',
      '-B',
      '-q',
      '-ntp',
      'install',
      '-DskipTests',
      '-Dinvoker.skip=true',
    ],
    PARSER,
  );
}, INSTALL_BUDGET_MS);

describe('test/fixtures/java/shop through the Java parser (e2e)', () => {
  it(
    'scans the build with its own settings and builds the system model within budget',
    async () => {
      const noesis = new NoesisDir(FIXTURE);
      const settings = await new ScannerSettingsFileRepository(
        noesis,
      ).repositorySettings();
      const config = settings.namespaces;
      const scanner = scannerOver(
        noesis,
        codeParserFor(noesis)(settings.parser),
        config,
        systemClock,
        settings.libraries,
      );

      const started = performance.now();
      const model = SystemModel.parse(await scanner.scan());
      const bothStages = performance.now() - started;

      // The system model built of the committed code model: what the unit tests run on.
      const manifest = ParseManifest.parse(
        await Bun.file(
          join(FIXTURE, 'code-model', 'java', 'manifest.json'),
        ).json(),
      );
      const files = await Promise.all(
        manifest.artifacts.map(async ({ file }) =>
          CodeModelFile.parse(await Bun.file(join(FIXTURE, file)).json()),
        ),
      );
      const { model: committed } = buildSystemModel({
        manifest,
        files,
        featureFiles: await new GitSourceRepository(FIXTURE).featureFiles(),
        vocabulary: JAVA_VOCABULARY,
        config,
        libraries: settings.libraries,
      });

      console.log(
        `[e2e] java shop: both stages ${Math.round(bothStages)} ms, ${files.length} artifacts, ${model.buildingBlocks.length} blocks, ${model.behaviors.length} behaviors`,
      );
      expect<unknown>(bothStages).toBeLessThan(SCAN_BUDGET_MS);
      expect<unknown>(model.name).toBe('shop');
      expect<unknown>(model.modules).toEqual(committed.modules);
      expect<unknown>(model.buildingBlocks).toEqual(committed.buildingBlocks);
      expect<unknown>(model.behaviors).toEqual(committed.behaviors);
      expect<unknown>(model.rules).toEqual(committed.rules);
      expect<unknown>(model.scenarios).toEqual(committed.scenarios);
      expect<unknown>(model.rules.map((r) => r.name)).toEqual([
        'Order total',
        'Placing an order',
      ]);
      expect<unknown>(model.deployableUnits).toEqual(committed.deployableUnits);
      expect<unknown>(model.libraries).toEqual(committed.libraries);
      expect<unknown>(model.relations).toEqual(committed.relations);
      // The money API is a real dependency the build resolves and no scan
      // parses; its manifest makes the stubbed currency a block (R14).
      expect<unknown>(model.relations).toContainEqual({
        kind: 'has_state',
        from: 'building_block|shop.orders.Order',
        to: 'building_block|javax.money.Currency',
        name: 'currency',
        cardinality: '1',
      });
      expect<unknown>(
        model.buildingBlocks.find(
          (b) => b.id === 'building_block|shop.orders.PlaceOrder',
        )?.type,
      ).toBe('command');
    },
    SCAN_BUDGET_MS,
  );
});
