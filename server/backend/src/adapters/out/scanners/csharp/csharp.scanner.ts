import { readdir } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import type { Now } from '#backend/app/clock';
import {
  BehaviorId,
  BuildingBlockId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';
import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import type {
  ScannedBehaviour,
  ScannedBuildingBlock,
  ScannedDomainModule,
  SystemModel,
} from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import {
  type CSharpAnnotatedType,
  type CSharpMethod,
  type CSharpNamespace,
  type CSharpSourceFile,
  parseCSharpSource,
} from './csharp-source';
import { NamespaceConfig } from './namespace-config';

const SKIPPED_DIRS = new Set(['node_modules', 'bin', 'obj']);
const FILES_READ_AT_ONCE = 10;

export interface CSharpScannerDeps {
  noesis: NoesisDir;
  now: Now;
}

/** A source file whose namespace maps to a module. */
interface ModuleFile extends CSharpSourceFile {
  path: string;
  namespace: CSharpNamespace;
  modulePath: string;
}

/**
 * Reads the `.cs` files under the repository root as text. A namespace is a
 * module, nested by its dots and mapped by `noesis-config.json`; a type marked
 * with a building block attribute is a building block, and each of its public
 * methods a behaviour.
 */
export class CSharpSourceCodeScanner implements SourceCodeScanner {
  private readonly noesis: NoesisDir;
  private readonly now: Now;

  constructor({ noesis, now }: CSharpScannerDeps) {
    this.noesis = noesis;
    this.now = now;
  }

  /** Mints the id as the scan starts, so the newest scan has the highest id. */
  async scan(): Promise<SystemModel> {
    const id = SystemModelId.mint();
    const scannedAt = this.now();
    const config = await NamespaceConfig.load(this.noesis.root);
    const files = await this.moduleFiles(config);
    return {
      id,
      name: basename(this.noesis.root),
      scanned_at: scannedAt,
      ...modelOf(files),
    };
  }

  /** In path order, so a scan of the same code gives the same model. */
  private async moduleFiles(config: NamespaceConfig): Promise<ModuleFile[]> {
    const paths = (await csFilesUnder(this.noesis.root)).sort();
    const files: ModuleFile[] = [];
    for (let i = 0; i < paths.length; i += FILES_READ_AT_ONCE) {
      const read = await Promise.all(
        paths.slice(i, i + FILES_READ_AT_ONCE).map(async (path) => ({
          path: relative(this.noesis.root, path),
          ...parseCSharpSource(await Bun.file(path).text()),
        })),
      );
      for (const file of read) {
        if (file.namespace === null) continue;
        const modulePath = config.modulePathOf(file.namespace.name);
        if (modulePath === null) continue;
        files.push({ ...file, namespace: file.namespace, modulePath });
      }
    }
    return files;
  }
}

/** Hidden directories, `.noesis/` among them, and build output are skipped. */
async function csFilesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        const skipped =
          entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name);
        return skipped ? [] : csFilesUnder(path);
      }
      return entry.isFile() && entry.name.endsWith('.cs') ? [path] : [];
    }),
  );
  return nested.flat();
}

/** A second element with an id already taken is left out. */
function modelOf(
  files: ModuleFile[],
): Pick<SystemModel, 'modules' | 'buildingBlocks' | 'behaviours'> {
  const modules = new Map<string, ScannedDomainModule>();
  const buildingBlocks = new Map<BuildingBlockId, ScannedBuildingBlock>();
  const behaviours = new Map<BehaviorId, ScannedBehaviour>();

  for (const file of files) {
    const moduleId = addModules(modules, file);
    for (const type of file.types) {
      const block = buildingBlockOf(type, moduleId, file.path);
      if (buildingBlocks.has(block.id)) continue;
      buildingBlocks.set(block.id, block);
      for (const method of type.methods) {
        const behaviour = behaviourOf(method, block.id, file.path);
        if (!behaviours.has(behaviour.id)) {
          behaviours.set(behaviour.id, behaviour);
        }
      }
    }
  }

  return {
    modules: [...modules.values()].sort((a, b) => byCodeUnit(a.id, b.id)),
    buildingBlocks: [...buildingBlocks.values()],
    behaviours: [...behaviours.values()],
  };
}

/**
 * The file's module and each module it nests in. A module is found at the
 * first file declaring its namespace or one nested in it.
 */
function addModules(
  modules: Map<string, ScannedDomainModule>,
  file: ModuleFile,
): ModuleId {
  let id: ModuleId | null = null;
  for (const name of file.modulePath.split('.')) {
    id = id === null ? ModuleId.root(name) : ModuleId.within(id, name);
    if (!modules.has(id)) {
      modules.set(id, {
        id,
        name,
        description: null,
        rules: [],
        source: { path: file.path, line: file.namespace.line },
      });
    }
  }
  return id!;
}

function buildingBlockOf(
  type: CSharpAnnotatedType,
  moduleId: ModuleId,
  path: string,
): ScannedBuildingBlock {
  const name = nameOf(type.nameOverride, type.name);
  return {
    id: BuildingBlockId.within(moduleId, name),
    name,
    type: type.buildingBlockType,
    description: null,
    implements: [],
    properties: [],
    rules: [],
    scenarios: [],
    source: { path, line: type.line },
  };
}

/** Only public methods are scanned, so every behaviour is public. */
function behaviourOf(
  method: CSharpMethod,
  buildingBlockId: BuildingBlockId,
  path: string,
): ScannedBehaviour {
  const name = nameOf(method.nameOverride, method.name);
  return {
    id: BehaviorId.within(buildingBlockId, name),
    buildingBlockId,
    name,
    type: method.returnsResult ? 'Query' : 'Command',
    description: null,
    visibility: {
      kind: 'public',
      actors: method.actor === null ? [] : [method.actor],
    },
    input: [],
    output: [],
    rules: [],
    scenarios: [],
    source: { path, line: method.line },
  };
}

/** An override that is no element name, e.g. one with a dot, gives way to the code's name. */
function nameOf(override: string | null, codeName: string): ElementName {
  const parsed = ElementName.safeParse(override);
  return parsed.success ? parsed.data : ElementName.parse(codeName);
}

function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
