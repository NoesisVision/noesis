import type { SystemModel } from './system-model';

/** Reads a codebase and tells what it implements. */
export interface SourceCodeScanner {
  scan(): Promise<SystemModel>;
}
