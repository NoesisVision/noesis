import { posix } from 'node:path';
import {
  ActorId,
  ArtifactName,
  BehaviorId,
  BuildingBlockId,
  DeployableUnitId,
  ElementName,
  LayerId,
  LibraryId,
  ModuleId,
  RuleId,
  ScenarioId,
} from '#backend/app/element-id';
import {
  OUTPUT_NAME,
  type Relation,
  type ScannedActor,
  type ScannedBehavior,
  type ScannedBuildingBlock,
  type ScannedDeployableUnit,
  type ScannedDomainModule,
  type ScannedLayer,
  type ScannedLibrary,
  type ScannedRule,
  type ScannedScenario,
  type SourceLocation,
  type SystemModel,
} from '#backend/app/system-model/system-model';
import type {
  Annotation,
  CodeModelFile,
  DeclarationNode,
  FieldNode,
  MethodNode,
  NamespaceNode,
  NodeId,
  PropertyNode,
  ParseManifest,
  SourceSpan,
  TypeNode,
  TypeRef,
} from '../code-parsers/code-model';
import {
  type FeatureFileSource,
  type FeatureRule,
  type FeatureScenario,
  readFeatureFile,
} from '../feature-files/feature-file';
import { StepExpression } from '../feature-files/step-expression';
import {
  enumArgument,
  hasRole,
  type RoleOf,
  rolesOf,
  stringArgument,
  withRepeated,
} from './annotations';
import { isCollaboratorKind } from './block-kinds';
import {
  CodeModelIndex,
  type GlobalId,
  globalId,
  type IndexedArtifact,
  type Located,
  namespaceName,
} from './code-model-index';
import type { LibraryManifest } from './library-manifest';
import type { NamespaceConfig } from './namespace-config';
import { byRelation } from './relation-order';
import {
  optionalOf,
  type ResolutionScope,
  resolveTypeRef,
} from './type-resolution';
import type { AnnotationVocabulary } from './vocabulary';

/*
 * The second stage of the scanner: the code model of one scan built into
 * the system model. docs/plans/code-model-to-system-model.md states every
 * rule; the comments here name the rules they implement (R4.2, R9.3, ...).
 * The builder is a pure function of its inputs and reports what it
 * dropped or fell back on as diagnostics rather than logging.
 */

export interface SystemModelBuildInput {
  readonly manifest: ParseManifest;
  /** The manifest's files, each parsed; order does not matter. */
  readonly files: readonly CodeModelFile[];
  /** The repository's feature files, the rules and scenarios of R12; order does not matter. */
  readonly featureFiles: readonly FeatureFileSource[];
  readonly vocabulary: AnnotationVocabulary;
  readonly config: NamespaceConfig;
  /** The libraries no scan reads, described by hand (R14); none by default. */
  readonly libraries?: readonly LibraryManifest[];
}

export interface BuildDiagnostic {
  /** `info`: an element or override was dropped; `debug`: a member's type has no word in the model. */
  readonly level: 'info' | 'debug';
  readonly message: string;
  readonly source: SourceLocation | null;
}

type BuiltModel = Pick<
  SystemModel,
  | 'modules'
  | 'buildingBlocks'
  | 'behaviors'
  | 'rules'
  | 'scenarios'
  | 'actors'
  | 'manualProcesses'
  | 'deployableUnits'
  | 'libraries'
  | 'layers'
  | 'deploymentContainers'
  | 'relations'
>;

export interface BuiltSystemModel {
  readonly model: BuiltModel;
  readonly diagnostics: readonly BuildDiagnostic[];
}

const BLOCK_TYPE_KINDS = new Set(['class', 'struct', 'interface', 'enum']);

interface Block {
  readonly id: BuildingBlockId;
  readonly modulePath: readonly string[];
  readonly artifact: IndexedArtifact;
  readonly node: TypeNode;
  readonly type: ScannedBuildingBlock['type'];
  readonly name: ElementName;
}

interface Behavior {
  readonly id: BehaviorId;
  readonly block: Block;
  readonly name: ElementName;
  /** The overload that stands for the behavior (R9.3). */
  readonly chosen: Located<MethodNode>;
  readonly overloads: readonly Located<MethodNode>[];
}

/** A block a library manifest lists (R14): a type the code reaches only as a stub. */
interface ListedBlock {
  readonly id: BuildingBlockId;
  readonly modulePath: readonly string[];
  readonly type: ScannedBuildingBlock['type'];
  readonly name: ElementName;
  readonly description: string | null;
  readonly manifest: LibraryManifest;
  readonly source: SourceLocation;
}

/** One call a behavior makes, at a site in the source, and the behaviors it reaches (R11.2). */
interface Call {
  readonly site: SourceSpan;
  readonly targets: ReadonlySet<BehaviorId>;
}

/** A method a `When` step binds to by its expression (R12). */
interface StepDefinition {
  readonly expression: StepExpression;
  readonly method: Located<MethodNode>;
}

export function buildSystemModel(
  input: SystemModelBuildInput,
): BuiltSystemModel {
  return new ModelAssembly(input).assemble();
}

class ModelAssembly {
  private readonly vocabulary: AnnotationVocabulary;
  private readonly config: NamespaceConfig;
  private readonly index: CodeModelIndex;
  private readonly featureFiles: readonly FeatureFileSource[];
  private readonly manifests: readonly LibraryManifest[];
  /** R14: the blocks the library manifests list, by the code model's type id. */
  private readonly listed = new Map<NodeId, ListedBlock>();
  private readonly diagnostics: BuildDiagnostic[] = [];
  private readonly relations: Relation[] = [];
  private readonly blocks = new Map<GlobalId, Block>();
  private readonly behaviors = new Map<BehaviorId, Behavior>();
  private readonly rules = new Map<RuleId, ScannedRule>();
  private readonly scenarios = new Map<ScenarioId, ScannedScenario>();
  private readonly actors = new Map<ActorId, ScannedActor>();
  /** Every overload's behavior, by the method's global id. */
  private readonly behaviorOfMethod = new Map<GlobalId, BehaviorId>();
  private readonly memberBehaviors = new Map<GlobalId, Set<BehaviorId>>();
  private readonly callTargets = new Map<GlobalId, Set<BehaviorId>>();
  /** R5.8: each block's fields a getter exposes, with the getter, by field id. */
  private readonly getters = new Map<GlobalId, Map<NodeId, MethodNode>>();

  constructor({
    manifest,
    files,
    featureFiles,
    vocabulary,
    config,
    libraries = [],
  }: SystemModelBuildInput) {
    this.vocabulary = vocabulary;
    this.config = config;
    this.index = new CodeModelIndex(manifest, files);
    this.featureFiles = featureFiles;
    this.manifests = libraries;
  }

  assemble(): BuiltSystemModel {
    this.collectBlocks();
    this.collectListedBlocks();
    this.collectBehaviors();
    this.collectInvocations();
    this.collectRules();
    const { deployableUnits, libraries } = this.artifacts();
    const model: BuiltModel = {
      modules: this.modules(),
      buildingBlocks: [
        ...[...this.blocks.values()].map((block) =>
          this.toBuildingBlock(block),
        ),
        ...[...this.listed.values()].map((block) => this.toListedBlock(block)),
      ].sort(byId),
      behaviors: [...this.behaviors.values()]
        .sort(byId)
        .map((behavior) => this.toBehavior(behavior)),
      rules: [...this.rules.values()].sort(byId),
      scenarios: [...this.scenarios.values()].sort(byId),
      // Found as the behaviors are built, just above.
      actors: [...this.actors.values()].sort(byId),
      // Never scanned: a design document authors them.
      manualProcesses: [],
      deployableUnits,
      libraries,
      layers: this.layers(),
      // Never scanned: a design document authors them.
      deploymentContainers: [],
      relations: this.relations.sort(byRelation),
    };
    return { model, diagnostics: this.diagnostics };
  }

  /* ------------------------------------------------------------ blocks */

  /** R3.1, R3.3, R4.1 to R4.3: every directly annotated type, first one per id. */
  private collectBlocks(): void {
    for (const artifact of this.index.artifacts) {
      if (this.excluded(artifact.file.artifact.annotations)) continue;
      for (const node of artifact.file.nodes) {
        if (node.kind !== 'type' || !BLOCK_TYPE_KINDS.has(node.typeKind)) {
          continue;
        }
        if (this.excluded(node.annotations)) continue;
        const roles = rolesOf(
          node.annotations,
          'buildingBlock',
          this.vocabulary,
        );
        const [first, ...more] = roles;
        if (first === undefined) continue;
        if (more.length > 0) {
          this.info(
            `${node.id} carries ${roles.length} building block annotations; the first, ${first.role.type}, wins`,
            node,
          );
        }
        const block = this.blockOf(
          artifact,
          node,
          this.blockTypeOf(first),
          first.annotation,
        );
        if (block === null) continue;
        const taken = [...this.blocks.values()].find((b) => b.id === block.id);
        if (taken !== undefined) {
          this.info(
            `${node.id} in ${artifact.id} has the id of ${taken.node.id} in ${taken.artifact.id}, which came first; dropped`,
            node,
          );
          continue;
        }
        this.blocks.set(globalId(artifact, node.id), block);
      }
    }
  }

  /** R4.1: the role's kind, or the one its direction argument picks. */
  private blockTypeOf({
    annotation,
    role,
  }: RoleOf<'buildingBlock'>): Block['type'] {
    if (role.byDirection === undefined) return role.type;
    const direction = enumArgument(
      annotation,
      this.vocabulary.arguments.direction,
    );
    return (
      (direction === null ? undefined : role.byDirection[direction]) ??
      role.type
    );
  }

  private blockOf(
    artifact: IndexedArtifact,
    node: TypeNode,
    type: Block['type'],
    annotation: Annotation,
  ): Block | null {
    const { types, namespace } = artifact.enclosing(node.id);
    const modulePath =
      namespace === null ? null : this.config.modulePathOf(namespace);
    if (modulePath === null) {
      this.info(
        `${node.id} is in ${namespace === null ? 'the global namespace' : `namespace ${namespace}`}, which maps to no module; dropped`,
        node,
      );
      return null;
    }
    // R4.2: the annotation's name, else the code's, enclosing types first.
    const codeName = [...types.map((t) => t.name), node.name].join(' ');
    const name = this.nameOf(
      stringArgument(annotation, this.vocabulary.arguments.name),
      codeName,
      node,
    );
    return {
      id: BuildingBlockId.within(moduleIdOf(modulePath), name),
      modulePath,
      artifact,
      node,
      type,
      name,
    };
  }

  /** An override that is no element name gives way to the code's name, with a diagnostic. */
  private nameOf(
    override: string | null,
    codeName: string,
    node: DeclarationNode,
  ): ElementName {
    if (override !== null) {
      const parsed = ElementName.safeParse(override);
      if (parsed.success) return parsed.data;
      this.info(
        `${node.id}: the name "${override}" is no element name (empty, or with '.' or '|'); the code's name is used`,
        node,
      );
    }
    return ElementName.parse(codeName);
  }

  private blockIdOf(
    from: IndexedArtifact,
    typeId: NodeId,
  ): BuildingBlockId | null {
    const located = this.index.resolve(from, typeId);
    // R14.3: a type no parsed artifact declares may be one a manifest lists.
    if (located === null) return this.listed.get(typeId)?.id ?? null;
    return (
      this.blocks.get(globalId(located.artifact, located.node.id))?.id ?? null
    );
  }

  /** The block's element, and its `module_contains_block`, `extends`, `has_state` and `has_collaborator` relations. */
  private toBuildingBlock(block: Block): ScannedBuildingBlock {
    const { artifact, node } = block;
    this.relations.push({
      kind: 'module_contains_block',
      from: moduleIdOf(block.modulePath),
      to: block.id,
    });
    // R4.4: the blocks among the direct supertypes, type arguments ignored.
    for (const to of sortedUnique(
      (artifact.supertypesOf.get(node.id) ?? []).flatMap((ref) => {
        if (ref.kind !== 'named') return [];
        const id = this.blockIdOf(artifact, ref.type);
        return id === null || id === block.id ? [] : [id];
      }),
    )) {
      this.relations.push({ kind: 'extends', from: block.id, to });
    }
    this.collectState(block);
    return {
      id: block.id,
      name: block.name,
      type: block.type,
      description: this.descriptionOf(node),
      source: locationOf(node),
    };
  }

  /** R4.5, R9.8: the description role's text, else the doc comment. */
  private descriptionOf(node: DeclarationNode): string | null {
    for (const { annotation } of rolesOf(
      node.annotations,
      'description',
      this.vocabulary,
    )) {
      const text = stringArgument(
        annotation,
        this.vocabulary.arguments.description,
      );
      if (text !== null) return text;
    }
    return node.documentation;
  }

  /* ------------------------------------------------------------- state */

  /**
   * R5.1 to R5.8: one slot per public instance property or field, and
   * Java's fields behind getters: `has_collaborator` when its type is a
   * block of a collaborator kind, `has_state` otherwise; then R5.9: one
   * `has_collaborator` per constructor parameter of a collaborator kind no
   * member named already.
   */
  private collectState(block: Block): void {
    const { artifact, node } = block;
    const getters = this.gettersOf(block);
    const members = artifact.children(node.id);
    const candidates = members
      .filter(
        (member): member is PropertyNode | FieldNode =>
          (member.kind === 'property' || member.kind === 'field') &&
          this.isPropertyCandidate(member, getters),
      )
      .sort(byLocationThenName);
    // R5.2: a field and a property of one name are one property; the property wins.
    const byName = new Map<string, PropertyNode | FieldNode>();
    for (const member of candidates) {
      const key = member.name.replace(/^_+/, '').toLowerCase();
      const current = byName.get(key);
      if (
        current === undefined ||
        (current.kind === 'field' && member.kind === 'property')
      ) {
        byName.set(key, member);
      }
    }
    const named = new Set<ElementName>();
    for (const member of byName.values()) {
      const resolved = resolveTypeRef(
        member.type,
        this.scopeFor(artifact, member),
      );
      if (resolved === null) {
        this.debug(
          `${member.id}: its type has no word in the system model; left out`,
          member,
        );
        continue;
      }
      const name = ElementName.safeParse(member.name);
      if (!name.success) continue;
      named.add(name.data);
      const collaborator = this.collaboratorOf(resolved.ref);
      this.relations.push(
        collaborator === null
          ? {
              kind: 'has_state',
              from: block.id,
              to: resolved.ref,
              name: name.data,
              cardinality: resolved.cardinality,
            }
          : {
              kind: 'has_collaborator',
              from: block.id,
              to: collaborator,
              name: name.data,
              cardinality: resolved.cardinality,
            },
      );
    }
    this.collectInjected(block, members, named);
  }

  /**
   * R5.9: what a block is handed as it is made, its constructors read in
   * declaration order: each parameter typed by a block of a collaborator
   * kind, by the parameter's name, once. A parameter of any other type says
   * nothing a member does not, so it is passed over without a word.
   */
  private collectInjected(
    block: Block,
    members: readonly DeclarationNode[],
    named: Set<ElementName>,
  ): void {
    const constructors = members
      .filter(
        (member): member is MethodNode =>
          member.kind === 'method' &&
          member.methodKind === 'constructor' &&
          !this.excluded(member.annotations),
      )
      .sort(byLocationThenName);
    const scope: ResolutionScope = {
      vocabulary: this.vocabulary,
      index: this.index,
      from: block.artifact,
      blockOf: (artifact, typeId) => this.blockIdOf(artifact, typeId),
    };
    for (const constructor of constructors) {
      for (const parameter of constructor.signature.parameters) {
        const name = ElementName.safeParse(parameter.name);
        if (!name.success || named.has(name.data)) continue;
        const resolved = resolveTypeRef(parameter.type, scope);
        if (resolved === null) continue;
        const collaborator = this.collaboratorOf(resolved.ref);
        if (collaborator === null) continue;
        named.add(name.data);
        this.relations.push({
          kind: 'has_collaborator',
          from: block.id,
          to: collaborator,
          name: name.data,
          cardinality: resolved.cardinality,
        });
      }
    }
  }

  /** The block `ref` names when its kind makes it a collaborator (decision 11); null for state. */
  private collaboratorOf(ref: string): BuildingBlockId | null {
    const type = this.blockTypes().get(ref);
    return type !== undefined && isCollaboratorKind(type)
      ? (ref as BuildingBlockId)
      : null;
  }

  private blockTypesById: Map<string, Block['type']> | null = null;

  /** Every block's kind by its id, once the blocks are known. */
  private blockTypes(): ReadonlyMap<string, Block['type']> {
    this.blockTypesById ??= new Map(
      [...this.blocks.values(), ...this.listed.values()].map((block) => [
        block.id,
        block.type,
      ]),
    );
    return this.blockTypesById;
  }

  /**
   * R5.1; R5.7: a record component is a property although its field is
   * private; R5.8: so is a Java field a getter exposes.
   */
  private isPropertyCandidate(
    member: PropertyNode | FieldNode,
    getters: ReadonlyMap<NodeId, MethodNode>,
  ): boolean {
    if (member.origin === 'generated') return false;
    if (
      member.visibility !== 'public' &&
      !isRecordComponent(member) &&
      !getters.has(member.id)
    ) {
      return false;
    }
    if (member.modifiers.includes('static')) return false;
    if (this.excluded(member.annotations)) return false;
    if (member.kind === 'property') {
      const isEvent = member.accessors.some(
        (a) => a === 'add' || a === 'remove',
      );
      return !isEvent && member.parameters.length === 0;
    }
    return member.fieldKind === 'field' && member.constantValue === null;
  }

  /**
   * R5.8: in Java, the block's non-public instance fields that a public,
   * non-static, parameterless getter of the same type exposes (`getX()`,
   * `isX()` for a boolean, or Lombok's fluent `x()`), declared or generated,
   * each with its getter. Empty for every other language.
   */
  private gettersOf(block: Block): ReadonlyMap<NodeId, MethodNode> {
    const key = globalId(block.artifact, block.node.id);
    const known = this.getters.get(key);
    if (known !== undefined) return known;
    const found = new Map<NodeId, MethodNode>();
    this.getters.set(key, found);
    if (this.vocabulary.language !== 'java') return found;
    const members = block.artifact.children(block.node.id);
    const methods = new Map<string, MethodNode>();
    for (const member of members) {
      if (
        member.kind === 'method' &&
        member.methodKind === 'method' &&
        member.visibility === 'public' &&
        !member.modifiers.includes('static') &&
        member.signature.parameters.length === 0 &&
        !this.excluded(member.annotations)
      ) {
        methods.set(member.name, member);
      }
    }
    for (const field of members) {
      if (
        field.kind !== 'field' ||
        field.fieldKind !== 'field' ||
        field.origin === 'generated' ||
        field.visibility === 'public' ||
        field.modifiers.includes('static') ||
        field.constantValue !== null ||
        this.excluded(field.annotations)
      ) {
        continue;
      }
      const getter = getterNamesOf(field)
        .map((name) => methods.get(name))
        .find(
          (method) =>
            method !== undefined &&
            sameType(method.signature.returnType, field.type),
        );
      if (getter !== undefined) found.set(field.id, getter);
    }
    return found;
  }

  /* -------------------------------------------------------- behaviors */

  /** R9.1 to R9.3: the public methods of each block, overloads collapsed. */
  private collectBehaviors(): void {
    for (const block of this.blocks.values()) {
      const getters = new Set(this.gettersOf(block).values());
      const methods = block.artifact
        .children(block.node.id)
        .filter(
          (member): member is MethodNode =>
            member.kind === 'method' &&
            this.isBehaviorCandidate(member, getters),
        );
      const byName = new Map<ElementName, Located<MethodNode>[]>();
      for (const node of methods) {
        const located: Located<MethodNode> = { artifact: block.artifact, node };
        const name = this.behaviorNameOf(located);
        const list = byName.get(name) ?? [];
        list.push(located);
        byName.set(name, list);
      }
      for (const [name, overloads] of byName) {
        const id = BehaviorId.within(block.id, name);
        // The overload with the most parameters, the first declared of those.
        const chosen = overloads.reduce((best, candidate) =>
          candidate.node.signature.parameters.length >
          best.node.signature.parameters.length
            ? candidate
            : best,
        );
        this.behaviors.set(id, { id, block, name, chosen, overloads });
        for (const overload of overloads) {
          this.behaviorOfMethod.set(
            globalId(overload.artifact, overload.node.id),
            id,
          );
        }
      }
    }
    this.reportHomelessBehaviors();
  }

  /**
   * R9.1, and R5.7, R5.8: a record component's accessor, and a getter that
   * makes its field a property, are the property, not a behavior.
   */
  private isBehaviorCandidate(
    method: MethodNode,
    getters: ReadonlySet<MethodNode>,
  ): boolean {
    if (method.methodKind !== 'method' || method.origin === 'generated')
      return false;
    if (isRecordComponent(method)) return false;
    if (this.excluded(method.annotations)) return false;
    if (hasRole(method.annotations, 'behavior', this.vocabulary)) return true;
    return (
      method.visibility === 'public' &&
      !getters.has(method) &&
      !this.vocabulary.technicalMembers.has(method.name)
    );
  }

  /** R9.2: the behavior role's name on the method or the members it stands in for, else the code's. */
  private behaviorNameOf(method: Located<MethodNode>): ElementName {
    for (const member of this.memberHierarchy(method)) {
      for (const { annotation } of rolesOf(
        member.node.annotations,
        'behavior',
        this.vocabulary,
      )) {
        const override = stringArgument(
          annotation,
          this.vocabulary.arguments.name,
        );
        if (override === null) continue;
        const parsed = ElementName.safeParse(override);
        if (parsed.success) return parsed.data;
        this.info(
          `${member.node.id}: the behavior name "${override}" is no element name; the code's name is used`,
          member.node,
        );
      }
    }
    return ElementName.parse(method.node.name);
  }

  /** The method, then the members it overrides or implements, nearest first, each once. */
  private memberHierarchy(method: Located<MethodNode>): Located<MethodNode>[] {
    const result: Located<MethodNode>[] = [];
    const seen = new Set<GlobalId>();
    const queue = [method];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = globalId(current.artifact, current.node.id);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(current);
      for (const to of current.artifact.overriddenBy.get(current.node.id) ??
        []) {
        const next = this.index.resolveMethod(current.artifact, to);
        if (next !== null) queue.push(next);
      }
    }
    return result;
  }

  /** R9.11: a behavior role on a method whose type is no block has no home. */
  private reportHomelessBehaviors(): void {
    for (const artifact of this.index.artifacts) {
      for (const node of artifact.file.nodes) {
        if (
          node.kind !== 'method' ||
          !hasRole(node.annotations, 'behavior', this.vocabulary)
        ) {
          continue;
        }
        if (!this.behaviorOfMethod.has(globalId(artifact, node.id))) {
          this.info(
            `${node.id} is marked a behavior but its type is no building block; dropped`,
            node,
          );
        }
      }
    }
  }

  /** The behavior's element, and its `exposes`, `has_input` and `has_output` relations. */
  private toBehavior(behavior: Behavior): ScannedBehavior {
    const { chosen, block } = behavior;
    this.relations.push({ kind: 'exposes', from: block.id, to: behavior.id });
    this.collectSignature(behavior);
    this.collectActors(this.memberHierarchy(chosen), block.node);
    return {
      id: behavior.id,
      name: behavior.name,
      description:
        this.descriptionOf(chosen.node) ??
        behavior.overloads
          .map((overload) => this.descriptionOf(overload.node))
          .find((text) => text !== null) ??
        null,
      source: locationOf(chosen.node),
    };
  }

  /** R9.6, R9.7: one `has_input` per parameter of the chosen overload, one `has_output` for its result. */
  private collectSignature({ id, chosen }: Behavior): void {
    const scope = this.scopeFor(chosen.artifact, chosen.node);
    const named = new Set<ElementName>();
    // Numbered as declared, over the parameters that have a word: a gap
    // left by one that has none would say nothing a reader could use.
    let position = 0;
    for (const parameter of chosen.node.signature.parameters) {
      const resolved = resolveTypeRef(parameter.type, scope);
      const name = ElementName.safeParse(parameter.name);
      if (resolved === null || !name.success || named.has(name.data)) {
        this.debug(
          `${chosen.node.id}: parameter ${parameter.name} has no word in the system model; left out`,
          chosen.node,
        );
        continue;
      }
      named.add(name.data);
      this.relations.push({
        kind: 'has_input',
        from: id,
        to: resolved.ref,
        name: name.data,
        cardinality: parameter.optional
          ? optionalOf(resolved.cardinality)
          : resolved.cardinality,
        position: ++position,
      });
    }
    const returned = resolveTypeRef(chosen.node.signature.returnType, scope);
    if (returned !== null) {
      this.relations.push({
        kind: 'has_output',
        from: id,
        to: returned.ref,
        name: OUTPUT_NAME,
        cardinality: returned.cardinality,
      });
    }
  }

  /**
   * R9.5: an actor per name the actor roles on the method, the members it
   * stands in for, and its type give, found where it is first named; the
   * behavior keeps nothing of it.
   */
  private collectActors(
    hierarchy: readonly Located<MethodNode>[],
    type: TypeNode,
  ): void {
    for (const node of [...hierarchy.map((method) => method.node), type]) {
      for (const { annotation } of rolesOf(
        withRepeated(node.annotations),
        'actor',
        this.vocabulary,
      )) {
        const name = stringArgument(
          annotation,
          this.vocabulary.arguments.actor,
        );
        if (name === null) continue;
        const parsed = ElementName.safeParse(name);
        if (!parsed.success) {
          this.info(
            `${node.id}: the actor name "${name}" is no element name; dropped`,
            node,
          );
          continue;
        }
        const id = ActorId.of(parsed.data);
        if (this.actors.has(id)) continue;
        this.actors.set(id, {
          id,
          name: parsed.data,
          description: null,
          source: locationOf(node),
        });
      }
    }
  }

  /* ------------------------------------------------------- invocations */

  /** R11.1 to R11.3: one `invokes` per behavior a behavior calls, in the order of the calls. */
  private collectInvocations(): void {
    const calls = new Map<BehaviorId, Call[]>();
    for (const artifact of this.index.artifacts) {
      for (const [from, invocations] of artifact.invokedBy) {
        const caller = artifact.nodes.get(from);
        if (caller?.kind !== 'method') continue;
        const sources = this.behaviorsOfMember({ artifact, node: caller });
        if (sources.size === 0) continue;
        for (const { to, site } of invocations) {
          const targets = this.callTargetsOf(artifact, to);
          if (targets.size === 0) continue;
          for (const source of sources) {
            let list = calls.get(source);
            if (list === undefined) calls.set(source, (list = []));
            list.push({ site, targets });
          }
        }
      }
    }
    for (const [from, made] of calls) {
      this.relations.push(...invokesOf(from, made));
    }
  }

  /** The behaviors a method stands for: its own and those of the members it overrides or implements. */
  private behaviorsOfMember(method: Located<MethodNode>): Set<BehaviorId> {
    const key = globalId(method.artifact, method.node.id);
    let found = this.memberBehaviors.get(key);
    if (found === undefined) {
      found = new Set();
      for (const member of this.memberHierarchy(method)) {
        const id = this.behaviorOfMethod.get(
          globalId(member.artifact, member.node.id),
        );
        if (id !== undefined) found.add(id);
      }
      this.memberBehaviors.set(key, found);
    }
    return found;
  }

  /**
   * R11.2: the behaviors a call to `to` reaches: those of the method, or,
   * when it has none, those its own calls reach, transitively. A method on a
   * cycle contributes what was found before the cycle closed.
   */
  private callTargetsOf(from: IndexedArtifact, to: NodeId): Set<BehaviorId> {
    const located = this.index.resolveMethod(from, to);
    if (located === null) return new Set();
    const key = globalId(located.artifact, located.node.id);
    const known = this.callTargets.get(key);
    if (known !== undefined) return known;
    const direct = this.behaviorsOfMember(located);
    if (direct.size > 0) {
      this.callTargets.set(key, direct);
      return direct;
    }
    const reached = new Set<BehaviorId>();
    this.callTargets.set(key, reached);
    if (located.node.methodKind !== 'constructor') {
      for (const next of located.artifact.invokedBy.get(located.node.id) ??
        []) {
        for (const id of this.callTargetsOf(located.artifact, next.to))
          reached.add(id);
      }
    }
    return reached;
  }

  /* ------------------------------------------------------------- rules */

  /**
   * R12: every rule of every feature file, by path, then as the file states
   * them, whose scenarios' `When` steps bind to behaviors: the rule is in
   * the module of the first one's behavior, governed by each distinct one,
   * illustrated by each scenario that binds.
   */
  private collectRules(): void {
    const definitions = this.stepDefinitions();
    const files = [...this.featureFiles].sort((a, b) =>
      byCodeUnit(a.path, b.path),
    );
    for (const file of files) {
      const { rules, diagnostics } = readFeatureFile(file);
      for (const { message, source } of diagnostics) {
        this.infoAt(message, source);
      }
      for (const rule of rules) this.collectRule(rule, definitions);
    }
  }

  private collectRule(
    rule: FeatureRule,
    definitions: readonly StepDefinition[],
  ): void {
    const bound = rule.scenarios.flatMap((scenario) => {
      const behavior = this.governorOf(scenario, definitions);
      return behavior === null ? [] : [{ scenario, behavior }];
    });
    const [first] = bound;
    if (first === undefined) {
      this.infoAt(
        `rule "${rule.name}": none of its scenarios binds to a behavior; dropped`,
        rule.source,
      );
      return;
    }
    const id = RuleId.within(ModuleId.containing(first.behavior), rule.name);
    const taken = this.rules.get(id);
    if (taken !== undefined) {
      this.infoAt(
        `rule "${rule.name}" has the id ${id} of the rule at ${taken.source.path}:${taken.source.line}, which came first; dropped`,
        rule.source,
      );
      return;
    }
    this.rules.set(id, {
      id,
      name: rule.name,
      kind: rule.kind,
      description: rule.description,
      source: rule.source,
    });
    const governors = new Set<BehaviorId>();
    for (const { scenario, behavior } of bound) {
      const scenarioId = ScenarioId.within(id, scenario.name);
      if (this.scenarios.has(scenarioId)) {
        this.infoAt(
          `scenario "${scenario.name}" is the second of its name in rule "${rule.name}"; dropped`,
          scenario.source,
        );
        continue;
      }
      this.scenarios.set(scenarioId, {
        id: scenarioId,
        name: scenario.name,
        description: scenario.description,
        steps: [...scenario.steps],
        source: scenario.source,
      });
      this.relations.push({ kind: 'illustrates', from: scenarioId, to: id });
      if (!governors.has(behavior)) {
        governors.add(behavior);
        this.relations.push({ kind: 'governs', from: behavior, to: id });
      }
    }
  }

  /**
   * R12: the one behavior a scenario's `When` steps invoke: each step bound
   * to exactly one step definition, the behaviors those methods reach as a
   * call reaches them (R11.2), and exactly one among them all. Null, with a
   * diagnostic, otherwise.
   */
  private governorOf(
    scenario: FeatureScenario,
    definitions: readonly StepDefinition[],
  ): BehaviorId | null {
    const reached = new Set<BehaviorId>();
    for (const text of scenario.whenSteps) {
      const matching = definitions.filter(({ expression }) =>
        expression.matches(text),
      );
      const [definition] = matching;
      if (definition === undefined || matching.length > 1) {
        this.infoAt(
          `scenario "${scenario.name}": the When step "${text}" matches ${
            definition === undefined
              ? 'no step definition'
              : `${matching.length} step definitions (${matching.map(({ method }) => method.node.id).join(', ')})`
          }; dropped`,
          scenario.source,
        );
        return null;
      }
      for (const id of this.reachedBy(definition.method)) reached.add(id);
    }
    const [behavior, ...more] = [...reached].sort(byCodeUnit);
    if (behavior === undefined || more.length > 0) {
      this.infoAt(
        `scenario "${scenario.name}": its When steps invoke ${
          behavior === undefined
            ? 'no behavior'
            : `${reached.size} behaviors (${[behavior, ...more].join(', ')})`
        }, not one; dropped`,
        scenario.source,
      );
      return null;
    }
    return behavior;
  }

  /** The behaviors a step definition's calls reach. */
  private reachedBy({ artifact, node }: Located<MethodNode>): Set<BehaviorId> {
    const reached = new Set<BehaviorId>();
    for (const { to } of artifact.invokedBy.get(node.id) ?? []) {
      for (const id of this.callTargetsOf(artifact, to)) reached.add(id);
    }
    return reached;
  }

  /** R12: every method with a step definition role, once per annotation whose expression is one. */
  private stepDefinitions(): StepDefinition[] {
    const definitions: StepDefinition[] = [];
    for (const artifact of this.index.artifacts) {
      for (const node of artifact.file.nodes) {
        if (node.kind !== 'method') continue;
        for (const { annotation } of rolesOf(
          withRepeated(node.annotations),
          'stepDefinition',
          this.vocabulary,
        )) {
          const source = stringArgument(
            annotation,
            this.vocabulary.arguments.expression,
          );
          const expression =
            source === null
              ? new Error('it has no expression')
              : StepExpression.of(source, this.vocabulary.stepExpressions);
          if (expression instanceof Error) {
            this.info(
              `${node.id}: a step definition no step can bind to (${expression.message}); left out`,
              node,
            );
            continue;
          }
          definitions.push({ expression, method: { artifact, node } });
        }
      }
    }
    return definitions;
  }

  /* ----------------------------------------------------------- modules */

  /** R6.2 to R6.4: a module per prefix of every block's module path, each containing the next. */
  private modules(): ScannedDomainModule[] {
    const namespaceLocations = this.namespaceLocations();
    const modules = new Map<ModuleId, ScannedDomainModule>();
    // A module only a manifest's blocks are in sits at the manifest (R14.2).
    const holders = [
      ...[...this.blocks.values()].map((block) => ({
        modulePath: block.modulePath,
        above: (levels: number) => this.directoryAbove(block, levels),
      })),
      ...[...this.listed.values()].map((block) => ({
        modulePath: block.modulePath,
        above: () => block.source,
      })),
    ];
    for (const block of holders) {
      for (let depth = 1; depth <= block.modulePath.length; depth++) {
        const path = block.modulePath.slice(0, depth);
        const id = moduleIdOf(path);
        if (modules.has(id)) continue;
        modules.set(id, {
          id,
          name: ElementName.parse(path.at(-1)),
          description: null,
          source:
            namespaceLocations.get(path.join('.')) ??
            block.above(block.modulePath.length - depth),
        });
        const parent = ModuleId.parentOf(id);
        if (parent !== null) {
          this.relations.push({
            kind: 'module_contains_module',
            from: parent,
            to: id,
          });
        }
      }
    }
    return [...modules.values()].sort(byId);
  }

  /** Where each module path is first declared as a namespace, in scan order, excluded artifacts aside. */
  private namespaceLocations(): Map<string, SourceLocation> {
    const locations = new Map<string, SourceLocation>();
    for (const artifact of this.index.artifacts) {
      if (this.excluded(artifact.file.artifact.annotations)) continue;
      for (const node of artifact.file.nodes) {
        if (node.kind !== 'namespace') continue;
        const name = namespaceName(node.id);
        const path = name === null ? null : this.config.modulePathOf(name);
        const [location] = node.locations;
        if (path === null || location === undefined) continue;
        const key = path.join('.');
        if (!locations.has(key)) locations.set(key, toSourceLocation(location));
      }
    }
    return locations;
  }

  /** A module no namespace declares sits `levels` directories above its descendant block's file. */
  private directoryAbove(block: Block, levels: number): SourceLocation {
    let dir = posix.dirname(locationOf(block.node).path);
    for (let i = 0; i < levels; i++) dir = posix.dirname(dir);
    return { path: dir, line: null };
  }

  /* ----------------------------------------------- listed blocks (R14) */

  /**
   * R14.1, R14.2: each block a library manifest lists, in manifest order,
   * by the type the code reaches as a stub; its module is its namespace's,
   * as a scanned block's is (R6.1).
   */
  private collectListedBlocks(): void {
    const taken = new Set<string>(
      [...this.blocks.values()].map((block) => block.id),
    );
    for (const manifest of this.manifests) {
      const source = { path: manifest.path, line: null };
      for (const listed of manifest.buildingBlocks) {
        const typeId = `T:${listed.type}` as NodeId;
        const drop = (why: string) =>
          this.infoAt(
            `${manifest.path}: ${listed.type} ${why}; dropped`,
            source,
          );
        if (this.listed.has(typeId)) {
          drop('is listed already');
          continue;
        }
        if (this.index.artifacts.some((a) => a.nodes.has(typeId))) {
          drop('is declared in the scanned code; annotate it there instead');
          continue;
        }
        const { namespace, codeName } = listedTypeName(listed.type);
        const modulePath =
          namespace === null ? null : this.config.modulePathOf(namespace);
        if (modulePath === null) {
          drop(
            `is in ${namespace === null ? 'the global namespace' : `namespace ${namespace}`}, which maps to no module`,
          );
          continue;
        }
        const name = listed.name ?? ElementName.safeParse(codeName).data;
        if (name === undefined) {
          drop(`has no element name; give it a "name"`);
          continue;
        }
        const id = BuildingBlockId.within(moduleIdOf(modulePath), name);
        if (taken.has(id)) {
          drop(`has the id ${id}, which came first`);
          continue;
        }
        taken.add(id);
        this.listed.set(typeId, {
          id,
          modulePath,
          type: listed.kind,
          name,
          description: listed.description ?? null,
          manifest,
          source,
        });
      }
    }
  }

  /** A listed block's element and its module's `module_contains_block`; it holds nothing a manifest does not say. */
  private toListedBlock(block: ListedBlock): ScannedBuildingBlock {
    this.relations.push({
      kind: 'module_contains_block',
      from: moduleIdOf(block.modulePath),
      to: block.id,
    });
    return {
      id: block.id,
      name: block.name,
      type: block.type,
      description: block.description,
      source: block.source,
    };
  }

  /* --------------------------------------------------------- artifacts */

  /**
   * R13: each artifact that declares a building block, by its name: an
   * executable one a deployable unit containing the modules of its blocks,
   * any other a library containing its blocks. The first of two with one id
   * wins.
   */
  private artifacts(): {
    deployableUnits: ScannedDeployableUnit[];
    libraries: ScannedLibrary[];
  } {
    const deployableUnits = new Map<DeployableUnitId, ScannedDeployableUnit>();
    const libraries = new Map<LibraryId, ScannedLibrary>();
    const blocks = [...this.blocks.values()];
    for (const artifact of this.index.artifacts) {
      const node = artifact.file.artifact;
      if (this.excluded(node.annotations)) continue;
      // The repository root itself is '.', as a module's directory is (R6.4);
      // an artifact without a root directory has no path, as a node without
      // a location has none (R4.6).
      const source = {
        path: node.rootDirectory === null ? '' : node.rootDirectory || '.',
        line: null,
      };
      const declared = blocks.filter((block) => block.artifact === artifact);
      if (declared.length === 0) {
        this.infoAt(
          `${artifact.id} declares no building block; no deployable unit or library`,
          source,
        );
        continue;
      }
      const name = ArtifactName.safeParse(node.name);
      if (!name.success) {
        this.infoAt(
          `${artifact.id}: the artifact name "${node.name}" is no artifact name (empty, padded, or with '|'); dropped`,
          source,
        );
        continue;
      }
      const element = {
        name: name.data,
        description: null,
        source,
      };
      if (node.executable) {
        const id = DeployableUnitId.of(name.data);
        if (this.firstWith(id, deployableUnits, artifact.id, source)) {
          deployableUnits.set(id, { id, ...element });
          for (const module of sortedUnique(
            declared.map((block) => moduleIdOf(block.modulePath)),
          )) {
            this.relations.push({
              kind: 'unit_contains_module',
              from: id,
              to: module,
            });
          }
        }
      } else {
        const id = LibraryId.of(name.data);
        if (this.firstWith(id, libraries, artifact.id, source)) {
          libraries.set(id, { id, ...element });
          for (const block of declared) {
            this.relations.push({
              kind: 'library_contains_block',
              from: id,
              to: block.id,
            });
          }
        }
      }
    }
    // R14.4: then each manifest, a library of the blocks it kept.
    for (const manifest of this.manifests) {
      const source = { path: manifest.path, line: null };
      const id = LibraryId.of(manifest.name);
      const kept = [...this.listed.values()].filter(
        (block) => block.manifest === manifest,
      );
      if (kept.length === 0) {
        this.infoAt(
          `${manifest.path} lists no building block the model keeps; no library`,
          source,
        );
        continue;
      }
      if (!this.firstWith(id, libraries, manifest.path, source)) continue;
      libraries.set(id, {
        id,
        name: manifest.name,
        description: manifest.description ?? null,
        source,
      });
      for (const block of kept) {
        this.relations.push({
          kind: 'library_contains_block',
          from: id,
          to: block.id,
        });
      }
    }
    return {
      deployableUnits: [...deployableUnits.values()].sort(byId),
      libraries: [...libraries.values()].sort(byId),
    };
  }

  /* ------------------------------------------------------------ layers */

  /**
   * R15: one layer per name the layer annotations on packages and
   * namespaces give, and one `layer_contains_block` to each block from the layer of the
   * nearest annotated namespace at or above the block's. A layer no block
   * is in is no element.
   */
  private layers(): ScannedLayer[] {
    const layerOf = new Map<string, LayerId>();
    const layers = new Map<LayerId, ScannedLayer>();
    for (const { namespace, node } of this.annotatedNamespaces()) {
      const roles = rolesOf(node.annotations, 'layer', this.vocabulary);
      const [first, ...more] = roles;
      if (first === undefined) continue;
      if (more.length > 0) {
        this.info(
          `namespace ${namespace} carries ${roles.length} layer annotations; the first wins`,
          node,
        );
      }
      const name = stringArgument(
        first.annotation,
        this.vocabulary.arguments.layer,
      );
      const parsed = ElementName.safeParse(name);
      if (!parsed.success) {
        this.info(
          `namespace ${namespace}: the layer name "${name ?? ''}" is no element name; dropped`,
          node,
        );
        continue;
      }
      const id = LayerId.of(parsed.data);
      const taken = layerOf.get(namespace);
      if (taken !== undefined) {
        if (taken !== id) {
          this.info(
            `namespace ${namespace} is in ${taken} by an annotation that came first; ${id} dropped`,
            node,
          );
        }
        continue;
      }
      layerOf.set(namespace, id);
      if (!layers.has(id)) {
        layers.set(id, {
          id,
          name: parsed.data,
          description: null,
          source: layerSourceOf(node),
        });
      }
    }
    const inLayer = new Set<LayerId>();
    for (const block of this.blocks.values()) {
      const { namespace } = block.artifact.enclosing(block.node.id);
      const id = namespace === null ? null : nearestLayer(namespace, layerOf);
      if (id === null) continue;
      inLayer.add(id);
      this.relations.push({
        kind: 'layer_contains_block',
        from: id,
        to: block.id,
      });
    }
    for (const layer of layers.values()) {
      if (inLayer.has(layer.id)) continue;
      this.infoAt(`${layer.id} holds no building block; dropped`, layer.source);
      layers.delete(layer.id);
    }
    return [...layers.values()].sort(byId);
  }

  /** Every named namespace of every artifact not excluded, by namespace then artifact, so the first annotation wins alike in every build. */
  private annotatedNamespaces(): {
    namespace: string;
    artifact: IndexedArtifact;
    node: NamespaceNode;
  }[] {
    return this.index.artifacts
      .filter((artifact) => !this.excluded(artifact.file.artifact.annotations))
      .flatMap((artifact) =>
        artifact.file.nodes.flatMap((node) => {
          if (node.kind !== 'namespace' || node.annotations.length === 0)
            return [];
          const namespace = namespaceName(node.id);
          return namespace === null ? [] : [{ namespace, artifact, node }];
        }),
      )
      .sort(
        (a, b) =>
          byCodeUnit(a.namespace, b.namespace) ||
          byCodeUnit(a.artifact.id, b.artifact.id),
      );
  }

  /** Whether no artifact before took `id`; a diagnostic when one did. */
  private firstWith(
    id: string,
    taken: ReadonlyMap<string, unknown>,
    artifact: string,
    source: SourceLocation | null,
  ): boolean {
    if (!taken.has(id)) return true;
    this.infoAt(
      `${artifact} has the id ${id}, which came first; dropped`,
      source,
    );
    return false;
  }

  /* ------------------------------------------------------------ shared */

  private excluded(annotations: readonly Annotation[]): boolean {
    return hasRole(annotations, 'exclude', this.vocabulary);
  }

  /** Resolves `member`'s types from its artifact; what cannot be said is a debug diagnostic, what is flattened an info one. */
  private scopeFor(
    from: IndexedArtifact,
    member: DeclarationNode,
  ): ResolutionScope {
    return {
      vocabulary: this.vocabulary,
      index: this.index,
      from,
      blockOf: (artifact, typeId) => this.blockIdOf(artifact, typeId),
      unresolvable: (reason) => this.debug(`${member.id}: ${reason}`, member),
      flattened: (reason) => this.info(`${member.id}: ${reason}`, member),
    };
  }

  private info(message: string, node: DeclarationNode): void {
    this.diagnostics.push({
      level: 'info',
      message,
      source: sourceOrNull(node),
    });
  }

  private infoAt(message: string, source: SourceLocation | null): void {
    this.diagnostics.push({ level: 'info', message, source });
  }

  private debug(message: string, node: DeclarationNode): void {
    this.diagnostics.push({
      level: 'debug',
      message,
      source: sourceOrNull(node),
    });
  }
}

/**
 * R11.3: the calls in the order of their sites, each target at its first
 * call, numbered from 1; the behavior itself is never a target. Calls
 * attributed to one behavior from several methods (overloads, implementors)
 * are ordered together by file and position, so the result is one per input.
 */
function invokesOf(from: BehaviorId, calls: readonly Call[]): Relation[] {
  const targets: BehaviorId[] = [];
  for (const { targets: reached } of [...calls].sort(bySite)) {
    for (const target of [...reached].sort(byCodeUnit)) {
      if (target !== from && !targets.includes(target)) targets.push(target);
    }
  }
  return targets.map((to, index) => ({
    kind: 'invokes',
    from,
    to,
    order: index + 1,
  }));
}

function bySite(a: Call, b: Call): number {
  return (
    byCodeUnit(a.site.file, b.site.file) ||
    a.site.startLine - b.site.startLine ||
    a.site.startColumn - b.site.startColumn
  );
}

/**
 * A listed type's namespace and its name as the code reads it: `A.B.Order+Line`
 * is `Order Line` in `A.B`, as a nested block is named (R4.2); a generic's
 * arity is no part of its name.
 */
function listedTypeName(type: string): {
  namespace: string | null;
  codeName: string;
} {
  const [outer = type, ...nested] = type.split('+');
  const dot = outer.lastIndexOf('.');
  const names = [outer.slice(dot + 1), ...nested].map((part) =>
    part.replace(/`\d+$/, ''),
  );
  return {
    namespace: dot === -1 ? null : outer.slice(0, dot),
    codeName: names.join(' '),
  };
}

function moduleIdOf(path: readonly string[]): ModuleId {
  const [root, ...rest] = path;
  if (root === undefined) throw new Error('A module path is never empty.');
  return rest.reduce<ModuleId>(
    (parent, name) => ModuleId.within(parent, name),
    ModuleId.root(root),
  );
}

/** The Java parser marks a record's component field and accessor; the field is the property (R5.7). */
function isRecordComponent(node: DeclarationNode): boolean {
  return node.languageSpecific['java.isRecordComponent'] === true;
}

/** R5.8: the names a getter of `field` may have: `getX`, `isX` for a boolean, and the fluent `x`. */
function getterNamesOf(field: FieldNode): string[] {
  const capitalised = field.name.charAt(0).toUpperCase() + field.name.slice(1);
  const names = [`get${capitalised}`, field.name];
  if (isBoolean(field.type)) names.push(`is${capitalised}`);
  return names;
}

function isBoolean(ref: TypeRef): boolean {
  return (
    (ref.kind === 'primitive' && ref.name === 'boolean') ||
    (ref.kind === 'named' && ref.type === 'T:java.lang.Boolean')
  );
}

/** R5.8: one type, nullability aside: a getter of another type exposes something else. */
function sameType(a: TypeRef, b: TypeRef): boolean {
  return typeKey(a) === typeKey(b);
}

function typeKey(ref: TypeRef): string {
  return JSON.stringify(ref, (key, value: unknown) => {
    if (key === 'nullable') return undefined;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).sort(([x], [y]) => byCodeUnit(x, y)),
    );
  });
}

/** The namespace at or nearest above `namespace` that is in a layer, that layer; null when none is. */
function nearestLayer(
  namespace: string,
  layerOf: ReadonlyMap<string, LayerId>,
): LayerId | null {
  const segments = namespace.split('.');
  for (let length = segments.length; length > 0; length--) {
    const id = layerOf.get(segments.slice(0, length).join('.'));
    if (id !== undefined) return id;
  }
  return null;
}

/**
 * Where a layer is named: Java writes a package annotation in the package's
 * `package-info.java`, so that location when the namespace has one, else its
 * first.
 */
function layerSourceOf(node: NamespaceNode): SourceLocation {
  const declared = node.locations.find((span) =>
    span.file.endsWith('package-info.java'),
  );
  return declared === undefined ? locationOf(node) : toSourceLocation(declared);
}

/** R4.6, R9.10: the node's first location; a node without one has no path. */
function locationOf(node: DeclarationNode): SourceLocation {
  return sourceOrNull(node) ?? { path: '', line: null };
}

function sourceOrNull(node: DeclarationNode): SourceLocation | null {
  const [first] = node.locations;
  return first === undefined ? null : toSourceLocation(first);
}

function toSourceLocation(span: SourceSpan): SourceLocation {
  return { path: span.file, line: span.startLine >= 1 ? span.startLine : null };
}

function byLocationThenName(a: DeclarationNode, b: DeclarationNode): number {
  const [la] = a.locations;
  const [lb] = b.locations;
  if (la !== undefined && lb !== undefined) {
    if (la.file !== lb.file) return byCodeUnit(la.file, lb.file);
    if (la.startLine !== lb.startLine) return la.startLine - lb.startLine;
  }
  return byCodeUnit(a.name, b.name);
}

function byId(a: { id: string }, b: { id: string }): number {
  return byCodeUnit(a.id, b.id);
}

function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortedUnique<T extends string>(items: readonly T[]): T[] {
  return [...new Set(items)].sort(byCodeUnit);
}
