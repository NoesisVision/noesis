import { posix } from 'node:path';
import {
  BehaviorId,
  BuildingBlockId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';
import type { ScannedSystemModel } from '#backend/app/system-model/source-code-scanner';
import type {
  BehaviourType,
  BuildingBlockRef,
  ScannedBehaviour,
  ScannedBuildingBlock,
  ScannedDomainModule,
  ScannedProperty,
  Visibility,
} from '#backend/app/system-model/system-model';
import type { JavaMethod, JavaSource, JavaType } from './java-source';
import { type BlockLookup, resolveType } from './type-refs';

/*
 * The projection of parsed Java files onto the system model.
 *
 * Modules are packages: the common prefix of every package is dropped
 * except its last segment, so `com.itlibrium.discounts.calculation` is the
 * module `discounts.calculation` under the module `discounts`, and every
 * segment on the way is a module of its own. A building block is a type with
 * a stereotype annotation, wherever it is declared; its non-private methods
 * are behaviours and its instance fields are properties. Ids are derived
 * from names and paths, so a re-scan of unchanged code yields the same ids.
 */

export interface ParsedJavaFile {
  /** Relative to the repository root, `/`-separated. */
  path: string;
  source: JavaSource;
}

export type JavaModel = Pick<
  ScannedSystemModel,
  'modules' | 'buildingBlocks' | 'behaviours'
>;

/** A method name a reader would take for a question rather than an act. */
const QUERY_NAME = /^(?:get|is|find|has|list|search|count)(?:[A-Z_\d]|$)/;

interface Block {
  id: BuildingBlockId;
  moduleId: ModuleId;
  moduleSegments: string[];
  file: ParsedJavaFile;
  type: JavaType;
}

export function projectJavaModel(files: ParsedJavaFile[]): JavaModel {
  const packaged = files.filter((file) => file.source.package !== null);
  const dropped = commonPackagePrefix(
    packaged.map((file) => file.source.package ?? ''),
  ).slice(0, -1);
  const modulePathOf = (pkg: string) => pkg.split('.').slice(dropped.length);

  const blocks = collectBlocks(packaged, modulePathOf);
  const lookup = blockLookup(blocks);
  const modules = collectModules(packaged, blocks, modulePathOf);

  return {
    modules: [...modules.values()].sort(byId),
    buildingBlocks: blocks
      .map((block) => toBuildingBlock(block, lookup))
      .sort(byId),
    behaviours: blocks
      .flatMap((block) => toBehaviours(block, lookup))
      .sort(byId),
  };
}

/** The package segments every package starts with. */
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

/** Every stereotyped type as a block; a name declared twice in one package keeps its first file. */
function collectBlocks(
  files: ParsedJavaFile[],
  modulePathOf: (pkg: string) => string[],
): Block[] {
  const blocks = new Map<BuildingBlockId, Block>();
  for (const file of files) {
    const moduleSegments = modulePathOf(file.source.package ?? '');
    const moduleId = moduleIdOf(moduleSegments);
    for (const type of file.source.types) {
      if (type.stereotype === null) continue;
      const id = BuildingBlockId.within(moduleId, type.name);
      if (!blocks.has(id)) {
        blocks.set(id, { id, moduleId, moduleSegments, file, type });
      }
    }
  }
  return [...blocks.values()];
}

function moduleIdOf(segments: string[]): ModuleId {
  const [root, ...rest] = segments;
  if (root === undefined) {
    throw new Error('A package resolved to no module segments.');
  }
  return rest.reduce<ModuleId>(
    (parent, name) => ModuleId.within(parent, name),
    ModuleId.root(root),
  );
}

/**
 * The module of every block and each of its ancestors, sourced at the
 * package's directory; an ancestor no file sits in takes the directory
 * above the nearest descendant's.
 */
function collectModules(
  files: ParsedJavaFile[],
  blocks: Block[],
  modulePathOf: (pkg: string) => string[],
): Map<ModuleId, ScannedDomainModule> {
  const dirByPath = new Map<string, string>();
  for (const file of files) {
    const path = modulePathOf(file.source.package ?? '').join('.');
    if (!dirByPath.has(path)) dirByPath.set(path, posix.dirname(file.path));
  }

  const modules = new Map<ModuleId, ScannedDomainModule>();
  for (const block of blocks) {
    for (let depth = 1; depth <= block.moduleSegments.length; depth++) {
      const segments = block.moduleSegments.slice(0, depth);
      const id = moduleIdOf(segments);
      if (modules.has(id)) continue;
      modules.set(id, {
        id,
        name: ElementName.parse(segments.at(-1)),
        description: null,
        source: {
          path: dirOf(segments, block, dirByPath),
          line: null,
        },
      });
    }
  }
  return modules;
}

function dirOf(
  segments: string[],
  descendant: Block,
  dirByPath: Map<string, string>,
): string {
  const own = dirByPath.get(segments.join('.'));
  if (own !== undefined) return own;
  let dir = posix.dirname(descendant.file.path);
  for (let i = segments.length; i < descendant.moduleSegments.length; i++) {
    dir = posix.dirname(dir);
  }
  return dir;
}

/** A simple name resolves to the one block so named, or the one in the same module when several are. */
function blockLookup(blocks: Block[]): (from: Block) => BlockLookup {
  const byName = new Map<string, Block[]>();
  for (const block of blocks) {
    const list = byName.get(block.type.name) ?? [];
    list.push(block);
    byName.set(block.type.name, list);
  }
  return (from) => (simpleName) => {
    const candidates = byName.get(simpleName) ?? [];
    const [only] = candidates;
    if (candidates.length === 1 && only !== undefined) return only.id;
    return (
      candidates.find((candidate) => candidate.moduleId === from.moduleId)
        ?.id ?? null
    );
  };
}

function toBuildingBlock(
  block: Block,
  lookup: (from: Block) => BlockLookup,
): ScannedBuildingBlock {
  const resolve = lookup(block);
  const { type, file } = block;
  return {
    id: block.id,
    name: ElementName.parse(type.name),
    type: type.stereotype ?? 'value_object',
    description: type.javadoc,
    implements: unique(
      type.supertypes
        .map((name) => resolve(name))
        .filter((id): id is BuildingBlockId => id !== null),
    ),
    properties: type.fields.flatMap((field) => {
      const resolved = resolveType(field.type, resolve);
      if (resolved === null) return [];
      const property: ScannedProperty = {
        name: ElementName.parse(field.name),
        type: resolved.ref,
        description: field.javadoc,
        optional: resolved.optional,
      };
      return [property];
    }),
    rules: [],
    scenarios: [],
    source: { path: file.path, line: type.line },
  };
}

/** One behaviour per method name: overloads share an id, so their inputs are pooled. */
function toBehaviours(
  block: Block,
  lookup: (from: Block) => BlockLookup,
): ScannedBehaviour[] {
  const resolve = lookup(block);
  const behaviours = new Map<BehaviorId, ScannedBehaviour>();
  for (const method of block.type.methods) {
    const id = BehaviorId.within(block.id, method.name);
    const input = method.parameterTypes
      .map((type) => resolveType(type, resolve))
      .filter((resolved) => resolved !== null)
      .map((resolved) => resolved.ref);
    const output = resolveType(method.returnType, resolve);
    const current = behaviours.get(id);
    if (current === undefined) {
      behaviours.set(id, {
        id,
        buildingBlockId: block.id,
        name: ElementName.parse(method.name),
        type: behaviourTypeOf(method),
        description: method.javadoc,
        visibility: visibilityOf(block.type, method),
        input,
        output: output === null ? [] : [output.ref],
        rules: [],
        scenarios: [],
        source: { path: block.file.path, line: method.line },
      });
    } else {
      current.input = uniqueRefs([...current.input, ...input]);
      if (current.output.length === 0 && output !== null) {
        current.output = [output.ref];
      }
      current.description ??= method.javadoc;
    }
  }
  return [...behaviours.values()];
}

function behaviourTypeOf(method: JavaMethod): BehaviourType {
  return method.returnType !== 'void' && QUERY_NAME.test(method.name)
    ? 'Query'
    : 'Command';
}

/** Public is public all the way: a public method of a public type; nobody outside sees the rest. */
function visibilityOf(type: JavaType, method: JavaMethod): Visibility {
  return type.isPublic && method.isPublic
    ? { kind: 'public', actors: [] }
    : { kind: 'private' };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function uniqueRefs(refs: BuildingBlockRef[]): BuildingBlockRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = typeof ref === 'string' ? ref : JSON.stringify(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
