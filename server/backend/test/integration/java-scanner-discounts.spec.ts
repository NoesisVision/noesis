// The Java example under examples/discounts-java carries the code before the
// weather-based discount, a sealed design document of that code, the weather
// design still to implement, and the system model the Java scanner found in
// the code. The scanner must keep finding that model: every element the
// sealed design names by id, what the weather design modifies but not what it
// adds, and the whole model as committed, so a parser regression fails here
// and not in a demo.
import { describe, expect, it } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { JavaSourceCodeScanner } from '#backend/adapters/out/scanners/java.scanner';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

const EXAMPLE = resolve(__dirname, '../../../../examples/discounts-java');
const AS_BUILT = join(
  EXAMPLE,
  '.noesis/graph/changes/2026-09-16-discounts-as-built/2026-09-16-discounts-as-built.design-doc.json',
);
const WEATHER = join(
  EXAMPLE,
  '.noesis/graph/changes/2026-09-17-weather-based-discount/2026-09-17-weather-based-discount.design-doc.json',
);
const SYSTEM_MODELS = join(EXAMPLE, '.noesis/graph/system-models');

// Read only: the scanner reads the checkout and writes nothing.
async function scan(): Promise<SystemModel> {
  return new JavaSourceCodeScanner({
    noesis: new NoesisDir(EXAMPLE),
    now: () => '2026-09-30T00:00:00.000Z',
  }).scan();
}

async function designDoc(file: string): Promise<DesignDocument> {
  return DesignDocument.parse(JSON.parse(await readFile(file, 'utf8')));
}

function idsOf(model: SystemModel): Map<string, { type?: unknown }> {
  return new Map<string, { type?: unknown }>([
    ...model.modules.map((m) => [m.id, {}] as const),
    ...model.buildingBlocks.map((b) => [b.id, { type: b.type }] as const),
    ...model.behaviours.map((b) => [b.id, { type: b.type }] as const),
  ]);
}

async function committedModel(): Promise<SystemModel> {
  const [file, ...more] = (await readdir(SYSTEM_MODELS)).filter((name) =>
    name.endsWith('.json'),
  );
  expect(more).toEqual([]);
  if (file === undefined) throw new Error('No system model in the example');
  return SystemModel.parse(
    JSON.parse(await readFile(join(SYSTEM_MODELS, file), 'utf8')),
  );
}

describe('The Java scanner on examples/discounts-java', () => {
  it('finds every element the sealed design document names, with the type it designed', async () => {
    const byId = idsOf(await scan());
    const design = await designDoc(AS_BUILT);
    expect(design.implemented).toBe(true);

    const designed = [
      ...design.modules.added,
      ...design.buildingBlocks.added,
      ...design.behaviours.added,
    ];
    expect(designed).toHaveLength(byId.size);
    for (const element of designed) {
      const found = byId.get(element.id);
      expect(found, element.id).toBeDefined();
      if ('type' in element && element.type.changed) {
        expect(found?.type, element.id).toBe(element.type.value);
      }
    }
  });

  it('finds what the weather design modifies and none of what it adds', async () => {
    const byId = idsOf(await scan());
    const design = await designDoc(WEATHER);
    expect(design.implemented).toBe(false);

    const modified = [
      ...design.modules.modified,
      ...design.buildingBlocks.modified,
      ...design.behaviours.modified,
    ];
    const added = [
      ...design.modules.added,
      ...design.buildingBlocks.added,
      ...design.behaviours.added,
    ];
    expect(modified.length).toBeGreaterThan(0);
    expect(added.length).toBeGreaterThan(10);
    for (const { id } of modified) expect(byId.has(id), id).toBe(true);
    for (const { id } of added) expect(byId.has(id), id).toBe(false);
  });
  it('finds the model committed with the example, scan time, id and commit apart', async () => {
    const { id, scanned_at, commit: _, ...committed } = await committedModel();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(scanned_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const { id: scannedId, scanned_at: now, commit, ...found } = await scan();

    expect(SystemModelId.safeParse(scannedId).success).toBe(true);
    expect(now).toBe('2026-09-30T00:00:00.000Z');
    // The example lives in this repository, so its HEAD is this checkout's.
    expect<unknown>(commit).toMatch(/^[0-9a-f]{4,40}$/);
    expect(found).toEqual(committed);
    expect<unknown>(found.modules.map((m) => m.id)).toEqual([
      'module|discounts',
      'module|discounts.calculation',
      'module|discounts.offers',
      'module|discounts.users',
    ]);
    expect(found.buildingBlocks).toHaveLength(19);
    expect(found.behaviours).toHaveLength(17);
  });
});
