import { describe, expect, it } from 'bun:test';
import type {
  Language,
  ScanManifest,
} from '#backend/app/code-model/code-model';
import type { CodeParser } from '#backend/app/code-model/code-parser';
import { NamespaceConfig } from '#backend/app/code-model/system-model-builder/namespace-config';
import { SystemModelBuilder } from '#backend/app/code-model/system-model-builder/system-model-builder';
import type { ScanLog, ScanSummary } from '#backend/app/system-model/scan-log';
import { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { NOW } from './test-noesis';

/*
 * The scanner coordinates a scan: the parser reads the code model, the
 * builder makes the system model of it. The parsers and the builder have
 * their own specs; here the parser is a stub.
 */

const manifestIn = (language: Language): ScanManifest => ({
  schemaVersion: 1,
  generator: { name: 'spec', version: '0' },
  language,
  repository: { name: 'shop', revision: 'none' },
  root: '',
  artifacts: [],
  diagnostics: [],
});

const parserOf = (language: Language): CodeParser => ({
  parse: () => Promise.resolve({ manifest: manifestIn(language), files: [] }),
});

const recordingLog = () => {
  const summaries: ScanSummary[] = [];
  const log: ScanLog = {
    buildDiagnostics: () => {},
    scanned: (summary) => summaries.push(summary),
  };
  return { log, summaries };
};

const scannerWith = (parser: CodeParser, log: ScanLog = recordingLog().log) =>
  new SourceCodeScanner({
    parser,
    builder: new SystemModelBuilder(NamespaceConfig.of({})),
    repository: { name: 'shop', headCommit: () => Promise.resolve('7ba8217') },
    now: () => NOW,
    log,
  });

describe('SourceCodeScanner', () => {
  it('stamps the model the builder made with a fresh id, the repository and the time', async () => {
    const model = SystemModel.parse(await scannerWith(parserOf('java')).scan());

    expect<unknown>(SystemModelId.safeParse(model.id).success).toBe(true);
    expect<unknown>(model).toMatchObject({
      name: 'shop',
      scanned_at: NOW,
      commit: '7ba8217',
      modules: [],
      buildingBlocks: [],
      behaviours: [],
    });
  });

  it('reports what it scanned to the log', async () => {
    const { log, summaries } = recordingLog();

    await scannerWith(parserOf('csharp'), log).scan();

    expect<unknown>(summaries).toEqual([
      expect.objectContaining({
        name: 'shop',
        language: 'csharp',
        artifacts: 0,
        blocks: 0,
        behaviours: 0,
      }),
    ]);
  });

  it('refuses a code model in a language the builder has no vocabulary for', async () => {
    await expect<unknown>(scannerWith(parserOf('php')).scan()).rejects.toThrow(
      'no annotation vocabulary for php',
    );
  });

  it('fails with the parser and logs no scan', async () => {
    const { log, summaries } = recordingLog();
    const failing: CodeParser = {
      parse: () => Promise.reject(new Error('noesis-scan-csharp: not found')),
    };

    await expect<unknown>(scannerWith(failing, log).scan()).rejects.toThrow(
      'noesis-scan-csharp: not found',
    );
    expect<unknown>(summaries).toEqual([]);
  });
});
