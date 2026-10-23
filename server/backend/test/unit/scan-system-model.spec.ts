import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { ScannerSettingsFileRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import { SystemModelsFileRepository } from '#backend/adapters/out/store/system-models.repository';
import type { CodeParser } from '#backend/app/scanner/code-model/code-parser';
import { ScanFailedError } from '#backend/app/scanner/system-model/scan-failed-error';
import {
  type Scanners,
  scanSystemModelHandler,
} from '#backend/app/scanner/system-model/scan-system-model';
import {
  type CodeParsers,
  ScannerFactory,
} from '#backend/app/scanner/system-model/scanner-factory';
import type { RepositorySettings } from '#backend/app/scanner/system-model/scanner-settings.repository';
import type { SourceCodeScanner } from '#backend/app/scanner/system-model/source-code-scanner';
import { SystemModel } from '#backend/app/scanner/system-model/system-model';
import { SystemModelId } from '#backend/app/scanner/system-model/system-model-id';
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

type Scanner = Pick<SourceCodeScanner, 'scan'>;

const scannerOf = (model: SystemModel): Scanner => ({
  scan: () => Promise.resolve(model),
});

/** A factory that always picks `scanner`. */
const always = (scanner: Scanner): Scanners => ({
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

    await configure({ scanner: 'csharp' });
    await scanners.create();
    await configure({ scanner: 'code-model', codeModel: { command: ['x'] } });
    await scanners.create();

    expect(picked.map(({ name }) => name)).toEqual(['csharp', 'code-model']);
  });

  it('hands the parser the repository settings', async () => {
    await configure({ scanner: 'csharp', namespacePartsToSkip: ['Acme'] });

    await factory().create();

    expect(
      picked[0]?.settings.namespaces.modulePathOf('Acme.Shop.Orders'),
    ).toEqual(['Shop', 'Orders']);
  });

  it('refuses a repository that names no scanner, or names one wrongly', async () => {
    await expect(factory().create()).rejects.toThrow(
      /\.noesis\/settings\.json names no scanner\. Set "scanner" to one of: csharp, code-model\./,
    );
    for (const scanner of ['java', 'dummy', 'cobol']) {
      await configure({ scanner });
      await expect(factory().create()).rejects.toThrow(
        /Invalid .*\.noesis\/settings\.json/,
      );
    }
    await configure({ scanner: 'csharp', namespacePartsToSkip: 'Acme' });
    await expect(factory().create()).rejects.toThrow(
      /Invalid .*\.noesis\/settings\.json/,
    );
  });

  it('refuses a file written for the Java presets the service no longer has, saying how to move', async () => {
    for (const settings of [
      { scanner: 'java-maven' },
      { scanner: 'java-gradle' },
      {
        scanner: 'code-model',
        codeModel: { command: ['x'] },
        engine: 'hybrid',
      },
    ]) {
      await configure(settings);
      await expect(factory().create()).rejects.toThrow(
        /(no longer has|no scanner reads any more)[\s\S]*"scanner": "code-model"/,
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
