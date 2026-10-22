import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { chmod, cp, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { JAVA_SCANNER_PLUGIN_VERSION } from '#backend/adapters/out/scanners/java-build';
import {
  initScript,
  JavaGradleSourceCodeScanner,
} from '#backend/adapters/out/scanners/java-gradle/java-gradle.scanner';
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

const configure = (config: Record<string, unknown>) =>
  writeFile(
    t.noesis.resolve('noesis-config.json'),
    JSON.stringify({
      scanner: 'java-gradle',
      namespacePartsToSkip: ['com.acme'],
      ...config,
    }),
  );

const recordedArgs = async (): Promise<string[]> =>
  (await Bun.file(
    join(t.noesis.resolve('sessions', 'scanner'), 'fake-scan-args.json'),
  ).json()) as string[];

beforeEach(async () => {
  t = await testNoesis();
  await cp(
    join(FIXTURE, '.noesis', 'noesis-config.json'),
    t.noesis.resolve('noesis-config.json'),
  );
});

afterEach(() => t.cleanup());

describe('The Java scanner for Gradle builds', () => {
  it('runs noesisScan through the init script it wrote, into the session directory', async () => {
    const scanner = new JavaGradleSourceCodeScanner({
      noesis: t.noesis,
      now: () => NOW,
      command: ['bun', FAKE_TOOL, '--source', FIXTURE],
    });

    const model = await scanner.scan();

    const out = t.noesis.resolve('sessions', 'scanner');
    const script = join(out, 'noesis-scan.init.gradle');
    expect<unknown>(await recordedArgs()).toEqual([
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
    expect<unknown>(await Bun.file(script).text()).toBe(
      initScript(JAVA_SCANNER_PLUGIN_VERSION),
    );
    expect<unknown>(model.buildingBlocks.length).toBeGreaterThan(0);
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

  it('runs the engine noesis-config.json names', async () => {
    await configure({ engine: 'hybrid' });
    const scanner = new JavaGradleSourceCodeScanner({
      noesis: t.noesis,
      now: () => NOW,
      command: ['bun', FAKE_TOOL, '--source', FIXTURE],
    });

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

    await new JavaGradleSourceCodeScanner({
      noesis: t.noesis,
      now: () => NOW,
    }).scan();

    expect<unknown>((await recordedArgs()).at(-1)).toBe(
      '-Pnoesis.engine=source',
    );
  });
});

describe('The engine setting in noesis-config.json', () => {
  it('is refused for a scanner that does not read it', async () => {
    await writeFile(
      t.noesis.resolve('noesis-config.json'),
      JSON.stringify({ scanner: 'csharp', engine: 'hybrid' }),
    );
    const scanner = new JavaGradleSourceCodeScanner({
      noesis: t.noesis,
      now: () => NOW,
      command: ['bun', FAKE_TOOL, '--source', FIXTURE],
    });

    await expect(scanner.scan()).rejects.toThrow(
      'only the java-maven and java-gradle scanners read',
    );
  });
});
