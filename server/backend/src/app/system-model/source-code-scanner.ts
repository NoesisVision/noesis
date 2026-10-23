import type { SystemModel } from './system-model';

/** Reads a codebase and tells what it implements, at an id it mints. */
export interface SourceCodeScanner {
  scan(): Promise<SystemModel>;
}

/**
 * Picks the scanner for one scan. Asked at every scan, so a changed setting
 * counts without a restart.
 */
export interface SourceCodeScannerFactory {
  create(): Promise<SourceCodeScanner>;
}
