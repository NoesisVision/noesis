import type { SystemModel } from './system-model';

/** What a scanner finds; the server gives it its id. */
export type ScannedSystemModel = Omit<SystemModel, 'id'>;

/** Reads a codebase and tells what it implements. */
export interface SourceCodeScanner {
  scan(): Promise<ScannedSystemModel>;
}
