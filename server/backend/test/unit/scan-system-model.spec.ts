import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { ScannerSettingsFileRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import { SystemModelsFileRepository } from '#backend/adapters/out/store/system-models.repository';
import type { CodeParser } from '#backend/app/scanner/code-model/code-parser';
import { ScanFailedError } from '#backend/app/scanner/scan-failed-error';
import { scanSystemModelHandler } from '#backend/app/scanner/scan-system-model';
import {
  type CodeParsers,
  ScannerFactory,
} from '#backend/app/scanner/scanner-factory';
import type { RepositorySettings } from '#backend/app/scanner/scanner-settings.repository';
import { SystemModel } from '#backend/app/scanner/system-model/system-model';
import { SystemModelId } from '#backend/app/scanner/system-model/system-model-id';
import { type FakeScanner, fakeScannerFactory } from '../support/test-scanner';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let systemModels: SystemModelsFileRepository;

beforeEach(async () => {
  t = await testNoesis();
  systemModels = new SystemModelsFileRepository(t.noesis);
});

afterEach(() => t.cleanup());

const found = (
  name: string,
  scannedAt = '2026-09-29T08:00:00.000Z',
): SystemModel =>
  SystemModel.parse({ id: SystemModelId.mint(), name, scanned_at: scannedAt });

const scannerOf = (model: SystemModel): FakeScanner => ({
  scan: () => Promise.resolve(model),
});

/** A factory that always picks `scanner`. */
const always = (scanner: FakeScanner): ScannerFactory =>
  fakeScannerFactory(() => Promise.resolve(scanner));

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
      always(scannerOf(found('after', '2026-09-29T08:01:00.000Z'))),
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
  /** Parsers that only tell which one was picked, and with what settings. */
  let picked: { name: string; settings: RepositorySettings }[];
  const parserOf =
    (name: string) =>
    (settings: RepositorySettings): CodeParser => {
      picked.push({ name, settings });
      return { parse: () => Promise.reject(new Error('not parsed here')) };
    };
  const parsers: CodeParsers = {
    csharp: parserOf('csharp'),
    'code-model': parserOf('code-model'),
  };
  const factory = () =>
    new ScannerFactory(new ScannerSettingsFileRepository(t.noesis), parsers, {
      repository: { name: 'shop', headCommit: () => Promise.resolve(null) },
      now: () => '2026-09-29T08:00:00.000Z',
      log: { buildDiagnostics: () => {}, scanned: () => {} },
    });
  const configure = (settings: unknown) =>
    writeFile(t.noesis.resolve('settings.json'), JSON.stringify(settings));

  beforeEach(() => {
    picked = [];
  });

  it('picks the parser .noesis/settings.json names, read at every scan', async () => {
    const scanners = factory();

    await configure({ parser: 'csharp' });
    await scanners.create();
    await configure({ parser: 'code-model', codeModel: { command: ['x'] } });
    await scanners.create();

    expect(picked.map(({ name }) => name)).toEqual(['csharp', 'code-model']);
  });

  it('hands the parser the repository settings', async () => {
    await configure({ parser: 'csharp', namespacePartsToSkip: ['Acme'] });

    await factory().create();

    expect(
      picked[0]?.settings.namespaces.modulePathOf('Acme.Shop.Orders'),
    ).toEqual(['Shop', 'Orders']);
  });

  it('refuses a repository that names no parser, or names one wrongly', async () => {
    await expect(factory().create()).rejects.toThrow(
      /\.noesis\/settings\.json names no parser\. Set "parser" to one of: csharp, code-model\./,
    );
    for (const parser of ['java', 'dummy', 'cobol']) {
      await configure({ parser });
      await expect(factory().create()).rejects.toThrow(
        /Invalid .*\.noesis\/settings\.json/,
      );
    }
    await configure({ parser: 'csharp', namespacePartsToSkip: 'Acme' });
    await expect(factory().create()).rejects.toThrow(
      /Invalid .*\.noesis\/settings\.json/,
    );
  });

  it('refuses a file that still names its parser under "scanner", saying what to rename', async () => {
    await configure({ scanner: 'csharp' });
    await expect(factory().create()).rejects.toThrow(
      /sets "scanner", which is now "parser"/,
    );
  });

  it('refuses a file written for the Java presets the service no longer has, saying how to move', async () => {
    for (const settings of [
      { scanner: 'java-maven' },
      { scanner: 'java-gradle' },
      {
        parser: 'code-model',
        codeModel: { command: ['x'] },
        engine: 'hybrid',
      },
    ]) {
      await configure(settings);
      await expect(factory().create()).rejects.toThrow(
        /(no longer has|no parser reads any more)[\s\S]*"parser": "code-model"/,
      );
    }
  });
});

describe('a scan that fails', () => {
  it("fails as a ScanFailedError carrying the scanner's reason", async () => {
    const scan = scanSystemModelHandler(
      always({
        scan: () => Promise.reject(new Error('noesis-parse-csharp: not found')),
      }),
      systemModels,
    );

    const failure = await scan.handle().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ScanFailedError);
    expect((failure as Error).message).toBe('noesis-parse-csharp: not found');
    expect(await systemModels.list()).toEqual([]);
  });

  it('fails as a ScanFailedError when no scanner can be picked', async () => {
    const scan = scanSystemModelHandler(
      fakeScannerFactory(() => Promise.reject(new Error('names no parser'))),
      systemModels,
    );

    await expect(scan.handle()).rejects.toBeInstanceOf(ScanFailedError);
  });
});
