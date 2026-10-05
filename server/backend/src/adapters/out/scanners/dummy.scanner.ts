import { basename, relative } from 'node:path';
import type { ChangeId } from '#backend/app/changes/change-id';
import type { ChangeOwnedReader } from '#backend/app/changes/change-owned.repository';
import type { ChangesReader } from '#backend/app/changes/changes.repository';
import type { Now } from '#backend/app/clock';
import type {
  DesignDocument,
  DesignedBehaviour,
  DesignedBuildingBlock,
  DesignedDomainModule,
  DesignedParameter,
  DesignedProperty,
  DesignedResult,
  DesignedRule,
  DesignedScenario,
} from '#backend/app/design-docs/design-doc';
import type { DesignDocField } from '#backend/app/design-docs/design-doc-field';
import {
  type BehaviorId,
  BuildingBlockId,
  type ElementName,
  ModuleId,
} from '#backend/app/element-id';
import type {
  ScannedSystemModel,
  SourceCodeScanner,
} from '#backend/app/system-model/source-code-scanner';
import type {
  BuildingBlockRef,
  ScannedBehaviour,
  ScannedBuildingBlock,
  ScannedDomainModule,
  ScannedParameter,
  ScannedProperty,
  ScannedResult,
  ScannedRule,
  ScannedScenario,
  SourceLocation,
} from '#backend/app/system-model/system-model';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

export interface DummyScannerDeps {
  noesis: NoesisDir;
  changes: ChangesReader;
  designDocs: ChangeOwnedReader<DesignDocument>;
  now: Now;
}

interface ImplementedDesign {
  change: ChangeId;
  document: DesignDocument;
  source: SourceLocation;
}

/**
 * Reads no code: the model is every implemented design document of every
 * change, replayed from an empty one in the order they were marked
 * implemented. A design that does not fit what the ones before it built
 * fails the scan.
 */
export class DummySourceCodeScanner implements SourceCodeScanner {
  private readonly noesis: NoesisDir;
  private readonly changes: ChangesReader;
  private readonly designDocs: ChangeOwnedReader<DesignDocument>;
  private readonly now: Now;

  constructor({ noesis, changes, designDocs, now }: DummyScannerDeps) {
    this.noesis = noesis;
    this.changes = changes;
    this.designDocs = designDocs;
    this.now = now;
  }

  async scan(): Promise<ScannedSystemModel> {
    const scannedAt = this.now();
    const model = FlattenedModel.empty();
    for (const design of await this.implementedDesignsInOrder()) {
      model.apply(design);
    }
    return {
      name: basename(this.noesis.root),
      scanned_at: scannedAt,
      ...model.elements(),
    };
  }

  private async implementedDesignsInOrder(): Promise<ImplementedDesign[]> {
    const changes = await this.changes.list();
    const perChange = await Promise.all(
      changes.map(({ id }) => this.implementedDesignsOf(id)),
    );
    return perChange.flat().sort(byImplementation);
  }

  private async implementedDesignsOf(
    change: ChangeId,
  ): Promise<ImplementedDesign[]> {
    const documents = await this.designDocs.list(change);
    return documents
      .filter(({ implemented }) => implemented)
      .map((document) => ({
        change,
        document,
        source: this.sourceOf(change, document),
      }));
  }

  private sourceOf(change: ChangeId, document: DesignDocument): SourceLocation {
    const file = this.noesis.resolve(
      'graph',
      'changes',
      change,
      `${document.id}.design-doc.json`,
    );
    return { path: relative(this.noesis.root, file), line: null };
  }
}

/** Designs marked before the server kept the time have none, so they go first. */
function byImplementation(a: ImplementedDesign, b: ImplementedDesign): number {
  return (
    byCodeUnit(
      a.document.implementedAt ?? '',
      b.document.implementedAt ?? '',
    ) ||
    byCodeUnit(a.document.id, b.document.id) ||
    byCodeUnit(a.change, b.change)
  );
}

function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type Flatten<Designed, Scanned> = (
  current: Scanned | undefined,
  designed: Designed,
  at: At,
) => Scanned;

class FlattenedModel {
  private readonly modules = new Map<ModuleId, ScannedDomainModule>();
  private readonly buildingBlocks = new Map<
    BuildingBlockId,
    ScannedBuildingBlock
  >();
  private readonly behaviours = new Map<BehaviorId, ScannedBehaviour>();

  private constructor() {}

  static empty(): FlattenedModel {
    return new FlattenedModel();
  }

  /**
   * Removals go first, children before parents, so a design that removes a
   * module and what it holds by name finds each; additions and modifications
   * follow, parents first.
   */
  apply({ document, source, change }: ImplementedDesign): void {
    const at = At.designDoc(change, document.id);
    const { modules, buildingBlocks, behaviours } = document;
    removeAll(this.behaviours, behaviours.removed, at.in('behaviours'));
    this.removeBuildingBlocks(buildingBlocks.removed, at.in('buildingBlocks'));
    this.removeModules(modules.removed, at.in('modules'));
    addAndModify(
      this.modules,
      modules,
      (designed) => designed.id,
      (current, designed, itemAt) =>
        flattenedModule(current, designed, source, itemAt),
      at.in('modules'),
    );
    addAndModify(
      this.buildingBlocks,
      buildingBlocks,
      (designed) => designed.id,
      (current, designed, itemAt) =>
        flattenedBuildingBlock(current, designed, source, itemAt),
      at.in('buildingBlocks'),
    );
    addAndModify(
      this.behaviours,
      behaviours,
      (designed) => designed.id,
      (current, designed, itemAt) =>
        flattenedBehaviour(current, designed, source, itemAt),
      at.in('behaviours'),
    );
  }

  elements(): Pick<
    ScannedSystemModel,
    'modules' | 'buildingBlocks' | 'behaviours'
  > {
    return {
      modules: [...this.modules.values()],
      buildingBlocks: [...this.buildingBlocks.values()],
      behaviours: [...this.behaviours.values()],
    };
  }

  /** Each with its behaviours. */
  private removeBuildingBlocks(ids: BuildingBlockId[], at: At): void {
    removeAll(this.buildingBlocks, ids, at);
    const removed = new Set<BuildingBlockId>(ids);
    this.removeWhere(this.behaviours, (id) =>
      removed.has(BuildingBlockId.containing(id)),
    );
  }

  /** Each with the modules nested in it and everything they hold. */
  private removeModules(ids: ModuleId[], at: At): void {
    removeAll(this.modules, ids, at);
    const isRemoved = (module: ModuleId) =>
      ids.some((id) => module === id || module.startsWith(`${id}.`));
    this.removeWhere(this.modules, isRemoved);
    this.removeWhere(this.buildingBlocks, (id) =>
      isRemoved(ModuleId.containing(id)),
    );
    this.removeWhere(this.behaviours, (id) =>
      isRemoved(ModuleId.containing(id)),
    );
  }

  private removeWhere<Id extends string>(
    items: Map<Id, unknown>,
    isRemoved: (id: Id) => boolean,
  ): void {
    for (const id of [...items.keys()].filter(isRemoved)) items.delete(id);
  }
}

function flattenedModule(
  current: ScannedDomainModule | undefined,
  designed: DesignedDomainModule,
  source: SourceLocation,
  at: At,
): ScannedDomainModule {
  return {
    id: designed.id,
    name: field(designed.name, current?.name, at.in('name')),
    description: field(
      designed.definition,
      current?.description,
      at.in('definition'),
    ),
    rules: changedParts(
      current?.rules ?? [],
      designed.rules,
      flattenedRule,
      at.in('rules'),
    ),
    source,
  };
}

function flattenedBuildingBlock(
  current: ScannedBuildingBlock | undefined,
  designed: DesignedBuildingBlock,
  source: SourceLocation,
  at: At,
): ScannedBuildingBlock {
  return {
    id: designed.id,
    name: field(designed.name, current?.name, at.in('name')),
    type: field(designed.type, current?.type, at.in('type')),
    description: field(
      designed.definition,
      current?.description,
      at.in('definition'),
    ),
    implements: changedRefs(
      current?.implements ?? [],
      designed.implements,
      at.in('implements'),
    ),
    properties: changedParts(
      current?.properties ?? [],
      designed.properties,
      flattenedProperty,
      at.in('properties'),
    ),
    rules: changedParts(
      current?.rules ?? [],
      designed.rules,
      flattenedRule,
      at.in('rules'),
    ),
    scenarios: changedParts(
      current?.scenarios ?? [],
      designed.scenarios,
      flattenedScenario,
      at.in('scenarios'),
    ),
    source,
  };
}

function flattenedBehaviour(
  current: ScannedBehaviour | undefined,
  designed: DesignedBehaviour,
  source: SourceLocation,
  at: At,
): ScannedBehaviour {
  return {
    id: designed.id,
    buildingBlockId: BuildingBlockId.containing(designed.id),
    name: field(designed.name, current?.name, at.in('name')),
    type: field(designed.type, current?.type, at.in('type')),
    description: field(
      designed.definition,
      current?.description,
      at.in('definition'),
    ),
    visibility: field(
      designed.visibility,
      current?.visibility,
      at.in('visibility'),
    ),
    input: changedParts(
      current?.input ?? [],
      designed.input,
      flattenedParameter,
      at.in('input'),
    ),
    output: changedResults(
      current?.output ?? [],
      designed.output,
      at.in('output'),
    ),
    rules: changedParts(
      current?.rules ?? [],
      designed.rules,
      flattenedRule,
      at.in('rules'),
    ),
    scenarios: changedParts(
      current?.scenarios ?? [],
      designed.scenarios,
      flattenedScenario,
      at.in('scenarios'),
    ),
    source,
  };
}

function flattenedProperty(
  current: ScannedProperty | undefined,
  designed: DesignedProperty,
  at: At,
): ScannedProperty {
  return {
    name: designed.name,
    type: field(designed.type, current?.type, at.in('type')),
    description: field(
      designed.description,
      current?.description,
      at.in('description'),
    ),
    optional: field(designed.optional, current?.optional, at.in('optional')),
  };
}

function flattenedParameter(
  current: ScannedParameter | undefined,
  designed: DesignedParameter,
  at: At,
): ScannedParameter {
  return {
    name: designed.name,
    type: field(designed.type, current?.type, at.in('type')),
    description: field(
      designed.description,
      current?.description,
      at.in('description'),
    ),
    optional: field(designed.optional, current?.optional, at.in('optional')),
  };
}

function flattenedResult(
  current: ScannedResult | undefined,
  designed: DesignedResult,
  at: At,
): ScannedResult {
  return {
    type: designed.type,
    description: field(
      designed.description,
      current?.description,
      at.in('description'),
    ),
    optional: field(designed.optional, current?.optional, at.in('optional')),
  };
}

function flattenedRule(
  current: ScannedRule | undefined,
  designed: DesignedRule,
  at: At,
): ScannedRule {
  return {
    name: designed.name,
    // A rule designed before rules had categories is a business rule, as a
    // scanned one without a category is.
    category: field(
      designed.category,
      current?.category ?? 'Business',
      at.in('category'),
    ),
    ruleType: field(designed.ruleType, current?.ruleType, at.in('ruleType')),
    description: field(
      designed.description,
      current?.description,
      at.in('description'),
    ),
    scenarios: changedParts(
      current?.scenarios ?? [],
      designed.scenarios,
      flattenedScenario,
      at.in('scenarios'),
    ),
  };
}

function flattenedScenario(
  current: ScannedScenario | undefined,
  designed: DesignedScenario,
  at: At,
): ScannedScenario {
  return {
    name: designed.name,
    description: field(
      designed.description,
      current?.description,
      at.in('description'),
    ),
    given: field(designed.given, current?.given, at.in('given')),
    when: field(designed.when, current?.when, at.in('when')),
    // oxlint-disable-next-line unicorn/no-thenable
    then: field(designed.then, current?.then, at.in('then')), // NOSONAR
  };
}

/** The field's new value, else the one it holds; an added item has only new values. */
function field<Value, Held extends Value | null>(
  designed: DesignDocField<Value>,
  current: Held | undefined,
  at: At,
): Value | Held {
  if (designed.changed) return designed.value;
  if (current === undefined) throw at.fail('has no value');
  return current;
}

function addAndModify<Key extends string, Designed, Scanned>(
  items: Map<Key, Scanned>,
  changes: { added: Designed[]; modified: Designed[] },
  keyOf: (designed: Designed) => Key,
  flatten: Flatten<Designed, Scanned>,
  at: At,
): void {
  for (const designed of changes.added) {
    const key = keyOf(designed);
    const itemAt = at.item('added', key);
    if (items.has(key)) throw itemAt.fail('is already there');
    items.set(key, flatten(undefined, designed, itemAt));
  }
  for (const designed of changes.modified) {
    const key = keyOf(designed);
    const itemAt = at.item('modified', key);
    const current = items.get(key);
    if (current === undefined) throw itemAt.fail('is not there');
    items.set(key, flatten(current, designed, itemAt));
  }
}

function removeAll<Key extends string>(
  items: Map<Key, unknown>,
  keys: Key[],
  at: At,
): void {
  for (const key of keys) {
    if (!items.delete(key)) throw at.item('removed', key).fail('is not there');
  }
}

function changedParts<
  Designed extends { name: ElementName },
  Scanned extends { name: ElementName },
>(
  current: Scanned[],
  changes: { added: Designed[]; removed: ElementName[]; modified: Designed[] },
  flatten: Flatten<Designed, Scanned>,
  at: At,
): Scanned[] {
  const parts = new Map(current.map((part) => [part.name, part]));
  removeAll(parts, changes.removed, at);
  addAndModify(parts, changes, (designed) => designed.name, flatten, at);
  return [...parts.values()];
}

/** A behaviour's results, each known by its type. */
function changedResults(
  current: ScannedResult[],
  changes: {
    added: DesignedResult[];
    removed: BuildingBlockRef[];
    modified: DesignedResult[];
  },
  at: At,
): ScannedResult[] {
  const results = new Map(
    current.map((result) => [refKey(result.type), result]),
  );
  removeAll(results, changes.removed.map(refKey), at);
  addAndModify(
    results,
    changes,
    (designed) => refKey(designed.type),
    flattenedResult,
    at,
  );
  return [...results.values()];
}

/** A list of references may name one twice, so a removal takes one of them. */
function changedRefs<Ref extends BuildingBlockRef>(
  current: Ref[],
  changes: { added: Ref[]; removed: Ref[] },
  at: At,
): Ref[] {
  const refs = [...current];
  for (const removed of changes.removed) {
    const key = refKey(removed);
    const index = refs.findIndex((ref) => refKey(ref) === key);
    if (index === -1) throw at.item('removed', key).fail('is not there');
    refs.splice(index, 1);
  }
  return [...refs, ...changes.added];
}

function refKey(ref: BuildingBlockRef): string {
  return typeof ref === 'string' ? ref : JSON.stringify(ref);
}

/** Where in which design document a flattening step is, for the error it fails with. */
class At {
  private readonly designDoc: string;
  private readonly path: string;

  private constructor(designDoc: string, path: string) {
    this.designDoc = designDoc;
    this.path = path;
  }

  static designDoc(change: ChangeId, id: DesignDocument['id']): At {
    return new At(`${id} of change ${change}`, '');
  }

  in(name: string): At {
    return new At(
      this.designDoc,
      this.path === '' ? name : `${this.path}.${name}`,
    );
  }

  item(changes: 'added' | 'removed' | 'modified', key: string): At {
    return new At(this.designDoc, `${this.path}.${changes}[${key}]`);
  }

  fail(problem: string): Error {
    return new Error(
      `Cannot flatten the implemented design document ${this.designDoc}: ${this.path} ${problem}.`,
    );
  }
}
