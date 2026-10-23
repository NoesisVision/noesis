import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  CodeModelFile,
  type Language,
  ParseManifest,
} from '#backend/app/scanner/code-model/code-model';

const parsers = join(import.meta.dir, '../../../../parsers');

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
        expect(model.schemaVersion).toBe(1);
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
