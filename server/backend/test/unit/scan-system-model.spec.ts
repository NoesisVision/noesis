import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DummySourceCodeScanner } from '#backend/adapters/out/scanners/dummy.scanner';
import {
  createScanner,
  type RepositoryScanners,
} from '#backend/adapters/out/scanners/scanners';
import { NoesisSystemModelsRepository } from '#backend/adapters/out/store/system-models.repository';
import { ScanFailedError } from '#backend/app/system-model/scan-failed-error';
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
  const deps = () => ({
    noesis: t.noesis,
    changes: t.changesRepository,
    designDocs: t.designDocsRepository,
    now: () => NOW,
  });
  /** Scanners that only tell which one was picked. */
  const scanners: RepositoryScanners = {
    java: () => scannerOf(found('java')),
    'java-maven': () => scannerOf(found('java-maven')),
    csharp: () => scannerOf(found('csharp')),
    'code-model': () => scannerOf(found('code-model')),
  };
  const configure = (scanner: string) =>
    writeFile(join(t.root, 'noesis-config.json'), JSON.stringify({ scanner }));

  it('scans with the scanner noesis-config.json names, read at every scan', async () => {
    const scanner = createScanner(undefined, deps(), scanners);

    await configure('java');
    expect((await scanner.scan()).name).toBe('java');
    await configure('csharp');
    expect((await scanner.scan()).name).toBe('csharp');
  });

  it('refuses to scan a repository that names no scanner', async () => {
    const scanner = createScanner(undefined, deps(), scanners);

    await expect(scanner.scan()).rejects.toThrow(
      /noesis-config\.json names no scanner\. Set "scanner" to one of: java, java-maven, csharp, code-model\./,
    );
    await configure('cobol');
    await expect(scanner.scan()).rejects.toThrow('Invalid noesis-config.json');
  });

  it('replays design documents with the dummy when the environment forces it', async () => {
    await configure('java');

    expect(createScanner('dummy', deps(), scanners)).toBeInstanceOf(
      DummySourceCodeScanner,
    );
  });
});

describe('a scan that fails', () => {
  it("fails as a ScanFailedError carrying the scanner's reason", async () => {
    const scan = scanSystemModelHandler(
      {
        scan: () => Promise.reject(new Error('noesis-scan-csharp: not found')),
      },
      systemModels,
    );

    const failure = await scan.handle().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ScanFailedError);
    expect((failure as Error).message).toBe('noesis-scan-csharp: not found');
    expect(await systemModels.list()).toEqual([]);
  });
});
