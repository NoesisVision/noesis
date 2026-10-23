import type { BuildDiagnostic } from '#backend/app/scanner/code-model/system-model-builder/build-system-model';
import type { ScanLog, ScanSummary } from '#backend/app/scanner/scan-log';
import { serverLogger } from '#backend/platform/logging/logging';

/** A scan's report in the service log, under the `scanner` category. */
export class ServerScanLog implements ScanLog {
  private readonly log = serverLogger('scanner');

  buildDiagnostics(diagnostics: readonly BuildDiagnostic[]): void {
    for (const { level, message, source } of diagnostics) {
      const where = source === null ? '' : ` ({path}:{line})`;
      this.log[level](`${message}${where}`, {
        path: source?.path,
        line: source?.line,
      });
    }
  }

  scanned(summary: ScanSummary): void {
    this.log.info(
      'Scanned {name}: {artifacts} {language} artifacts in {parseMs} ms, built {blocks} building blocks and {behaviours} behaviours in {buildMs} ms',
      { ...summary },
    );
  }
}
