import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { checkCodeModelSchema } from '#backend/app/scanners/code-parsers/check-code-model-schema';
import {
  CODE_MODEL_SCHEMA_VERSION,
  CodeModelFile,
  type Language,
  ParseManifest,
  ParseManifestHeader,
} from '#backend/app/scanners/code-parsers/code-model';

const parsers = join(import.meta.dir, '../../../../code-parsers');

/** Each parser's committed golden files: the model it writes for its syntax fixture. */
const GOLDENS: Record<
  string,
  { language: Language; directory: string; artifacts: string[] }
> = {
  '.NET': {
    language: 'csharp',
    directory: join(parsers, 'dotnet/test/Noesis.Parser.Tests/golden'),
    artifacts: ['A:CSharpSyntax.OtherProject', 'A:CSharpSyntax'],
  },
  'Java (source engine)': {
    language: 'java',
    directory: join(parsers, 'java/core/src/test/resources/golden/source'),
    artifacts: ['A:java-syntax-other', 'A:java-syntax'],
  },
};

async function readJson(file: string): Promise<unknown> {
  return (await Bun.file(file).json()) as unknown;
}

describe.each(Object.entries(GOLDENS))(
  'the code model schema and the %s parser',
  (_parser, golden) => {
    test('accepts the manifest', async () => {
      const manifest = ParseManifest.parse(
        await readJson(join(golden.directory, 'manifest.json')),
      );
      expect(manifest.language).toBe(golden.language);
      expect(manifest.artifacts.map((artifact) => artifact.id)).toEqual(
        golden.artifacts,
      );
    });

    test('round-trips every model file the manifest lists', async () => {
      const manifest = ParseManifest.parse(
        await readJson(join(golden.directory, 'manifest.json')),
      );
      for (const artifact of manifest.artifacts) {
        const file = artifact.file.slice(artifact.file.lastIndexOf('/') + 1);
        const raw = await readJson(join(golden.directory, file));
        const model = CodeModelFile.parse(raw);
        expect(model.schemaVersion).toBe(CODE_MODEL_SCHEMA_VERSION);
        expect(model.artifact.id).toBe(artifact.id);
        expect(model.nodes.length).toBeGreaterThan(0);
        expect(model).toEqual(raw as typeof model);
      }
    });

    test('refuses a field the schema does not know', async () => {
      const manifest = ParseManifest.parse(
        await readJson(join(golden.directory, 'manifest.json')),
      );
      const first = manifest.artifacts[0]!.file;
      const raw = (await readJson(
        join(golden.directory, first.slice(first.lastIndexOf('/') + 1)),
      )) as { nodes: Record<string, unknown>[] };
      raw.nodes[0] = { ...raw.nodes[0], extra: true };
      expect(() => CodeModelFile.parse(raw)).toThrow();
    });
  },
);

describe('the code model schema version', () => {
  const header = (
    schemaVersion: number,
    version: string,
    language = 'java',
  ): ParseManifestHeader => ({
    schemaVersion,
    generator: { name: 'noesis-parse-java', version },
    language,
  });

  test('accepts a parser writing the schema the service reads, whatever its version', () => {
    expect(checkCodeModelSchema(header(1, '0.1.0'), 1)).toBeNull();
    expect(checkCodeModelSchema(header(1, '7.3.2'), 1)).toBeNull();
  });

  test('refuses a parser ahead of the service, naming it and the plugin update', () => {
    expect(checkCodeModelSchema(header(2, '2.0.0'), 1)).toBe(
      'noesis-parse-java 2.0.0 wrote code model schema 2; this Noesis plugin reads schema 1. Update the plugin (/plugin update noesis-beta@noesis), or pin the parser to a release that writes schema 1 (its README lists them).',
    );
  });

  test('refuses a parser behind the service, naming it and the skill that updates it', () => {
    expect(checkCodeModelSchema(header(1, '0.1.0'), 2)).toBe(
      'noesis-parse-java 0.1.0 wrote code model schema 1; this Noesis plugin reads schema 2. Update the parser with the setup-java-scanner skill.',
    );
    expect(
      checkCodeModelSchema(
        {
          ...header(1, '0.1.0', 'csharp'),
          generator: { name: 'noesis-parse-csharp', version: '0.1.0' },
        },
        2,
      ),
    ).toBe(
      'noesis-parse-csharp 0.1.0 wrote code model schema 1; this Noesis plugin reads schema 2. Update the parser with the setup-dotnet-scanner skill.',
    );
    expect(checkCodeModelSchema(header(1, '0.1.0', 'php'), 2)).toBe(
      'noesis-parse-java 0.1.0 wrote code model schema 1; this Noesis plugin reads schema 2. Update the parser to a release that writes schema 2.',
    );
  });

  test('reads the header of a manifest of any schema, but not one without a schema version', () => {
    const manifest = {
      schemaVersion: 2,
      generator: { name: 'noesis-parse-java', version: '2.0.0' },
      language: 'java',
      addedInSchema2: [],
    };
    expect(ParseManifestHeader.parse(manifest).schemaVersion).toBe(2);
    const { schemaVersion: _, ...withoutVersion } = manifest;
    expect(ParseManifestHeader.safeParse(withoutVersion).success).toBe(false);
  });

  // The parsers keep their own copy of the version they write. While they
  // live in this repository, the three declarations must agree.
  test.each([
    [
      'Java',
      'java/model/src/main/java/vision/noesis/parser/model/ParseManifest.java',
      /CURRENT_SCHEMA_VERSION\s*=\s*(\d+)\s*;/,
    ],
    [
      '.NET',
      'dotnet/src/Noesis.Parser.Model/ParseManifest.cs',
      /CurrentSchemaVersion\s*=\s*(\d+)\s*;/,
    ],
  ])(
    'the %s parser writes the schema the service reads',
    async (_parser, file, declaration) => {
      const source = await Bun.file(join(parsers, file)).text();
      const written = declaration.exec(source)?.[1];
      expect(Number(written)).toBe(CODE_MODEL_SCHEMA_VERSION);
    },
  );
});
