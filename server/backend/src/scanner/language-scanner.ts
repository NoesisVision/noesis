import type { SystemModel } from '@repo/shared-contracts';
import { contentHashAsUuid } from '../ids/uuid.js';

/*
 * One scanner per language, all sharing the pipeline the service runs:
 * find the units a language defines (a package.json, a pom.xml), list each
 * unit's sources, project a unit into a system model. The service knows
 * nothing about languages; a repository with several of them is scanned by
 * every scanner that finds units in it, and each writes its own files.
 */

export interface ScannedUnit {
  /** The unit's directory, absolute. */
  dir: string;
  /** The unit's name: the manifest's name, else the directory name. */
  name: string;
}

export interface ScanInput {
  /** The repository root; every `source.path` is relative to it. */
  root: string;
  /** When the scan ran, ISO 8601. Injected so ids and output are testable. */
  now: () => string;
}

export interface LanguageScanner {
  /** Recorded as `scanner.name` in every file this scanner writes. */
  readonly name: string;
  readonly version: string;
  /** Every unit of this language under the root, sorted by directory. */
  findUnits(root: string): Promise<ScannedUnit[]>;
  /** The source files of one unit, excluding those of nested units. */
  findSources(unit: ScannedUnit, allUnits: ScannedUnit[]): Promise<string[]>;
  /** Projects one unit into a system model; a unit with no sources is never passed. */
  scanUnit(
    unit: ScannedUnit,
    sources: string[],
    input: ScanInput,
  ): Promise<SystemModel>;
}

/**
 * The id of a unit's system-model file: stable across scans, and distinct
 * between languages so a Maven module and an npm package sharing a name do
 * not overwrite each other's file.
 */
export function systemModelId(scanner: LanguageScanner, unitName: string) {
  return contentHashAsUuid(`system-model:${scanner.name}:${unitName}`);
}

/** The source files of `unit` among `files`, minus those under a nested unit. */
export function excludeNestedUnits(
  unit: ScannedUnit,
  allUnits: ScannedUnit[],
  files: string[],
  sep: string,
): string[] {
  const nested = allUnits
    .filter((u) => u.dir !== unit.dir && u.dir.startsWith(unit.dir + sep))
    .map((u) => u.dir + sep);
  return files
    .filter((f) => !nested.some((n) => f.startsWith(n)))
    .sort((a, b) => a.localeCompare(b));
}
