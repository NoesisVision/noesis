import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  CodeModelFile,
  ScanManifest,
} from '#backend/app/code-model/code-model';

const golden = join(
  import.meta.dir,
  '../../../../scanners/dotnet/test/Noesis.Scanner.Tests/golden',
);

async function readGolden(file: string): Promise<unknown> {
  return (await Bun.file(join(golden, file)).json()) as unknown;
}

describe('the code model schema', () => {
  test('accepts the .NET scanner manifest', async () => {
    const manifest = ScanManifest.parse(await readGolden('manifest.json'));
    expect(manifest.language).toBe('csharp');
    expect(manifest.artifacts.map((artifact) => artifact.id)).toEqual([
      'A:CSharpSyntax.OtherProject',
      'A:CSharpSyntax',
    ]);
  });

  test.each([
    'CSharpSyntax.code-model.json',
    'CSharpSyntax.OtherProject.code-model.json',
  ])('round-trips the .NET scanner model %s', async (file) => {
    const raw = await readGolden(file);
    const model = CodeModelFile.parse(raw);
    expect(model.schemaVersion).toBe(1);
    expect(model.nodes.length).toBeGreaterThan(0);
    expect(model).toEqual(raw as typeof model);
  });

  test('refuses a field the schema does not know', async () => {
    const raw = (await readGolden(
      'CSharpSyntax.OtherProject.code-model.json',
    )) as {
      nodes: Record<string, unknown>[];
    };
    raw.nodes[0] = { ...raw.nodes[0], extra: true };
    expect(() => CodeModelFile.parse(raw)).toThrow();
  });
});
