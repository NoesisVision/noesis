import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { ScannerSettingsFileRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import { SystemModelsFileRepository } from '#backend/adapters/out/store/system-models.repository';
import type { CodeParser } from '#backend/app/scanner/code-model/code-parser';
import { ScanFailedError } from '#backend/app/scanner/scan-failed-error';
import { scanSystemModelHandler } from '#backend/app/scanner/scan-system-model';
import {
  type CreateCodeParser,
  ScannerFactory,
} from '#backend/app/scanner/scanner-factory';
import type { CodeParserSettings } from '#backend/app/scanner/scanner-settings.repository';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { fixedClock } from '../support/fixed-clock';
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
  let picked: CodeParserSettings[];
  const parserFor: CreateCodeParser = (settings): CodeParser => {
    picked.push(settings);
    return { parse: () => Promise.reject(new Error('not parsed here')) };
  };
  const factory = () =>
    new ScannerFactory(
      new ScannerSettingsFileRepository(t.noesis),
      parserFor,
      { name: 'shop', headCommit: () => Promise.resolve(null) },
      fixedClock('2026-09-29T08:00:00.000Z'),
      { buildDiagnostics: () => {}, scanned: () => {} },
    );
  const configure = (settings: unknown) =>
    writeFile(t.noesis.resolve('settings.json'), JSON.stringify(settings));

  beforeEach(() => {
    picked = [];
  });

  it('picks the parser .noesis/settings.json names, read at every scan', async () => {
    const scanners = factory();

    await configure({ parser: { language: 'csharp' } });
    await scanners.create();
    await configure({ parser: { language: 'java', command: ['x'] } });
    await scanners.create();

    expect(picked.map(({ language }) => language)).toEqual(['csharp', 'java']);
  });

  it('hands the parser its own settings', async () => {
    await configure({
      parser: { language: 'java', command: ['x'], installHint: 'y' },
      namespacePartsToSkip: ['Acme'],
    });

    await factory().create();

    expect(picked).toEqual([
      { language: 'java', command: ['x'], installHint: 'y' },
    ]);
  });

  it('refuses a repository that names no parser, or names one wrongly', async () => {
    await expect(factory().create()).rejects.toThrow(
      /\.noesis\/settings\.json is missing\. Create it and set "parser": \{ "language": … \} with one of: csharp, java\./,
    );
    await configure({});
    await expect(factory().create()).rejects.toThrow(
      /\.noesis\/settings\.json names no parser\. Set "parser": \{ "language": … \} with one of: csharp, java\./,
    );
    for (const parser of [
      { language: 'dummy' },
      { language: 'java' },
      { language: 'java', command: [] },
    ]) {
      await configure({ parser });
      await expect(factory().create()).rejects.toThrow(
        /Invalid .*\.noesis\/settings\.json/,
      );
    }
    await configure({
      parser: { language: 'csharp' },
      namespacePartsToSkip: 'Acme',
    });
    await expect(factory().create()).rejects.toThrow(
      /Invalid .*\.noesis\/settings\.json/,
    );
  });

  it('refuses a key it does not know, at the top or in the parser', async () => {
    for (const settings of [
      { parser: { language: 'csharp' }, engine: 'hybrid' },
      { parser: { language: 'java', command: ['x'], instalHint: 'y' } },
      { parser: { language: 'csharp', command: ['x'] } },
    ]) {
      await configure(settings);
      await expect(factory().create()).rejects.toThrow(
        /Invalid .*\.noesis\/settings\.json[\s\S]*Unrecognized key/,
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
