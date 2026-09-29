import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CSharpSourceCodeScanner } from '#backend/adapters/out/scanners/csharp.scanner';
import { DummySourceCodeScanner } from '#backend/adapters/out/scanners/dummy.scanner';
import { JavaSourceCodeScanner } from '#backend/adapters/out/scanners/java.scanner';
import { createScanner } from '#backend/adapters/out/scanners/scanners';
import { NoesisSystemModelsRepository } from '#backend/adapters/out/store/system-models.repository';
import { scanSystemModelHandler } from '#backend/app/system-model/scan-system-model';
import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import { SystemModel } from '#backend/app/system-model/system-model';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let systemModels: NoesisSystemModelsRepository;

beforeEach(async () => {
  t = await testNoesis();
  systemModels = new NoesisSystemModelsRepository(t.noesis);
});

afterEach(() => t.cleanup());

const model = (id: string, name = id): SystemModel =>
  SystemModel.parse({ id, name, scanned_at: '2026-09-29T08:00:00.000Z' });

const scannerOf = (found: SystemModel): SourceCodeScanner => ({
  scan: () => Promise.resolve(found),
});

describe('Scanning the system model', () => {
  it('stores what the scanner finds and answers with it', async () => {
    const scan = scanSystemModelHandler(scannerOf(model('shop')), systemModels);

    expect(await scan.handle()).toEqual(model('shop'));
    expect(await systemModels.list()).toEqual([model('shop')]);
  });

  it('replaces the model scanned before', async () => {
    await systemModels.save(model('shop', 'before'));
    const scan = scanSystemModelHandler(
      scannerOf(model('shop', 'after')),
      systemModels,
    );

    await scan.handle();

    expect(await systemModels.list()).toEqual([model('shop', 'after')]);
  });
});

describe('createScanner', () => {
  it('makes the scanner the configuration names', () => {
    expect(createScanner('java')).toBeInstanceOf(JavaSourceCodeScanner);
    expect(createScanner('csharp')).toBeInstanceOf(CSharpSourceCodeScanner);
    expect(createScanner('dummy')).toBeInstanceOf(DummySourceCodeScanner);
  });
});
