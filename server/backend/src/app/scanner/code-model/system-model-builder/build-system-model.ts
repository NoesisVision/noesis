import { posix } from 'node:path';
import {
  BehaviorId,
  BuildingBlockId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';
import type {
  BehaviourType,
  ScannedBehaviour,
  ScannedBuildingBlock,
  ScannedDomainModule,
  ScannedParameter,
  ScannedProperty,
  ScannedScenario,
  SourceLocation,
  SystemModel,
} from '#backend/app/scanner/system-model/system-model';
import type {
  Annotation,
  CodeModelFile,
  DeclarationNode,
  FieldNode,
  MethodNode,
  NodeId,
  PropertyNode,
  ScanManifest,
  SourceSpan,
  TypeNode,
  TypeRef,
} from '../code-model';
import { enumArgument, hasRole, rolesOf, stringArgument } from './annotations';
import {
  CodeModelIndex,
  type GlobalId,
  globalId,
  type IndexedArtifact,
  type Located,
  namespaceName,
} from './code-model-index';
import type { NamespaceConfig } from './namespace-config';
import { type ResolutionScope, resolveTypeRef } from './type-resolution';
import type { AnnotationVocabulary } from './vocabulary';

/*
 * The second stage of the scanner: the code model of one scan built into
 * the system model. docs/plans/code-model-to-system-model.md states every
 * rule; the comments here name the rules they implement (R4.2, R9.3, ...).
 * The builder is a pure function of its inputs and reports what it
 * dropped or fell back on as diagnostics rather than logging.
 */

export interface SystemModelBuildInput {
  readonly manifest: ScanManifest;
  /** The manifest's files, each parsed; order does not matter. */
  readonly files: readonly CodeModelFile[];
  readonly vocabulary: AnnotationVocabulary;
  readonly config: NamespaceConfig;
}

export interface BuildDiagnostic {
  /** `info`: an element or override was dropped; `debug`: a member's type has no word in the model. */
  readonly level: 'info' | 'debug';
  readonly message: string;
  readonly source: SourceLocation | null;
}

type BuiltModel = Pick<
  SystemModel,
  'modules' | 'buildingBlocks' | 'behaviours'
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

interface Behaviour {
  readonly id: BehaviorId;
  readonly block: Block;
  readonly name: ElementName;
  /** The overload that stands for the behaviour (R9.3). */
  readonly chosen: Located<MethodNode>;
  readonly overloads: readonly Located<MethodNode>[];
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
  private readonly diagnostics: BuildDiagnostic[] = [];
  private readonly blocks = new Map<GlobalId, Block>();
  private readonly behaviours = new Map<BehaviorId, Behaviour>();
  /** Every overload's behaviour, by the method's global id. */
  private readonly behaviourOfMethod = new Map<GlobalId, BehaviorId>();
  private readonly memberBehaviours = new Map<GlobalId, Set<BehaviorId>>();
  private readonly callTargets = new Map<GlobalId, Set<BehaviorId>>();
  /** R5.8: each block's fields a getter exposes, with the getter, by field id. */
  private readonly getters = new Map<GlobalId, Map<NodeId, MethodNode>>();

  constructor({ manifest, files, vocabulary, config }: SystemModelBuildInput) {
    this.vocabulary = vocabulary;
    this.config = config;
    this.index = new CodeModelIndex(manifest, files);
  }

  assemble(): BuiltSystemModel {
    this.collectBlocks();
    this.collectBehaviours();
    const invokes = this.collectInvocations();
    const model: BuiltModel = {
      modules: this.modules(),
      buildingBlocks: [...this.blocks.values()]
        .map((block) => this.toBuildingBlock(block))
        .sort(byId),
      behaviours: [...this.behaviours.values()]
        .map((behaviour) =>
          this.toBehaviour(behaviour, invokes.get(behaviour.id) ?? new Set()),
        )
        .sort(byId),
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
          first.role.type,
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
    if (located === null) return null;
    return (
      this.blocks.get(globalId(located.artifact, located.node.id))?.id ?? null
    );
  }

  private toBuildingBlock(block: Block): ScannedBuildingBlock {
    const { artifact, node } = block;
    return {
      id: block.id,
      name: block.name,
      type: block.type,
      description: this.descriptionOf(node),
      // R4.4: the blocks among the direct supertypes, type arguments ignored.
      implements: sortedUnique(
        (artifact.supertypesOf.get(node.id) ?? []).flatMap((ref) => {
          if (ref.kind !== 'named') return [];
          const id = this.blockIdOf(artifact, ref.type);
          return id === null || id === block.id ? [] : [id];
        }),
      ),
      properties: this.propertiesOf(block),
      rules: [],
      scenarios: this.scenariosOf([node]),
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

  /** R4.7, R9.9: one scenario per scenario role, by name only. */
  private scenariosOf(nodes: readonly DeclarationNode[]): ScannedScenario[] {
    const scenarios = new Map<string, ScannedScenario>();
    for (const node of nodes) {
      for (const { annotation } of rolesOf(
        node.annotations,
        'scenario',
        this.vocabulary,
      )) {
        const name = stringArgument(annotation, this.vocabulary.arguments.name);
        const parsed = ElementName.safeParse(name);
        if (!parsed.success) {
          this.info(
            `${node.id}: a scenario ${name === null ? 'without a name' : `named "${name}"`} is no element name; dropped`,
            node,
          );
          continue;
        }
        if (!scenarios.has(parsed.data)) {
          scenarios.set(parsed.data, {
            name: parsed.data,
            description: null,
            steps: [],
          });
        }
      }
    }
    return [...scenarios.values()];
  }

  /* -------------------------------------------------------- properties */

  /** R5.1 to R5.8: the block's public instance properties and fields, and Java's fields behind getters. */
  private propertiesOf(block: Block): ScannedProperty[] {
    const { artifact, node } = block;
    const getters = this.gettersOf(block);
    const candidates = artifact
      .children(node.id)
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
    const properties: ScannedProperty[] = [];
    for (const member of [...byName.values()].sort(byLocationThenName)) {
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
      properties.push({
        name: name.data,
        type: resolved.ref,
        // R5.6, R5.8: the member's doc comment, else its getter's.
        description:
          member.documentation ?? getters.get(member.id)?.documentation ?? null,
        optional: resolved.optional,
      });
    }
    return properties;
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

  /* -------------------------------------------------------- behaviours */

  /** R9.1 to R9.3: the public methods of each block, overloads collapsed. */
  private collectBehaviours(): void {
    for (const block of this.blocks.values()) {
      const getters = new Set(this.gettersOf(block).values());
      const methods = block.artifact
        .children(block.node.id)
        .filter(
          (member): member is MethodNode =>
            member.kind === 'method' &&
            this.isBehaviourCandidate(member, getters),
        );
      const byName = new Map<ElementName, Located<MethodNode>[]>();
      for (const node of methods) {
        const located: Located<MethodNode> = { artifact: block.artifact, node };
        const name = this.behaviourNameOf(located);
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
        this.behaviours.set(id, { id, block, name, chosen, overloads });
        for (const overload of overloads) {
          this.behaviourOfMethod.set(
            globalId(overload.artifact, overload.node.id),
            id,
          );
        }
      }
    }
    this.reportHomelessBehaviours();
  }

  /**
   * R9.1, and R5.7, R5.8: a record component's accessor, and a getter that
   * makes its field a property, are the property, not a behaviour.
   */
  private isBehaviourCandidate(
    method: MethodNode,
    getters: ReadonlySet<MethodNode>,
  ): boolean {
    if (method.methodKind !== 'method' || method.origin === 'generated')
      return false;
    if (isRecordComponent(method)) return false;
    if (this.excluded(method.annotations)) return false;
    if (hasRole(method.annotations, 'behaviour', this.vocabulary)) return true;
    return (
      method.visibility === 'public' &&
      !getters.has(method) &&
      !this.vocabulary.technicalMembers.has(method.name)
    );
  }

  /** R9.2: the behaviour role's name on the method or the members it stands in for, else the code's. */
  private behaviourNameOf(method: Located<MethodNode>): ElementName {
    for (const member of this.memberHierarchy(method)) {
      for (const { annotation } of rolesOf(
        member.node.annotations,
        'behaviour',
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
          `${member.node.id}: the behaviour name "${override}" is no element name; the code's name is used`,
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

  /** R9.11: a behaviour role on a method whose type is no block has no home. */
  private reportHomelessBehaviours(): void {
    for (const artifact of this.index.artifacts) {
      for (const node of artifact.file.nodes) {
        if (
          node.kind !== 'method' ||
          !hasRole(node.annotations, 'behaviour', this.vocabulary)
        ) {
          continue;
        }
        if (!this.behaviourOfMethod.has(globalId(artifact, node.id))) {
          this.info(
            `${node.id} is marked a behaviour but its type is no building block; dropped`,
            node,
          );
        }
      }
    }
  }

  private toBehaviour(
    behaviour: Behaviour,
    invokes: Set<BehaviorId>,
  ): ScannedBehaviour {
    const { chosen, block } = behaviour;
    const hierarchy = this.memberHierarchy(chosen);
    const scope = this.scopeFor(chosen.artifact, chosen.node);
    const input: ScannedParameter[] = [];
    for (const parameter of chosen.node.signature.parameters) {
      const resolved = resolveTypeRef(parameter.type, scope);
      const name = ElementName.safeParse(parameter.name);
      if (resolved === null || !name.success) {
        this.debug(
          `${chosen.node.id}: parameter ${parameter.name} has no word in the system model; left out`,
          chosen.node,
        );
        continue;
      }
      input.push({
        name: name.data,
        type: resolved.ref,
        description: null,
        optional: parameter.optional || resolved.optional,
      });
    }
    const returned = resolveTypeRef(chosen.node.signature.returnType, scope);
    return {
      id: behaviour.id,
      buildingBlockId: block.id,
      name: behaviour.name,
      type: this.behaviourTypeOf(hierarchy),
      description:
        this.descriptionOf(chosen.node) ??
        behaviour.overloads
          .map((overload) => this.descriptionOf(overload.node))
          .find((text) => text !== null) ??
        null,
      visibility:
        chosen.node.visibility === 'public'
          ? { kind: 'public', actors: this.actorsOf(hierarchy, block.node) }
          : { kind: 'private' },
      input,
      output:
        returned === null
          ? []
          : [
              {
                type: returned.ref,
                description: null,
                optional: returned.optional,
              },
            ],
      invokes: [...invokes]
        .filter((id) => id !== behaviour.id)
        .sort(byCodeUnit),
      rules: [],
      scenarios: this.scenariosOf(
        behaviour.overloads.map((overload) => overload.node),
      ),
      source: locationOf(chosen.node),
    };
  }

  /** R9.4: `TriggeredBy` of a behaviour role, or the type the role itself fixes, nearest member first; a Command without one. */
  private behaviourTypeOf(
    hierarchy: readonly Located<MethodNode>[],
  ): BehaviourType {
    for (const member of hierarchy) {
      for (const { annotation, role } of rolesOf(
        member.node.annotations,
        'behaviour',
        this.vocabulary,
      )) {
        const triggeredBy = enumArgument(
          annotation,
          this.vocabulary.arguments.triggeredBy,
        );
        if (
          triggeredBy === 'Command' ||
          triggeredBy === 'Query' ||
          triggeredBy === 'Event'
        ) {
          return triggeredBy;
        }
        if (role.type !== undefined) return role.type;
      }
    }
    return 'Command';
  }

  /** R9.5: the actor roles on the method, the members it stands in for, and its type. */
  private actorsOf(
    hierarchy: readonly Located<MethodNode>[],
    type: TypeNode,
  ): string[] {
    const annotations = [
      ...hierarchy.map((m) => m.node.annotations),
      type.annotations,
    ].flat();
    return sortedUnique(
      rolesOf(annotations, 'actor', this.vocabulary).flatMap(
        ({ annotation }) => {
          const name = stringArgument(
            annotation,
            this.vocabulary.arguments.name,
          );
          return name === null ? [] : [name];
        },
      ),
    );
  }

  /* ------------------------------------------------------- invocations */

  /** R11.1 to R11.3: which behaviours each behaviour calls. */
  private collectInvocations(): Map<BehaviorId, Set<BehaviorId>> {
    const invokes = new Map<BehaviorId, Set<BehaviorId>>();
    for (const artifact of this.index.artifacts) {
      for (const [from, targets] of artifact.invokedBy) {
        const caller = artifact.nodes.get(from);
        if (caller?.kind !== 'method') continue;
        const sources = this.behavioursOfMember({ artifact, node: caller });
        if (sources.size === 0) continue;
        for (const to of targets) {
          for (const target of this.callTargetsOf(artifact, to)) {
            for (const source of sources) {
              if (source === target) continue;
              let set = invokes.get(source);
              if (set === undefined) invokes.set(source, (set = new Set()));
              set.add(target);
            }
          }
        }
      }
    }
    return invokes;
  }

  /** The behaviours a method stands for: its own and those of the members it overrides or implements. */
  private behavioursOfMember(method: Located<MethodNode>): Set<BehaviorId> {
    const key = globalId(method.artifact, method.node.id);
    let found = this.memberBehaviours.get(key);
    if (found === undefined) {
      found = new Set();
      for (const member of this.memberHierarchy(method)) {
        const id = this.behaviourOfMethod.get(
          globalId(member.artifact, member.node.id),
        );
        if (id !== undefined) found.add(id);
      }
      this.memberBehaviours.set(key, found);
    }
    return found;
  }

  /**
   * R11.2: the behaviours a call to `to` reaches: those of the method, or,
   * when it has none, those its own calls reach, transitively. A method on a
   * cycle contributes what was found before the cycle closed.
   */
  private callTargetsOf(from: IndexedArtifact, to: NodeId): Set<BehaviorId> {
    const located = this.index.resolveMethod(from, to);
    if (located === null) return new Set();
    const key = globalId(located.artifact, located.node.id);
    const known = this.callTargets.get(key);
    if (known !== undefined) return known;
    const direct = this.behavioursOfMember(located);
    if (direct.size > 0) {
      this.callTargets.set(key, direct);
      return direct;
    }
    const reached = new Set<BehaviorId>();
    this.callTargets.set(key, reached);
    if (located.node.methodKind !== 'constructor') {
      for (const next of located.artifact.invokedBy.get(located.node.id) ??
        []) {
        for (const id of this.callTargetsOf(located.artifact, next))
          reached.add(id);
      }
    }
    return reached;
  }

  /* ----------------------------------------------------------- modules */

  /** R6.2 to R6.4: a module per prefix of every block's module path. */
  private modules(): ScannedDomainModule[] {
    const namespaceLocations = this.namespaceLocations();
    const modules = new Map<ModuleId, ScannedDomainModule>();
    for (const block of this.blocks.values()) {
      for (let depth = 1; depth <= block.modulePath.length; depth++) {
        const path = block.modulePath.slice(0, depth);
        const id = moduleIdOf(path);
        if (modules.has(id)) continue;
        modules.set(id, {
          id,
          name: ElementName.parse(path.at(-1)),
          description: null,
          rules: [],
          source:
            namespaceLocations.get(path.join('.')) ??
            this.directoryAbove(block, block.modulePath.length - depth),
        });
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

  /* ------------------------------------------------------------ shared */

  private excluded(annotations: readonly Annotation[]): boolean {
    return hasRole(annotations, 'exclude', this.vocabulary);
  }

  /** Resolves `member`'s types from its artifact; what cannot be said is a debug diagnostic. */
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
    };
  }

  private info(message: string, node: DeclarationNode): void {
    this.diagnostics.push({
      level: 'info',
      message,
      source: sourceOrNull(node),
    });
  }

  private debug(message: string, node: DeclarationNode): void {
    this.diagnostics.push({
      level: 'debug',
      message,
      source: sourceOrNull(node),
    });
  }
}

function moduleIdOf(path: readonly string[]): ModuleId {
  const [root, ...rest] = path;
  if (root === undefined) throw new Error('A module path is never empty.');
  return rest.reduce<ModuleId>(
    (parent, name) => ModuleId.within(parent, name),
    ModuleId.root(root),
  );
}

/** The Java scanner marks a record's component field and accessor; the field is the property (R5.7). */
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
