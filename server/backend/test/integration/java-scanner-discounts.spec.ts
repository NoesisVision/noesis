// The Java example under examples/discounts-java carries a sealed design
// document and the system model the Java scanner found in its code. The
// scanner must keep finding that model: every element the design document
// names by id, and the whole model as committed, so a parser regression
// fails here and not in a demo.
import { describe, expect, it } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { JavaSourceCodeScanner } from '#backend/adapters/out/scanners/java.scanner';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

const EXAMPLE = resolve(__dirname, '../../../../examples/discounts-java');
const DESIGN_DOC = join(
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

async function committedModel(): Promise<SystemModel> {
  const [file, ...more] = (await readdir(SYSTEM_MODELS)).filter((name) =>
    name.endsWith('.system-model.json'),
  );
  expect(more).toEqual([]);
  if (file === undefined) throw new Error('No system model in the example');
  return SystemModel.parse(
    JSON.parse(await readFile(join(SYSTEM_MODELS, file), 'utf8')),
  );
}

describe('The Java scanner on examples/discounts-java', () => {
  it('finds every element the sealed design document names, with the type it designed', async () => {
    const model = await scan();
    const design = DesignDocument.parse(
      JSON.parse(await readFile(DESIGN_DOC, 'utf8')),
    );
    const byId = new Map<string, { type?: unknown }>([
      ...model.modules.map((m) => [m.id, {}] as const),
      ...model.buildingBlocks.map((b) => [b.id, { type: b.type }] as const),
      ...model.behaviours.map((b) => [b.id, { type: b.type }] as const),
    ]);

    const designed = [
      ...design.modules.added,
      ...design.modules.modified,
      ...design.buildingBlocks.added,
      ...design.buildingBlocks.modified,
      ...design.behaviours.added,
      ...design.behaviours.modified,
    ];
    expect(designed.length).toBeGreaterThan(10);
    for (const element of designed) {
      const found = byId.get(element.id);
      expect(found, element.id).toBeDefined();
      if ('type' in element && element.type.changed) {
        expect(found?.type, element.id).toBe(element.type.value);
      }
    }
    expect<unknown>(
      model.buildingBlocks.find(
        (b) =>
          b.id ===
          'building_block|discounts.weather.openmeteo.OpenMeteoWeatherProvider',
      )?.implements,
    ).toEqual(['building_block|discounts.weather.WeatherProvider']);
  });

  it('finds the model committed with the example, scan time and id apart', async () => {
    const { id, scanned_at, ...committed } = await committedModel();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(scanned_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const { id: scannedId, scanned_at: now, ...found } = await scan();

    expect(SystemModelId.safeParse(scannedId).success).toBe(true);
    expect(now).toBe('2026-09-30T00:00:00.000Z');
    expect(found).toEqual(committed);
    expect<unknown>(found.modules.map((m) => m.id)).toEqual([
      'module|discounts',
      'module|discounts.calculation',
      'module|discounts.offers',
      'module|discounts.users',
      'module|discounts.weather',
      'module|discounts.weather.openmeteo',
    ]);
    expect(found.buildingBlocks).toHaveLength(24);
    expect(found.behaviours).toHaveLength(22);
  });
});
