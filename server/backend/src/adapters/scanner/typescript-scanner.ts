import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { BehaviorId, BuildingBlockId, ModuleId } from '#backend/app/element-id';
import type {
  BuildingBlockType,
  ScannedBehaviour,
  ScannedBuildingBlock,
  ScannedDomainModule,
  SystemModel,
} from '#backend/app/system-model/system-model';
import { contentHashAsUuid } from '#backend/platform/crypto/content-hash';

// Extraction is deliberately line-based: good enough to give a design document
// real building blocks to name, replaceable by a real parser later.

const SCANNER_NAME = 'noesis-typescript';
const SCANNER_VERSION = '0.1.0';

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
  /** Absolute. */
  dir: string;
  name: string;
}

export interface ScanInput {
  /** The repository root; every `source.path` is relative to it. */
  root: string;
  /** ISO 8601; injected so output is testable. */
  now: () => string;
}

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

// Ids derive from names and paths, so a re-scan of unchanged code yields the
// same file. A class outside every module directory sits in a root module
// named after the unit, because a building block always belongs to a module.
export async function scanUnit(
  unit: ScannedUnit,
  sources: string[],
  input: ScanInput,
): Promise<SystemModel> {
  const modules = new Map<ModuleId, ScannedDomainModule>();
  const buildingBlocks: ScannedBuildingBlock[] = [];
  const behaviours: ScannedBehaviour[] = [];

  for (const file of sources) {
    const path = relative(input.root, file).split(sep).join('/');
    const moduleName = moduleOf(relative(unit.dir, file).split(sep).join('/'));
    const name = elementName(moduleName ?? unit.name);
    const moduleId = ModuleId.root(name);
    if (!modules.has(moduleId)) {
      modules.set(moduleId, {
        id: moduleId,
        name,
        description: null,
        source: {
          path:
            moduleName === null
              ? unitPath(unit, input)
              : dirnameOf(path, moduleName),
          line: null,
        },
      });
    }

    const lines = (await readFile(file, 'utf8')).split('\n');
    for (const found of exportedClasses(lines)) {
      const blockId = BuildingBlockId.within(moduleId, found.name);
      buildingBlocks.push({
        id: blockId,
        name: found.name,
        type: typeOf(found.name),
        description: null,
        implements: found.implements.map((name) =>
          BuildingBlockId.within(moduleId, name),
        ),
        properties: [],
        rules: [],
        scenarios: [],
        source: { path, line: found.line },
      });
      for (const method of found.methods) {
        behaviours.push({
          id: BehaviorId.within(blockId, method.name),
          name: method.name,
          description: null,
          type: null,
          input: [],
          output: [],
          usedBuildingBlocks: [],
          rules: [],
          scenarios: [],
          visibility: null,
          source: { path, line: method.line },
        });
      }
    }
  }

  // `implements` may name a class outside this module or an interface; keep
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
    modules: [...modules.values()],
    buildingBlocks,
    behaviours,
  };
}

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

export function typeOf(className: string): BuildingBlockType | null {
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

function moduleOf(relativeToUnit: string): string | null {
  const parts = relativeToUnit.split('/');
  const start = parts[0] === 'src' ? 1 : 0;
  return parts.length - start > 1 ? (parts[start] ?? null) : null;
}

/* A directory or package name as an element name: no separators, no padding. */
function elementName(raw: string): string {
  return raw.trim().replaceAll(/[.|]/g, '-');
}

function unitPath(unit: ScannedUnit, input: ScanInput): string {
  return relative(input.root, unit.dir).split(sep).join('/') || '.';
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
