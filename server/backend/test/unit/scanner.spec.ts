import { describe, expect, it } from 'bun:test';
import type {
  Language,
  ParseManifest,
} from '#backend/app/scanners/code-parsers/code-model';
import type { CodeParser } from '#backend/app/scanners/code-parsers/code-parser';
import type { FeatureFileSource } from '#backend/app/scanners/feature-files/feature-file';
import type { ScanLog, ScanSummary } from '#backend/app/scanners/scan-log';
import { Scanner } from '#backend/app/scanners/scanner';
import type { BuildDiagnostic } from '#backend/app/scanners/system-model-builders/build-system-model';
import { NamespaceConfig } from '#backend/app/scanners/system-model-builders/namespace-config';
import { SystemModelBuilder } from '#backend/app/scanners/system-model-builders/system-model-builder';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { fixedClock } from '../support/fixed-clock';
import { NOW } from './test-noesis';

/*
 * The scanner coordinates a scan: the parser reads the code model, the
 * builder makes the system model of it. The parsers and the builder have
 * their own specs; here the parser is a stub.
 */

const manifestIn = (language: Language): ParseManifest => ({
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
  const diagnostics: BuildDiagnostic[] = [];
  const log: ScanLog = {
    buildDiagnostics: (found) => diagnostics.push(...found),
    scanned: (summary) => summaries.push(summary),
  };
  return { log, summaries, diagnostics };
};

const scannerWith = (
  parser: CodeParser,
  log: ScanLog = recordingLog().log,
  featureFiles: FeatureFileSource[] = [],
) =>
  new Scanner({
    parser,
    builder: new SystemModelBuilder(NamespaceConfig.of({})),
    repository: {
      name: 'shop',
      headCommit: () => Promise.resolve('7ba8217'),
      featureFiles: () => Promise.resolve(featureFiles),
    },
    clock: fixedClock(NOW),
    log,
  });

describe('Scanner', () => {
  it('stamps the model the builder made with a fresh id, the repository and the time', async () => {
    const model = SystemModel.parse(await scannerWith(parserOf('java')).scan());

    expect<unknown>(SystemModelId.safeParse(model.id).success).toBe(true);
    expect<unknown>(model).toMatchObject({
      name: 'shop',
      scanned_at: NOW,
      commit: '7ba8217',
      modules: [],
      buildingBlocks: [],
      behaviors: [],
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
        behaviors: 0,
        rules: 0,
      }),
    ]);
  });

  it("hands the repository's feature files to the builder beside the code model", async () => {
    const { log, diagnostics } = recordingLog();
    const feature = {
      path: 'features/orders.feature',
      text: 'Feature: Orders\n  @validation\n  Rule: Non-empty order\n    Scenario: Refused\n      When the customer places the order\n',
    };

    const model = await scannerWith(parserOf('java'), log, [feature]).scan();

    expect<unknown>(model.rules).toEqual([]);
    expect<unknown>(diagnostics.map(({ source }) => source)).toContainEqual({
      path: 'features/orders.feature',
      line: 4,
    });
  });

  it('refuses a code model in a language the builder has no vocabulary for', async () => {
    await expect<unknown>(scannerWith(parserOf('php')).scan()).rejects.toThrow(
      'no annotation vocabulary for php',
    );
  });

  it('fails with the parser and logs no scan', async () => {
    const { log, summaries } = recordingLog();
    const failing: CodeParser = {
      parse: () => Promise.reject(new Error('noesis-parse-csharp: not found')),
    };

    await expect<unknown>(scannerWith(failing, log).scan()).rejects.toThrow(
      'noesis-parse-csharp: not found',
    );
    expect<unknown>(summaries).toEqual([]);
  });
});
