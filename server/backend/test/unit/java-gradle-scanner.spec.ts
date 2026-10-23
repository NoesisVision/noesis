import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { chmod, cp, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { JAVA_SCANNER_PLUGIN_VERSION } from '#backend/adapters/out/scanners/java-build';
import {
  initScript,
  JavaGradleSourceCodeScanner,
} from '#backend/adapters/out/scanners/java-gradle/java-gradle.scanner';
import { NamespaceConfig } from '#backend/app/code-model/projection/namespace-config';
import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import { settingsScanner } from '../support/settings-scanner';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

/*
 * The Java scanner for Gradle builds runs the noesisScan task, applied through
 * an init script the service writes, so a build scans without applying the
 * plugin itself. Here Gradle is the fake tool (test/support/fake-code-model-tool.ts)
 * copying the committed code model of test/fixtures/java/shop; the init
 * script itself ran against examples/discounts-java with and without the
 * plugin in its build.
 */

const FIXTURE = join(import.meta.dir, '..', 'fixtures', 'java', 'shop');
const FAKE_TOOL = join(
  import.meta.dir,
  '..',
  'support',
  'fake-code-model-tool.ts',
);

let t: TestNoesis;

/**
 * A scanner built from `.noesis/settings.json` at every scan, whose first
 * stage is `command`; none runs the repository's own build.
 */
const scannerWith = (command?: string[]): SourceCodeScanner =>
  settingsScanner(
    t.noesis,
    ({ namespaces, engine }) =>
      new JavaGradleSourceCodeScanner({
        noesis: t.noesis,
        now: () => NOW,
        namespaces,
        command,
        engine: engine ?? undefined,
      }),
  );

const configure = (config: Record<string, unknown>) =>
  writeFile(
    t.noesis.resolve('settings.json'),
    JSON.stringify({
      scanner: 'java-gradle',
      namespacePartsToSkip: ['com.acme'],
      ...config,
    }),
  );

/** The arguments the fake tool was run with, recorded in the repository root. */
const recordedArgs = async (): Promise<string[]> =>
  (await Bun.file(join(t.root, 'fake-scan-args.json')).json()) as string[];

beforeEach(async () => {
  t = await testNoesis();
  await cp(
    join(FIXTURE, '.noesis', 'settings.json'),
    t.noesis.resolve('settings.json'),
  );
});

afterEach(() => t.cleanup());

describe('The Java scanner for Gradle builds', () => {
  it('runs noesisScan through the init script it wrote, into a fresh .noesis/tmp/<uuid>/', async () => {
    const scanner = scannerWith(['bun', FAKE_TOOL, '--source', FIXTURE]);

    const model = await scanner.scan();

    const args = await recordedArgs();
    const script = args[4] ?? '';
    const out = script.slice(0, -'/noesis-scan.init.gradle'.length);
    expect<unknown>(out).toMatch(
      new RegExp(`^${t.noesis.resolve('tmp')}/[0-9a-f-]{36}$`),
    );
    expect<unknown>(args).toEqual([
      '--source',
      FIXTURE,
      '-q',
      '--init-script',
      script,
      'noesisScan',
      `-Pnoesis.out=${out}`,
      `-Pnoesis.repositoryRoot=${t.root}`,
      `-Pnoesis.repository=${basename(t.root)}`,
      '-Pnoesis.engine=source',
    ]);
    expect<unknown>(model.buildingBlocks.length).toBeGreaterThan(0);
    // The init script went with the rest of the tmp directory.
    expect<unknown>(await readdir(t.noesis.resolve('tmp'))).toEqual([]);
  });

  it('writes the init script of the pinned plugin version', async () => {
    // The script lives in the tmp directory only while the tool runs, so the
    // tool copies it out: `$3` is the path after `-q --init-script`.
    const copying = new JavaGradleSourceCodeScanner({
      noesis: t.noesis,
      now: () => NOW,
      namespaces: NamespaceConfig.of({}),
      command: ['sh', '-c', 'cp "$3" "$0/init.gradle"; exit 1', t.root],
    });

    await expect<unknown>(copying.scan()).rejects.toThrow();

    expect<unknown>(await Bun.file(join(t.root, 'init.gradle')).text()).toBe(
      initScript(JAVA_SCANNER_PLUGIN_VERSION),
    );
  });

  it('applies the pinned plugin only to a build that does not apply it itself', () => {
    const script = initScript('1.2.3');

    expect<unknown>(script).toContain(
      "classpath 'vision.noesis:noesis-scanner-gradle-plugin:1.2.3'",
    );
    expect<unknown>(script).toContain(
      "root.tasks.findByName('noesisScan') == null",
    );
    expect<unknown>(script).toContain('mavenLocal()');
  });

  it('runs the engine .noesis/settings.json names', async () => {
    await configure({ engine: 'hybrid' });
    const scanner = scannerWith(['bun', FAKE_TOOL, '--source', FIXTURE]);

    await scanner.scan();

    expect<unknown>(await recordedArgs()).toContain('-Pnoesis.engine=hybrid');
  });

  it("prefers the repository's own gradlew when no command is configured", async () => {
    const wrapper = join(t.root, 'gradlew');
    await writeFile(
      wrapper,
      `#!/bin/sh\nexec bun ${JSON.stringify(FAKE_TOOL)} --source ${JSON.stringify(FIXTURE)} "$@"\n`,
    );
    await chmod(wrapper, 0o755);

    await scannerWith().scan();

    expect<unknown>((await recordedArgs()).at(-1)).toBe(
      '-Pnoesis.engine=source',
    );
  });
});

describe('The engine setting in .noesis/settings.json', () => {
  it('is refused for a scanner that does not read it', async () => {
    await writeFile(
      t.noesis.resolve('settings.json'),
      JSON.stringify({ scanner: 'csharp', engine: 'hybrid' }),
    );
    const scanner = scannerWith(['bun', FAKE_TOOL, '--source', FIXTURE]);

    await expect(scanner.scan()).rejects.toThrow(
      'only the java-maven and java-gradle scanners read',
    );
  });
});
