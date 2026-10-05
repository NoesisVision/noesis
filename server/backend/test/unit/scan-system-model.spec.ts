import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CSharpSourceCodeScanner } from '#backend/adapters/out/scanners/csharp.scanner';
import { DummySourceCodeScanner } from '#backend/adapters/out/scanners/dummy.scanner';
import { JavaSourceCodeScanner } from '#backend/adapters/out/scanners/java.scanner';
import { createScanner } from '#backend/adapters/out/scanners/scanners';
import { NoesisSystemModelsRepository } from '#backend/adapters/out/store/system-models.repository';
import { scanSystemModelHandler } from '#backend/app/system-model/scan-system-model';
import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
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

const found = (name: string): SystemModel =>
  SystemModel.parse({
    id: SystemModelId.mint(),
    name,
    scanned_at: '2026-09-29T08:00:00.000Z',
  });

const scannerOf = (model: SystemModel): SourceCodeScanner => ({
  scan: () => Promise.resolve(model),
});

describe('Scanning the system model', () => {
  it('stores what the scanner finds and answers with it', async () => {
    const shop = found('shop');
    const scan = scanSystemModelHandler(scannerOf(shop), systemModels);

    const model = await scan.handle();

    expect(model).toEqual(shop);
    expect(await systemModels.list()).toEqual([shop]);
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
