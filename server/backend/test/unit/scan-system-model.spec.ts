import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CSharpSourceCodeScanner } from '#backend/adapters/out/scanners/csharp.scanner';
import { DummySourceCodeScanner } from '#backend/adapters/out/scanners/dummy.scanner';
import { JavaSourceCodeScanner } from '#backend/adapters/out/scanners/java.scanner';
import { createScanner } from '#backend/adapters/out/scanners/scanners';
import { NoesisSystemModelsRepository } from '#backend/adapters/out/store/system-models.repository';
import { scanSystemModelHandler } from '#backend/app/system-model/scan-system-model';
import type {
  ScannedSystemModel,
  SourceCodeScanner,
} from '#backend/app/system-model/source-code-scanner';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let systemModels: NoesisSystemModelsRepository;

beforeEach(async () => {
  t = await testNoesis();
  systemModels = new NoesisSystemModelsRepository(t.noesis);
});

afterEach(() => t.cleanup());

const found = (name: string): ScannedSystemModel =>
  SystemModel.omit({ id: true }).parse({
    name,
    scanned_at: '2026-09-29T08:00:00.000Z',
  });

const scannerOf = (model: ScannedSystemModel): SourceCodeScanner => ({
  scan: () => Promise.resolve(model),
});

describe('Scanning the system model', () => {
  it('stores what the scanner finds at a minted id and answers with it', async () => {
    const scan = scanSystemModelHandler(scannerOf(found('shop')), systemModels);

    const model = await scan.handle();

    expect(SystemModelId.safeParse(model.id).success).toBe(true);
    expect(model).toEqual({ ...found('shop'), id: model.id });
    expect(await systemModels.list()).toEqual([model]);
  });

  it('keeps every scan, the last one newest', async () => {
    await scanSystemModelHandler(
      scannerOf(found('before')),
      systemModels,
    ).handle();
    const last = await scanSystemModelHandler(
      scannerOf(found('after')),
      systemModels,
    ).handle();

    expect((await systemModels.list()).map(({ name }) => name)).toEqual([
      'before',
      'after',
    ]);
    expect(await systemModels.findNewest()).toEqual(last);
  });
});

describe('createScanner', () => {
  it('makes the scanner the configuration names', () => {
    const deps = {
      noesis: t.noesis,
      changes: t.changesRepository,
      designDocs: t.designDocsRepository,
      now: () => NOW,
    };

    expect(createScanner('java', deps)).toBeInstanceOf(JavaSourceCodeScanner);
    expect(createScanner('csharp', deps)).toBeInstanceOf(
      CSharpSourceCodeScanner,
    );
    expect(createScanner('dummy', deps)).toBeInstanceOf(DummySourceCodeScanner);
  });
});
