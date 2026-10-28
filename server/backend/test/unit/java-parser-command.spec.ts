import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { chmod, cp, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { SystemModel } from '#backend/app/system-model/system-model';
import { codeParserFor } from '#backend/boot/code-parsers';
import { fixedClock } from '../support/fixed-clock';
import { settingsScanner } from '../support/test-scanner';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

/*
 * The `java` parser runs the command line .noesis/settings.json gives, and
 * reads only the Java code model it wrote. Here the command is a fake tool
 * copying a committed code model: the Java shop's
 * (test/support/fake-code-model-tool.ts), or the .NET parser's golden one
 * (test/support/fake-parse-csharp.ts), which the parser refuses. The real
 * tools run in test/e2e.
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
  'code-parsers',
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

/** Writes the java parser's settings (`command`, `installHint`), and the namespace ones. */
const configure = (
  parser: Record<string, unknown>,
  namespaces: Record<string, unknown> = {},
) =>
  writeFile(
    t.noesis.resolve('settings.json'),
    JSON.stringify({ parser: { language: 'java', ...parser }, ...namespaces }),
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
  scanner = settingsScanner(t.noesis, codeParserFor(t.noesis), fixedClock(NOW));
});

afterEach(() => t.cleanup());

describe('The java parser configured in .noesis/settings.json', () => {
  it('runs the configured command from the repository root with the placeholders filled', async () => {
    await configure(
      { command: gradleLike(JAVA_SHOP) },
      {
        namespacePartsToSkip: ['com.acme'],
      },
    );

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
    await configure(
      { command: gradleLike(JAVA_SHOP) },
      {
        namespacePartsToSkip: ['com.acme'],
        namespacesToExclude: ['*.internal'],
      },
    );

    const model = SystemModel.parse(await scanner.scan());

    expect<unknown>(model.name).toBe(basename(t.root));
    expect<unknown>(
      model.buildingBlocks.map((b) => [b.id, b.type]),
    ).toContainEqual(['building_block|shop.orders.Order', 'aggregate']);
    expect<unknown>(model.behaviors.find((b) => b.name === 'total')?.type).toBe(
      'Query',
    );
  });

  it('refuses a command that writes a C# code model', async () => {
    await configure({ command: csharpLike() });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      /wrote a code model of csharp .*; the java parser reads only java\./,
    );
  });

  it('reads the command at every scan, so changed settings count without a restart', async () => {
    await configure({ command: gradleLike(JAVA_SHOP) });
    await scanner.scan();
    await configure({ command: gradleLike(JAVA_SHOP, '--changed') });

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
      command: ['./gradlew', 'noesisParse', '--out', '{out}'],
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

  it('rejects a missing or empty command', async () => {
    for (const parser of [{}, { command: [] }]) {
      await configure(parser);

      await expect<unknown>(scanner.scan()).rejects.toThrow(
        /Invalid .*\.noesis\/settings\.json/,
      );
    }
  });

  it('fails with the tool output when the command exits with an error', async () => {
    await configure({ command: gradleLike(JAVA_SHOP, '--fail', '2') });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      /exit code 2[\s\S]*failing as asked/,
    );
  });

  it('refuses a Java code model whose manifest names another language', async () => {
    const source = join(t.root, 'mislabelled');
    await cp(join(JAVA_SHOP, 'code-model'), join(source, 'code-model'), {
      recursive: true,
    });
    const manifest = join(source, 'code-model', 'java', 'manifest.json');
    await writeFile(
      manifest,
      (await readFile(manifest, 'utf8')).replace(
        '"language": "java"',
        '"language": "csharp"',
      ),
    );
    await configure({ command: gradleLike(source) });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      /wrote a csharp code model; the java parser reads only java\./,
    );
  });

  /** A copy of the Java shop's code model whose manifest is edited by `edit`. */
  const shopWithManifest = async (
    edit: (manifest: Record<string, unknown>) => void,
  ): Promise<string> => {
    const source = join(t.root, 'edited');
    await cp(join(JAVA_SHOP, 'code-model'), join(source, 'code-model'), {
      recursive: true,
    });
    const manifest = join(source, 'code-model', 'java', 'manifest.json');
    const json = JSON.parse(await readFile(manifest, 'utf8')) as Record<
      string,
      unknown
    >;
    edit(json);
    await writeFile(manifest, JSON.stringify(json));
    return source;
  };

  it('refuses a code model schema it does not read, before reading the rest, naming the parser that wrote it', async () => {
    const source = await shopWithManifest((manifest) => {
      manifest.schemaVersion = 2;
      manifest.generator = { name: 'noesis-parse-java', version: '2.0.0' };
      manifest.addedInSchema2 = true;
    });
    await configure({ command: gradleLike(source) });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      'noesis-parse-java 2.0.0 wrote code model schema 2; this Noesis plugin reads schema 1. Update the plugin',
    );
  });

  it('reports a manifest without a schema version as unreadable', async () => {
    const source = await shopWithManifest((manifest) => {
      delete manifest.schemaVersion;
    });
    await configure({ command: gradleLike(source) });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      /no readable manifest[\s\S]*schemaVersion/,
    );
  });

  it('fails when the tool wrote no manifest', async () => {
    await configure({ command: ['bun', FAKE_TOOL, '--out', '{out}'] });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      'no readable manifest',
    );
  });

  it('removes its tmp directory after a scan, whether it succeeds or fails', async () => {
    await configure({ command: gradleLike(JAVA_SHOP) });
    await scanner.scan();
    await configure({ command: gradleLike(JAVA_SHOP, '--fail', '2') });
    await expect<unknown>(scanner.scan()).rejects.toThrow();

    expect<unknown>(await readdir(t.noesis.resolve('tmp'))).toEqual([]);
  });

  it('tells what to install, in the settings file words, when the command cannot start', async () => {
    await configure({
      command: ['gradle-that-does-not-exist', 'noesisParse'],
      installHint: 'Install Gradle and publish the Noesis plugin.',
    });

    await expect<unknown>(scanner.scan()).rejects.toThrow(
      /Cannot run gradle-that-does-not-exist[\s\S]*Install Gradle and publish the Noesis plugin\./,
    );
  });
});
