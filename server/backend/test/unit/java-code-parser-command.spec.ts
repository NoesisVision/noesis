import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { chmod, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { JavaCodeParser } from '#backend/adapters/out/scanner/parsers/java-code-parser';
import { SystemModel } from '#backend/app/scanner/system-model/system-model';
import { fixedClock } from '../support/fixed-clock';
import { settingsScanner } from '../support/test-scanner';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

/*
 * The `code-model` parser runs whatever command line .noesis/settings.json
 * gives, and the scanner builds the system model of what it wrote by the
 * language the manifest names. Here
 * the command is a fake tool copying a committed code model: the Java shop's
 * (test/support/fake-code-model-tool.ts), then the .NET parser's golden one
 * (test/support/fake-parse-csharp.ts), with the one settings file telling them
 * apart. The real tools run in test/e2e.
 */

const FIXTURES = join(import.meta.dir, '..', 'fixtures');
const JAVA_SHOP = join(FIXTURES, 'java', 'shop');
const FAKE_TOOL = join(
  import.meta.dir,
  '..',
  'support',
  'fake-code-model-tool.ts',
);
const FAKE_CSHARP_TOOL = join(
  import.meta.dir,
  '..',
  'support',
  'fake-parse-csharp.ts',
);
const CSHARP_GOLDEN = join(
  import.meta.dir,
  '..',
  '..',
  '..',
  '..',
  'parsers',
  'dotnet',
  'test',
  'Noesis.Parser.Tests',
  'golden',
);
/** A command line writing the .NET parser's golden C# code model. */
const csharpLike = () => [
  'bun',
  FAKE_CSHARP_TOOL,
  '--golden',
  CSHARP_GOLDEN,
  '--out',
  '{out}',
];

let t: TestNoesis;
let scanner: ReturnType<typeof settingsScanner>;

const configure = (config: Record<string, unknown>) =>
  writeFile(
    t.noesis.resolve('settings.json'),
    JSON.stringify({ parser: 'code-model', ...config }),
  );

/** A Gradle-shaped command line: the tool's own flags, then the placeholders the service fills. */
const gradleLike = (source: string, ...flags: string[]) => [
  'bun',
  FAKE_TOOL,
  '--source',
  source,
  ...flags,
  '-q',
  'noesisParse',
  '-Pnoesis.out={out}',
  '-Pnoesis.repositoryRoot={root}',
  '-Pnoesis.repository={name}',
  '--out',
  '{out}',
];

/** The arguments the fake tool was run with, recorded in the repository root. */
const recordedArgs = async (): Promise<string[]> =>
  (await Bun.file(join(t.root, 'fake-parse-args.json')).json()) as string[];

/** The output directory a recorded `--out` names: a fresh `.noesis/tmp/<uuid>/`. */
const outOf = (args: readonly string[]): string => {
  const out = args[args.indexOf('--out') + 1] ?? '';
  expect<unknown>(out).toMatch(
    new RegExp(`^${t.noesis.resolve('tmp')}/[0-9a-f-]{36}$`),
  );
  return out;
};

beforeEach(async () => {
  t = await testNoesis();
  scanner = settingsScanner(
    t.noesis,
    ({ codeModel }) =>
      new JavaCodeParser({
        noesis: t.noesis,
        codeModel,
      }),
    fixedClock(NOW),
  );
});

afterEach(() => t.cleanup());

describe('The code-model parser configured in .noesis/settings.json', () => {
  it('runs the configured command from the repository root with the placeholders filled', async () => {
    await configure({
      codeModel: { command: gradleLike(JAVA_SHOP) },
      namespacePartsToSkip: ['com.acme'],
    });

    await scanner.scan();

    const args = await recordedArgs();
    const out = outOf(args);
    expect<unknown>(args).toEqual([
      '--source',
      JAVA_SHOP,
      '-q',
      'noesisParse',
      `-Pnoesis.out=${out}`,
      `-Pnoesis.repositoryRoot=${t.root}`,
      `-Pnoesis.repository=${basename(t.root)}`,
      '--out',
      out,
    ]);
  });

  it('builds a Java code model by the Java vocabulary, as the Maven preset does', async () => {
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

  it('builds a C# code model by the C# vocabulary: the manifest, not the settings, names the language', async () => {
    await configure({
      codeModel: { command: csharpLike() },
      namespacePartsToSkip: ['CSharpSyntax'],
      namespacesToExclude: ['*.ExcludedNamespace'],
    });

    const model = SystemModel.parse(await scanner.scan());

    expect<unknown>(model.buildingBlocks.map((b) => b.id)).toContain(
      'building_block|OtherProject.Projection.BlockFromOtherProject',
    );
  });

  it('reads the command at every scan, so changed settings count without a restart', async () => {
    await configure({ codeModel: { command: gradleLike(JAVA_SHOP) } });
    await scanner.scan();
    await configure({
      codeModel: { command: gradleLike(JAVA_SHOP, '--changed') },
    });

    await scanner.scan();

    expect<unknown>(await recordedArgs()).toContain('--changed');
  });

  it('runs a relative command from the repository root, where a build wrapper lives', async () => {
    const wrapper = join(t.root, 'gradlew');
    await writeFile(
      wrapper,
      `#!/bin/sh\nexec bun ${JSON.stringify(FAKE_TOOL)} --source ${JSON.stringify(JAVA_SHOP)} "$@"\n`,
    );
    await chmod(wrapper, 0o755);
    await configure({
      codeModel: { command: ['./gradlew', 'noesisParse', '--out', '{out}'] },
    });

    const model = await scanner.scan();

    expect<unknown>(model.buildingBlocks.length).toBeGreaterThan(0);
    const args = await recordedArgs();
    expect<unknown>(args).toEqual([
      '--source',
      JAVA_SHOP,
      'noesisParse',
      '--out',
      outOf(args),
    ]);
  });

  it('refuses to scan without a codeModel command', async () => {
    await configure({});

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      /names the code-model parser but has no "codeModel"/,
    );
  });

  it('rejects an empty command', async () => {
    await configure({ codeModel: { command: [] } });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      /Invalid .*\.noesis\/settings\.json/,
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

  it('removes its tmp directory after a scan, whether it succeeds or fails', async () => {
    await configure({ codeModel: { command: gradleLike(JAVA_SHOP) } });
    await scanner.scan();
    await configure({
      codeModel: { command: gradleLike(JAVA_SHOP, '--fail', '2') },
    });
    await expect<unknown>(scanner.scan()).rejects.toThrow();

    expect<unknown>(await readdir(t.noesis.resolve('tmp'))).toEqual([]);
  });

  it('tells what to install, in the settings file words, when the command cannot start', async () => {
    await configure({
      codeModel: {
        command: ['gradle-that-does-not-exist', 'noesisParse'],
        installHint: 'Install Gradle and publish the Noesis plugin.',
      },
    });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      /Cannot run gradle-that-does-not-exist[\s\S]*Install Gradle and publish the Noesis plugin\./,
    );
  });
});
