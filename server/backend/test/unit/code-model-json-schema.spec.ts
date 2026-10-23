import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  buildCodeModelSchemas,
  defaultDestination,
} from '../../tools/generate-code-model-schema';

const scanners = join(import.meta.dir, '../../../../scanners');
const golden = join(scanners, 'dotnet/test/Noesis.Scanner.Tests/golden');
const javaGolden = join(scanners, 'java/core/src/test/resources/golden/source');

const { version } = JSON.parse(
  await readFile(join(import.meta.dir, '../../package.json'), 'utf8'),
) as { version: string };
const generated = buildCodeModelSchemas(version);

async function committed(file: string): Promise<unknown> {
  return JSON.parse(await readFile(join(defaultDestination, file), 'utf8'));
}

async function readGolden(file: string): Promise<unknown> {
  return (await Bun.file(join(golden, file)).json()) as unknown;
}

describe('the code model JSON Schema', () => {
  it('is committed as `bun run generate` writes it', async () => {
    for (const [file, json] of generated) {
      expect(await committed(file)).toEqual(json);
    }
  });

  it('names every shared shape in $defs and points at nothing outside the file', () => {
    const schema = generated.get('code-model.schema.json') as {
      $defs: Record<string, unknown>;
    };
    expect(Object.keys(schema.$defs).sort()).toEqual([
      'Annotation',
      'AnnotationValue',
      'ArtifactKind',
      'ArtifactNode',
      'DeclarationNode',
      'Diagnostic',
      'Edge',
      'ExpressionKind',
      'FieldNode',
      'Generator',
      'LanguageBag',
      'MethodNode',
      'Modifier',
      'NamespaceNode',
      'NodeId',
      'Origin',
      'Parameter',
      'Passing',
      'PropertyNode',
      'Signature',
      'SourceSpan',
      'StubNode',
      'TypeKind',
      'TypeNode',
      'TypeParameter',
      'TypeParameterConstraint',
      'TypeRef',
      'UsageSite',
      'Visibility',
    ]);
    for (const json of generated.values()) {
      const refs = [...JSON.stringify(json).matchAll(/"\$ref":"([^"]+)"/g)].map(
        (m) => m[1] ?? '',
      );
      expect(refs.filter((ref) => !ref.startsWith('#/$defs/'))).toEqual([]);
    }
  });

  it('accepts the .NET scanner manifest', async () => {
    const schema = z.fromJSONSchema(
      (await committed('manifest.schema.json')) as Parameters<
        typeof z.fromJSONSchema
      >[0],
    );
    expect(schema.safeParse(await readGolden('manifest.json')).success).toBe(
      true,
    );
  });

  it.each([
    join(golden, 'CSharpSyntax.code-model.json'),
    join(golden, 'CSharpSyntax.OtherProject.code-model.json'),
    join(javaGolden, 'java-syntax.code-model.json'),
    join(javaGolden, 'java-syntax-other.code-model.json'),
  ])('accepts the scanner model %s', async (file) => {
    const schema = z.fromJSONSchema(
      (await committed('code-model.schema.json')) as Parameters<
        typeof z.fromJSONSchema
      >[0],
    );
    const result = schema.safeParse(await Bun.file(file).json());
    expect(result.success).toBe(true);
  });

  it('accepts the Java scanner manifest', async () => {
    const schema = z.fromJSONSchema(
      (await committed('manifest.schema.json')) as Parameters<
        typeof z.fromJSONSchema
      >[0],
    );
    const manifest = await Bun.file(join(javaGolden, 'manifest.json')).json();
    expect(schema.safeParse(manifest).success).toBe(true);
  });
});
