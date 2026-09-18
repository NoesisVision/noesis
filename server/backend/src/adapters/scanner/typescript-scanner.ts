import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { contentHashAsUuid } from '../../platform/crypto/content-hash.js';
import type {
  DesignedBuildingBlockType,
  ScannedBehaviour,
  ScannedBuildingBlock,
  ScannedDomainModule,
  SystemModel,
} from '../../shared/contracts/index.js';

/*
 * The TypeScript scanner: reads a checkout and projects what it finds into
 * system-model files, one per unit (a directory with a package.json). The
 * migration's R7 fixes the pipeline — units, files, ids, output shape — and
 * deliberately not the language coverage: extraction is line-based (exported
 * classes and their public methods), good enough to give a design document
 * real building blocks to name, and to be replaced by a real parser without
 * moving anything around it.
 */

export const SCANNER_NAME = 'noesis-typescript';
export const SCANNER_VERSION = '0.1.0';

/** Directories never entered, at any depth. */
const SKIPPED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'ui',
  '.noesis',
]);

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const IGNORED_SUFFIXES = ['.d.ts', '.spec.ts', '.test.ts', '.bench.spec.ts'];

export interface ScannedUnit {
  /** The unit's directory, absolute. */
  dir: string;
  /** The package name, or the directory name when package.json has none. */
  name: string;
}

export interface ScanInput {
  /** The repository root; every `source.path` is relative to it. */
  root: string;
  /** When the scan ran, ISO 8601. Injected so ids and output are testable. */
  now: () => string;
}

/** Every directory holding a package.json, outside the skipped directories, sorted. */
export async function findUnits(root: string): Promise<ScannedUnit[]> {
  const units: ScannedUnit[] = [];
  for (const path of await walk(root, (name) => name === 'package.json')) {
    const dir = dirname(path);
    let name = basename(dir);
    try {
      const manifest = JSON.parse(await readFile(path, 'utf8')) as {
        name?: unknown;
      };
      if (typeof manifest.name === 'string' && manifest.name !== '') {
        name = manifest.name;
      }
    } catch {
      // An unreadable manifest still marks a unit; the directory names it.
    }
    units.push({ dir, name });
  }
  return units.sort((a, b) => a.dir.localeCompare(b.dir));
}

/** The source files of one unit, excluding those of nested units. */
export async function findSources(
  unit: ScannedUnit,
  allUnits: ScannedUnit[],
): Promise<string[]> {
  const nested = allUnits
    .filter((u) => u.dir !== unit.dir && u.dir.startsWith(unit.dir + sep))
    .map((u) => u.dir + sep);
  const files = await walk(
    unit.dir,
    (name) =>
      SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext)) &&
      !IGNORED_SUFFIXES.some((suffix) => name.endsWith(suffix)),
  );
  return files.filter((f) => !nested.some((n) => f.startsWith(n))).sort();
}

/**
 * Projects one unit into a system model. The unit is the bounded context;
 * the first directory under `src/` (or under the unit) is the domain module;
 * every exported class is a building block and each of its public methods a
 * behaviour. Ids are derived from names and paths, so a re-scan of unchanged
 * code yields the same ids and the same file.
 */
export async function scanUnit(
  unit: ScannedUnit,
  sources: string[],
  input: ScanInput,
): Promise<SystemModel> {
  const contextId = `bc:${unit.name}`;
  const modules = new Map<string, ScannedDomainModule>();
  const buildingBlocks: ScannedBuildingBlock[] = [];
  const behaviours: ScannedBehaviour[] = [];

  for (const file of sources) {
    const path = relative(input.root, file).split(sep).join('/');
    const moduleName = moduleOf(relative(unit.dir, file).split(sep).join('/'));
    let moduleId: string | null = null;
    if (moduleName !== null) {
      moduleId = `mod:${unit.name}/${moduleName}`;
      if (!modules.has(moduleId)) {
        modules.set(moduleId, {
          id: moduleId,
          name: moduleName,
          boundedContextId: contextId,
          description: '',
          source: { path: dirnameOf(path, moduleName), line: null },
        });
      }
    }

    const lines = (await readFile(file, 'utf8')).split('\n');
    for (const found of exportedClasses(lines)) {
      const blockId = `bb:${path}#${found.name}`;
      buildingBlocks.push({
        id: blockId,
        name: found.name,
        type: typeOf(found.name),
        boundedContextId: contextId,
        domainModuleId: moduleId,
        description: '',
        implements: found.implements.map((name) => `bb:${path}#${name}`),
        properties: [],
        source: { path, line: found.line },
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
          source: { path, line: method.line },
        });
      }
    }
  }

  // `implements` may name a class outside this unit or an interface; keep
  // only what resolves, so the file passes its own integrity expectations.
  const known = new Set(buildingBlocks.map((b) => b.id));
  for (const block of buildingBlocks) {
    block.implements = block.implements.filter((id) => known.has(id));
  }

  return {
    id: contentHashAsUuid(`system-model:${unit.name}`),
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

/* ------------------------------------------------------------- extraction */

interface FoundClass {
  name: string;
  line: number;
  implements: string[];
  methods: { name: string; line: number }[];
}

const CLASS_LINE =
  /^export\s+(?:abstract\s+)?class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+[\w.<>, ]+)?(?:\s+implements\s+([\w.<>, ]+))?\s*\{?/;
const METHOD_LINE =
  /^ {2}(?:(?:public|static|override|async|readonly)\s+)*(?!constructor\b|private\b|protected\b|get\b|set\b|if\b|for\b|while\b|switch\b|return\b)(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)?/;
const RESERVED_MEMBERS = new Set(['constructor']);

/** Exported classes with their public methods, from one file's lines. */
export function exportedClasses(lines: string[]): FoundClass[] {
  const found: FoundClass[] = [];
  let current: FoundClass | null = null;
  for (const [index, raw] of lines.entries()) {
    const line = raw.replace(/\r$/, '');
    const match = CLASS_LINE.exec(line);
    if (match?.[1]) {
      current = {
        name: match[1],
        line: index + 1,
        implements: (match[2] ?? '')
          .split(',')
          .map((s) => s.trim().replace(/<.*$/, ''))
          .filter((s) => s !== ''),
        methods: [],
      };
      found.push(current);
      continue;
    }
    if (current === null) continue;
    if (line === '}') {
      current = null;
      continue;
    }
    const method = METHOD_LINE.exec(line);
    if (method?.[1] && !RESERVED_MEMBERS.has(method[1])) {
      current.methods.push({ name: method[1], line: index + 1 });
    }
  }
  return found;
}

/** A conventional-name heuristic; everything else is left for a person to type. */
export function typeOf(className: string): DesignedBuildingBlockType | null {
  if (className.endsWith('Repository')) return 'repository';
  if (className.endsWith('Service')) return 'application_service';
  if (className.endsWith('Factory')) return 'factory';
  if (/(Client|Gateway|Adapter)$/.test(className))
    return 'external_integration';
  if (/(Event)$/.test(className)) return 'domain_event';
  if (/(Command)$/.test(className)) return 'domain_command';
  if (/(Query)$/.test(className)) return 'domain_query';
  return null;
}

/** The first directory under `src/` (or under the unit when there is no `src/`); null for a root-level file. */
function moduleOf(relativeToUnit: string): string | null {
  const parts = relativeToUnit.split('/');
  const start = parts[0] === 'src' ? 1 : 0;
  return parts.length - start > 1 ? (parts[start] ?? null) : null;
}

function dirnameOf(path: string, moduleName: string): string {
  const at = path.indexOf(`/${moduleName}/`);
  return at === -1 ? dirname(path) : path.slice(0, at + moduleName.length + 1);
}

async function walk(
  dir: string,
  accept: (fileName: string) => boolean,
): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      out.push(...(await walk(path, accept)));
    } else if (entry.isFile() && accept(entry.name)) {
      out.push(path);
    }
  }
  return out;
}
