import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { chmod, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ConfiguredCodeModelScanner } from '#backend/adapters/out/scanners/configured-code-model.scanner';
import { SystemModel } from '#backend/app/system-model/system-model';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

/*
 * The `code-model` scanner runs whatever command line noesis-config.json
 * gives and projects what it wrote, by the language the manifest names. Here
 * the command is the fake tool (test/support/fake-code-model-tool.ts) copying
 * a committed code model: the Java shop's, then the C# shop's, with the one
 * config file telling them apart. The real tools run in test/e2e.
 */

const FIXTURES = join(import.meta.dir, '..', 'fixtures');
const JAVA_SHOP = join(FIXTURES, 'java', 'shop');
const CSHARP_SHOP = join(FIXTURES, 'csharp', 'shop');
const FAKE_TOOL = join(
  import.meta.dir,
  '..',
  'support',
  'fake-code-model-tool.ts',
);

let t: TestNoesis;
let scanner: ConfiguredCodeModelScanner;

const configure = (config: Record<string, unknown>) =>
  writeFile(
    join(t.root, 'noesis-config.json'),
    JSON.stringify({ scanner: 'code-model', ...config }),
  );

/** A Gradle-shaped command line: the tool's own flags, then the placeholders the service fills. */
const gradleLike = (source: string, ...flags: string[]) => [
  'bun',
  FAKE_TOOL,
  '--source',
  source,
  ...flags,
  '-q',
  'noesisScan',
  '-Pnoesis.out={out}',
  '-Pnoesis.repositoryRoot={root}',
  '-Pnoesis.repository={name}',
  '--out',
  '{out}',
];

const recordedArgs = async (): Promise<string[]> =>
  (await Bun.file(
    join(t.noesis.resolve('sessions', 'scanner'), 'fake-scan-args.json'),
  ).json()) as string[];

beforeEach(async () => {
  t = await testNoesis();
  scanner = new ConfiguredCodeModelScanner({
    noesis: t.noesis,
    now: () => NOW,
  });
});

afterEach(() => t.cleanup());

describe('The code-model scanner configured in noesis-config.json', () => {
  it('runs the configured command from the repository root with the placeholders filled', async () => {
    await configure({
      codeModel: { command: gradleLike(JAVA_SHOP) },
      namespacePartsToSkip: ['com.acme'],
    });

    await scanner.scan();

    const out = t.noesis.resolve('sessions', 'scanner');
    expect<unknown>(await recordedArgs()).toEqual([
      '--source',
      JAVA_SHOP,
      '-q',
      'noesisScan',
      `-Pnoesis.out=${out}`,
      `-Pnoesis.repositoryRoot=${t.root}`,
      `-Pnoesis.repository=${basename(t.root)}`,
      '--out',
      out,
    ]);
  });

  it('projects a Java code model by the Java vocabulary, as the Maven preset does', async () => {
    await configure({
      codeModel: { command: gradleLike(JAVA_SHOP) },
      namespacePartsToSkip: ['com.acme'],
      namespacesToExclude: ['*.internal'],
    });

    const model = SystemModel.parse(await scanner.scan());

    expect<unknown>(model.name).toBe(basename(t.root));
    expect<unknown>(
      model.buildingBlocks.map((b) => [b.id, b.type]),
    ).toContainEqual(['building_block|shop.orders.Order', 'aggregate']);
    expect<unknown>(
      model.behaviours.find((b) => b.name === 'total')?.type,
    ).toBe('Query');
  });

  it('projects a C# code model by the C# vocabulary: the manifest, not the config, names the language', async () => {
    await configure({
      codeModel: { command: gradleLike(CSHARP_SHOP) },
      namespacePartsToSkip: ['Acme'],
      namespacesToExclude: ['*.Internal'],
    });

    const model = SystemModel.parse(await scanner.scan());

    expect<unknown>(model.buildingBlocks.map((b) => b.id)).toContain(
      'building_block|Shop.Orders.Order',
    );
  });

  it('reads the command at every scan, so a changed config counts without a restart', async () => {
    await configure({ codeModel: { command: gradleLike(JAVA_SHOP) } });
    await scanner.scan();
    await configure({ codeModel: { command: gradleLike(CSHARP_SHOP) } });

    await scanner.scan();

    expect<unknown>(await recordedArgs()).toContain(CSHARP_SHOP);
  });

  it('runs a relative command from the repository root, where a build wrapper lives', async () => {
    const wrapper = join(t.root, 'gradlew');
    await writeFile(
      wrapper,
      `#!/bin/sh\nexec bun ${JSON.stringify(FAKE_TOOL)} --source ${JSON.stringify(JAVA_SHOP)} "$@"\n`,
    );
    await chmod(wrapper, 0o755);
    await configure({
      codeModel: { command: ['./gradlew', 'noesisScan', '--out', '{out}'] },
    });

    const model = await scanner.scan();

    expect<unknown>(model.buildingBlocks.length).toBeGreaterThan(0);
    expect<unknown>(await recordedArgs()).toEqual([
      '--source',
      JAVA_SHOP,
      'noesisScan',
      '--out',
      t.noesis.resolve('sessions', 'scanner'),
    ]);
  });

  it('refuses to scan without a codeModel command', async () => {
    await configure({});

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      /names the code-model scanner but has no "codeModel"/,
    );
  });

  it('rejects an empty command', async () => {
    await configure({ codeModel: { command: [] } });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      'Invalid noesis-config.json',
    );
  });

  it('fails with the tool output when the command exits with an error', async () => {
    await configure({
      codeModel: { command: gradleLike(JAVA_SHOP, '--fail', '2') },
    });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      /exit code 2[\s\S]*failing as asked/,
    );
  });

  it('fails when the tool wrote no manifest', async () => {
    await configure({
      codeModel: { command: ['bun', FAKE_TOOL, '--out', '{out}'] },
    });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      'no readable manifest',
    );
  });

  it('tells what to install, in the config file words, when the command cannot start', async () => {
    await configure({
      codeModel: {
        command: ['gradle-that-does-not-exist', 'noesisScan'],
        installHint: 'Install Gradle and publish the Noesis plugin.',
      },
    });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      /Cannot run gradle-that-does-not-exist[\s\S]*Install Gradle and publish the Noesis plugin\./,
    );
  });
});
