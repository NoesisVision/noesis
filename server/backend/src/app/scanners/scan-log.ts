import type { Language } from '#backend/app/scanners/code-parsers/code-model';
import type { BuildDiagnostic } from '#backend/app/scanners/system-model-builders/build-system-model';

export interface ScanSummary {
  readonly name: string;
  readonly language: Language;
  readonly artifacts: number;
  readonly parseMs: number;
  readonly blocks: number;
  readonly behaviours: number;
  readonly buildMs: number;
}

/** Where a scan reports what it dropped on the way and what it found. */
export interface ScanLog {
  buildDiagnostics(diagnostics: readonly BuildDiagnostic[]): void;
  scanned(summary: ScanSummary): void;
}
