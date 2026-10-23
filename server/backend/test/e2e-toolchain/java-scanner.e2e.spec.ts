// The Java scanner end to end: the shop fixture declares the `noesis:scan`
// Maven plugin (built and installed from scanners/java), and its
// .noesis/settings.json runs it through the code-model scanner, then the
// projection. Needs a JDK and Maven. The model must equal the projection of the committed
// code model, which keeps the fixture's committed files honest.
import { beforeAll, describe, expect, it } from 'bun:test';
import { join, resolve } from 'node:path';
import { ScannerSettingsFileRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import {
  CodeModelFile,
  ScanManifest,
} from '#backend/app/code-model/code-model';
import { JAVA_VOCABULARY } from '#backend/app/code-model/projection/java.vocabulary';
import { projectSystemModel } from '#backend/app/code-model/projection/project-system-model';
import { SystemModel } from '#backend/app/system-model/system-model';
import { scannerBuilders } from '#backend/boot/scanners';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

const REPOSITORY = resolve(import.meta.dir, '../../../..');
const SCANNER = join(REPOSITORY, 'scanners', 'java');
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
    SCANNER,
  );
}, INSTALL_BUDGET_MS);

describe('test/fixtures/java/shop through the Java scanner (e2e)', () => {
  it(
    'scans the build with its own settings and projects the system model within budget',
    async () => {
      const noesis = new NoesisDir(FIXTURE);
      const settings = await new ScannerSettingsFileRepository(
        noesis,
      ).repositorySettings();
      const config = settings.namespaces;
      const scanner = scannerBuilders(noesis, () => new Date().toISOString())[
        'code-model'
      ](settings);

      const started = performance.now();
      const model = SystemModel.parse(await scanner.scan());
      const bothStages = performance.now() - started;

      // The committed code model, projected: what the unit tests run on.
      const manifest = ScanManifest.parse(
        await Bun.file(
          join(FIXTURE, 'code-model', 'java', 'manifest.json'),
        ).json(),
      );
      const files = await Promise.all(
        manifest.artifacts.map(async ({ file }) =>
          CodeModelFile.parse(await Bun.file(join(FIXTURE, file)).json()),
        ),
      );
      const { model: committed } = projectSystemModel({
        manifest,
        files,
        vocabulary: JAVA_VOCABULARY,
        config,
      });

      console.log(
        `[e2e] java shop: both stages ${Math.round(bothStages)} ms, ${files.length} artifacts, ${model.buildingBlocks.length} blocks, ${model.behaviours.length} behaviours`,
      );
      expect<unknown>(bothStages).toBeLessThan(SCAN_BUDGET_MS);
      expect<unknown>(model.name).toBe('shop');
      expect<unknown>(model.modules).toEqual(committed.modules);
      expect<unknown>(model.buildingBlocks).toEqual(committed.buildingBlocks);
      expect<unknown>(model.behaviours).toEqual(committed.behaviours);
      expect<unknown>(
        model.behaviours.find(
          (b) => b.id === 'behavior|shop.orders.Order.total',
        )?.type,
      ).toBe('Query');
    },
    SCAN_BUDGET_MS,
  );
});
