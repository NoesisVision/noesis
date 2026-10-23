import type { SystemModel } from './system-model';

/** Reads a codebase and tells what it implements, at an id it mints. */
export interface SourceCodeScanner {
  scan(): Promise<SystemModel>;
}
