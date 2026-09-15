import { readFile } from 'node:fs/promises';
import { basename, dirname, relative, sep } from 'node:path';
import type {
  ScannedBehaviour,
  ScannedBuildingBlock,
  ScannedDomainModule,
  SystemModel,
} from '@repo/shared-contracts';
import {
  excludeNestedUnits,
  type LanguageScanner,
  type ScanInput,
  type ScannedUnit,
  systemModelId,
} from '../../language-scanner.js';
import { typeOfName } from '../../shared/block-type.js';
import { walk } from '../../shared/walk.js';
import {
  type FoundType,
  packageOf,
  stereotypeOf,
  typesOf,
} from './java-source.js';

/*
 * The Java scanner: projects a checkout's Java into system-model files, one
 * per unit (a directory with a pom.xml or a build.gradle). Like the
 * TypeScript scanner it is primitive by design — regular expressions over
 * the source, no compilation — and detects DDD building blocks by the
 * stereotype annotations of `scanners/java/annotations`, falling back to the
 * shared name heuristic for classes without one. Relations between blocks
 * are the deeper scanner's job (scanners/java on ArchUnit).
 */

export const SCANNER_NAME = 'noesis-java';
export const SCANNER_VERSION = '0.1.0';

/** Directories never entered, at any depth: build outputs and tool caches. */
const SKIPPED_DIRS = new Set(['target', 'build', 'out', '.gradle']);

const UNIT_MANIFESTS = ['pom.xml', 'build.gradle', 'build.gradle.kts'];

/** Sources never scanned: tests, and the files that declare packages and modules rather than types. */
const IGNORED_FILES = new Set(['package-info.java', 'module-info.java']);
const TEST_SOURCE_ROOT = `${sep}src${sep}test${sep}`;

export const javaScanner: LanguageScanner = {
  name: SCANNER_NAME,
  version: SCANNER_VERSION,
  findUnits,
  findSources,
  scanUnit,
};

/**
 * Every directory holding a Maven or Gradle build file, sorted; named by the
 * Maven artifactId when there is a pom.xml, else by the directory. A
 * directory with both build files is one unit.
 */
export async function findUnits(root: string): Promise<ScannedUnit[]> {
  const manifests = await walk(
    root,
    (name) => UNIT_MANIFESTS.includes(name),
    SKIPPED_DIRS,
  );
  const units = new Map<string, ScannedUnit>();
  for (const path of manifests.sort((a, b) => a.localeCompare(b))) {
    const dir = dirname(path);
    const known = units.get(dir);
    if (known && basename(path) !== 'pom.xml') continue;
    units.set(dir, {
      dir,
      name:
        (basename(path) === 'pom.xml' ? await artifactIdOf(path) : null) ??
        basename(dir),
    });
  }
  return [...units.values()].sort((a, b) => a.dir.localeCompare(b.dir));
}

/** The main Java sources of one unit, excluding tests and nested units. */
export async function findSources(
  unit: ScannedUnit,
  allUnits: ScannedUnit[],
): Promise<string[]> {
  const files = await walk(
    unit.dir,
    (name) => name.endsWith('.java') && !IGNORED_FILES.has(name),
    SKIPPED_DIRS,
  );
  return excludeNestedUnits(
    unit,
    allUnits,
    files.filter((f) => !f.includes(TEST_SOURCE_ROOT)),
    sep,
  );
}

/**
 * Projects one unit into a system model. The unit is the bounded context;
 * the first package segment below the unit's common package prefix is the
 * domain module (`com.acme.orders.model` in a unit whose packages share
 * `com.acme` sits in `orders`); every top-level type, and every nested type
 * carrying a stereotype annotation, is a building block; its public methods
 * are behaviours. Ids are derived from names and paths, so a re-scan of
 * unchanged code yields the same ids and the same file.
 */
export async function scanUnit(
  unit: ScannedUnit,
  sources: string[],
  input: ScanInput,
): Promise<SystemModel> {
  const contextId = `bc:${unit.name}`;
  const files: ParsedFile[] = [];
  for (const file of sources) {
    const content = await readFile(file, 'utf8');
    files.push({
      path: relative(input.root, file).split(sep).join('/'),
      pkg: packageOf(content),
      types: typesOf(content),
    });
  }
  const prefixLength = commonPackagePrefix(
    files.map((f) => f.pkg).filter((p): p is string => p !== null),
  ).length;

  const modules = new Map<string, ScannedDomainModule>();
  const buildingBlocks: ScannedBuildingBlock[] = [];
  const behaviours: ScannedBehaviour[] = [];

  for (const file of files) {
    const segments = file.pkg?.split('.') ?? [];
    const moduleName = segments[prefixLength] ?? null;
    let moduleId: string | null = null;
    if (moduleName !== null) {
      moduleId = `mod:${unit.name}/${moduleName}`;
      if (!modules.has(moduleId)) {
        modules.set(moduleId, {
          id: moduleId,
          name: moduleName,
          boundedContextId: contextId,
          description: '',
          source: {
            path: moduleDir(file.path, segments.length - prefixLength - 1),
            line: null,
          },
        });
      }
    }

    for (const found of file.types.filter(isBuildingBlock)) {
      const blockId = `bb:${file.path}#${found.name}`;
      buildingBlocks.push({
        id: blockId,
        name: found.name,
        type: stereotypeOf(found.annotations) ?? typeOfName(found.name),
        boundedContextId: contextId,
        domainModuleId: moduleId,
        description: '',
        implements: found.implements,
        properties: [],
        source: { path: file.path, line: found.line },
      });
      for (const method of found.methods) {
        behaviours.push({
          id: `${blockId}.${method.name}`,
          name: method.name,
          type: null,
          buildingBlockId: blockId,
          useCaseId: null,
          description: '',
          scenarios: [],
          source: { path: file.path, line: method.line },
        });
      }
    }
  }

  // `implements` names a type by its simple name; keep only what resolves
  // to a block of this unit, as the block's id, so the file passes its own
  // integrity expectations.
  const idsByName = new Map<string, string>();
  for (const block of buildingBlocks) {
    if (!idsByName.has(block.name)) idsByName.set(block.name, block.id);
  }
  for (const block of buildingBlocks) {
    block.implements = block.implements
      .map((name) => idsByName.get(name))
      .filter((id): id is string => id !== undefined);
  }

  return {
    id: systemModelId(javaScanner, unit.name),
    name: unit.name,
    scanned_at: input.now(),
    scanner: { name: SCANNER_NAME, version: SCANNER_VERSION },
    boundedContexts: [
      {
        id: contextId,
        name: unit.name,
        description: '',
        source: {
          path: relative(input.root, unit.dir).split(sep).join('/') || '.',
          line: null,
        },
      },
    ],
    domainModules: [...modules.values()],
    buildingBlocks,
    behaviours,
  };
}

/* --------------------------------------------------------------- helpers */

interface ParsedFile {
  /** Relative to the repository root, `/`-separated. */
  path: string;
  pkg: string | null;
  types: FoundType[];
}

/** Top-level types always; nested ones only when a stereotype names them. */
function isBuildingBlock(found: FoundType): boolean {
  return found.topLevel || stereotypeOf(found.annotations) !== null;
}

/** The package segments every package of the unit starts with. */
export function commonPackagePrefix(packages: string[]): string[] {
  const [first, ...rest] = packages.map((p) => p.split('.'));
  if (first === undefined) return [];
  let prefix = first;
  for (const parts of rest) {
    let i = 0;
    while (i < prefix.length && prefix[i] === parts[i]) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix;
}

/** The module's directory: the file's directory, up as many levels as the package goes below the module. */
function moduleDir(path: string, levelsBelowModule: number): string {
  let dir = dirname(path);
  for (let i = 0; i < levelsBelowModule; i++) dir = dirname(dir);
  return dir;
}

const ARTIFACT_ID = /<artifactId>\s*([^<\s]+)\s*<\/artifactId>/;

/** The project's own artifactId — the one outside `<parent>` — or null when the pom has none. */
async function artifactIdOf(pomPath: string): Promise<string | null> {
  try {
    const pom = await readFile(pomPath, 'utf8');
    const ownProject = pom
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<parent>[\s\S]*?<\/parent>/, '')
      .replace(/<dependencies>[\s\S]*?<\/dependencies>/g, '')
      .replace(/<build>[\s\S]*?<\/build>/g, '');
    return ARTIFACT_ID.exec(ownProject)?.[1] ?? null;
  } catch {
    return null;
  }
}
