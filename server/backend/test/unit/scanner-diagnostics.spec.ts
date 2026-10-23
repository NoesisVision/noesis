import { describe, expect, it } from 'bun:test';
import { scannerDiagnostics } from '#backend/adapters/out/scanner/parsers/command-code-parser';
import type {
  CodeModelFile,
  Diagnostic,
  ScanManifest,
} from '#backend/app/scanner/code-model/code-model';

/*
 * What the service logs of the diagnostics a scanner wrote: a module the
 * engine failed on still gets a file, so without these lines it would only be
 * missing from the system model.
 */

const diagnostic = (overrides: Partial<Diagnostic>): Diagnostic => ({
  severity: 'error',
  code: 'NS1001',
  message: 'Module app could not be scanned: boom',
  location: null,
  source: 'scanner',
  ...overrides,
});

const file = (name: string, diagnostics: Diagnostic[]): CodeModelFile =>
  ({ artifact: { name }, diagnostics }) as unknown as CodeModelFile;

const manifest = (diagnostics: Diagnostic[]): ScanManifest =>
  ({ diagnostics }) as unknown as ScanManifest;

describe('scannerDiagnostics', () => {
  it("logs each of the scanner's own errors and warnings with the artifact", () => {
    const lines = scannerDiagnostics(manifest([]), [
      file('app', [
        diagnostic({}),
        diagnostic({
          severity: 'warning',
          code: 'NS1009',
          message: 'Release 25 is newer than the running JDK 21',
        }),
      ]),
    ]);

    expect(lines).toEqual([
      {
        level: 'error',
        message: 'app: NS1001 Module app could not be scanned: boom',
      },
      {
        level: 'warning',
        message: 'app: NS1009 Release 25 is newer than the running JDK 21',
      },
    ]);
  });

  it('logs the manifest diagnostics without an artifact', () => {
    expect(
      scannerDiagnostics(
        manifest([diagnostic({ message: 'No Java module to scan.' })]),
        [],
      ),
    ).toEqual([{ level: 'error', message: 'NS1001 No Java module to scan.' }]);
  });

  it("counts the compiler's diagnostics per artifact in one line, with the first error and where it is", () => {
    const location = {
      file: 'app/src/main/java/A.java',
      startLine: 3,
      startColumn: 5,
      endLine: 3,
      endColumn: 9,
    };
    const lines = scannerDiagnostics(manifest([]), [
      file('app', [
        diagnostic({
          source: 'compiler',
          severity: 'warning',
          code: 'compiler.warn.x',
          message: 'w',
        }),
        diagnostic({
          source: 'compiler',
          code: 'compiler.err.cant.resolve',
          message: 'cannot find symbol {x}',
          location,
        }),
        diagnostic({
          source: 'compiler',
          code: 'compiler.err.other',
          message: 'e2',
        }),
      ]),
    ]);

    expect(lines).toEqual([
      {
        level: 'error',
        message:
          'app: the compiler reported 2 errors and 1 warnings; first: compiler.err.cant.resolve cannot find symbol {x} (app/src/main/java/A.java:3)',
      },
    ]);
  });

  it('leaves info out: unbound sites and missing parameter names are not news', () => {
    expect(
      scannerDiagnostics(manifest([]), [
        file('app', [
          diagnostic({ severity: 'info', code: 'NS1002' }),
          diagnostic({ severity: 'info', code: 'NS1006' }),
        ]),
      ]),
    ).toEqual([]);
  });
});
