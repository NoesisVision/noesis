import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { DummySourceCodeScanner } from '#backend/adapters/out/scanners/dummy.scanner';
import {
  type RepositoryScanners,
  ScannerFactory,
} from '#backend/adapters/out/scanners/scanner-factory';
import { NoesisSystemModelsRepository } from '#backend/adapters/out/store/system-models.repository';
import { ScanFailedError } from '#backend/app/system-model/scan-failed-error';
import { scanSystemModelHandler } from '#backend/app/system-model/scan-system-model';
import type {
  SourceCodeScanner,
  SourceCodeScannerFactory,
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

const found = (name: string): SystemModel =>
  SystemModel.parse({
    id: SystemModelId.mint(),
    name,
    scanned_at: '2026-09-29T08:00:00.000Z',
  });

const scannerOf = (model: SystemModel): SourceCodeScanner => ({
  scan: () => Promise.resolve(model),
});

/** A factory that always picks `scanner`. */
const always = (scanner: SourceCodeScanner): SourceCodeScannerFactory => ({
  create: () => Promise.resolve(scanner),
});

describe('Scanning the system model', () => {
  it('stores what the scanner finds and answers with it', async () => {
    const shop = found('shop');
    const scan = scanSystemModelHandler(always(scannerOf(shop)), systemModels);

    const model = await scan.handle();

    expect(model).toEqual(shop);
    expect(await systemModels.list()).toEqual([shop]);
  });

  it('keeps every scan, the last one newest', async () => {
    await scanSystemModelHandler(
      always(scannerOf(found('before'))),
      systemModels,
    ).handle();
    const last = await scanSystemModelHandler(
      always(scannerOf(found('after'))),
      systemModels,
    ).handle();

    expect((await systemModels.list()).map(({ name }) => name)).toEqual([
      'before',
      'after',
    ]);
    expect(await systemModels.findNewest()).toEqual(last);
  });
});

describe('ScannerFactory', () => {
  const deps = () => ({
    noesis: t.noesis,
    changes: t.changesRepository,
    designDocs: t.designDocsRepository,
    now: () => NOW,
  });
  /** Scanners that only tell which one was picked. */
  const scanners: RepositoryScanners = {
    java: () => scannerOf(found('java')),
    csharp: () => scannerOf(found('csharp')),
  };
  const factory = (env: NodeJS.ProcessEnv = {}) =>
    new ScannerFactory(deps(), env, scanners);
  const configure = (settings: unknown) =>
    writeFile(t.noesis.resolve('settings.json'), JSON.stringify(settings));
  const scanWith = async (scanners: SourceCodeScannerFactory) =>
    (await scanners.create()).scan();

  it('picks the scanner .noesis/settings.json names, read at every scan', async () => {
    const scanners = factory();

    await configure({ scanner: 'java' });
    expect((await scanWith(scanners)).name).toBe('java');
    await configure({ scanner: 'csharp' });
    expect((await scanWith(scanners)).name).toBe('csharp');
  });

  it('hands the repository scanner the namespace settings', async () => {
    let namespaces: unknown;
    const spying = new ScannerFactory(
      deps(),
      {},
      {
        ...scanners,
        csharp: (built) => {
          namespaces = built.namespaces.modulePathOf('Acme.Shop.Orders');
          return scannerOf(found('csharp'));
        },
      },
    );
    await configure({ scanner: 'csharp', namespacePartsToSkip: ['Acme'] });

    await spying.create();

    expect(namespaces).toEqual(['Shop', 'Orders']);
  });

  it('refuses a repository that names no scanner, or names one wrongly', async () => {
    await expect(factory().create()).rejects.toThrow(
      /\.noesis\/settings\.json names no scanner\. Set "scanner" to one of: java, csharp\./,
    );
    await configure({ scanner: 'cobol' });
    await expect(factory().create()).rejects.toThrow(
      /Invalid .*\.noesis\/settings\.json/,
    );
    await configure({ scanner: 'csharp', namespacePartsToSkip: 'Acme' });
    await expect(factory().create()).rejects.toThrow(
      /Invalid .*\.noesis\/settings\.json/,
    );
  });

  it('picks the dummy when NOESIS_SCANNER=dummy, whatever the repository names', async () => {
    await configure({ scanner: 'java' });

    expect(await factory({ NOESIS_SCANNER: 'dummy' }).create()).toBeInstanceOf(
      DummySourceCodeScanner,
    );
  });

  it('rejects any other NOESIS_SCANNER: the repository names its own scanner', async () => {
    for (const name of ['java', 'csharp', 'cobol']) {
      await expect(factory({ NOESIS_SCANNER: name }).create()).rejects.toThrow(
        'NOESIS_SCANNER',
      );
    }
  });
});

describe('a scan that fails', () => {
  it("fails as a ScanFailedError carrying the scanner's reason", async () => {
    const scan = scanSystemModelHandler(
      always({
        scan: () => Promise.reject(new Error('noesis-scan-csharp: not found')),
      }),
      systemModels,
    );

    const failure = await scan.handle().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ScanFailedError);
    expect((failure as Error).message).toBe('noesis-scan-csharp: not found');
    expect(await systemModels.list()).toEqual([]);
  });

  it('fails as a ScanFailedError when no scanner can be picked', async () => {
    const scan = scanSystemModelHandler(
      { create: () => Promise.reject(new Error('names no scanner')) },
      systemModels,
    );

    await expect(scan.handle()).rejects.toBeInstanceOf(ScanFailedError);
  });
});
