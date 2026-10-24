import type { Clock } from '#backend/app/clock';
import type {
  CodeParser,
  ParsedCode,
} from '#backend/app/scanner/code-model/code-parser';
import type { BuiltSystemModel } from '#backend/app/scanner/code-model/system-model-builder/build-system-model';
import type { SystemModelBuilder } from '#backend/app/scanner/code-model/system-model-builder/system-model-builder';
import type { SystemModel } from '#backend/app/scanner/system-model/system-model';
import { SystemModelId } from '#backend/app/scanner/system-model/system-model-id';
import type { ScanLog } from './scan-log';
import type { SourceRepository } from './source-repository';

export interface ScannerDeps {
  readonly parser: CodeParser;
  readonly builder: SystemModelBuilder;
  readonly repository: SourceRepository;
  readonly clock: Clock;
  readonly log: ScanLog;
}

/**
 * Reads a codebase and tells what it implements, in two stages: the parser
 * reads the source code into the code model, the builder makes the system
 * model of it. Rules in docs/plans/code-model-to-system-model.md.
 */
export class Scanner {
  private readonly parser: CodeParser;
  private readonly builder: SystemModelBuilder;
  private readonly repository: SourceRepository;
  private readonly clock: Clock;
  private readonly log: ScanLog;

  constructor({ parser, builder, repository, clock, log }: ScannerDeps) {
    this.parser = parser;
    this.builder = builder;
    this.repository = repository;
    this.clock = clock;
    this.log = log;
  }

  /** Mints the id as the scan starts, so the newest scan has the highest id. */
  async scan(): Promise<SystemModel> {
    const id = SystemModelId.mint();
    const scannedAt = this.clock.now();
    const commit = await this.repository.headCommit();
    const parsed = await timed(() => this.parser.parse());
    const built = await timed(async () => this.builder.build(parsed.result));
    this.report(parsed, built);
    return {
      id,
      name: this.repository.name,
      scanned_at: scannedAt,
      commit,
      ...built.result.model,
    };
  }

  private report(
    parsed: Timed<ParsedCode>,
    built: Timed<BuiltSystemModel>,
  ): void {
    const { manifest, files } = parsed.result;
    const { model, diagnostics } = built.result;
    this.log.buildDiagnostics(diagnostics);
    this.log.scanned({
      name: this.repository.name,
      language: manifest.language,
      artifacts: files.length,
      parseMs: parsed.ms,
      blocks: model.buildingBlocks.length,
      behaviours: model.behaviours.length,
      buildMs: built.ms,
    });
  }
}

interface Timed<T> {
  readonly result: T;
  readonly ms: number;
}

async function timed<T>(step: () => Promise<T>): Promise<Timed<T>> {
  const started = performance.now();
  const result = await step();
  return { result, ms: Math.round(performance.now() - started) };
}
