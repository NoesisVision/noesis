import { describe, expect, it } from 'bun:test';
import type {
  Annotation,
  AnnotationValue,
  CodeModelFile,
  DeclarationNode,
  Edge,
  LanguageBag,
  MethodNode,
  Modifier,
  ParseManifest,
  SourceSpan,
  StubNode,
  TypeKind,
  TypeParameter,
  TypeRef,
  Visibility,
} from '#backend/app/scanners/code-parsers/code-model';
import type { FeatureFileSource } from '#backend/app/scanners/feature-files/feature-file';
import { unquote } from '#backend/app/scanners/system-model-builders/annotations';
import {
  type BuiltSystemModel,
  buildSystemModel,
} from '#backend/app/scanners/system-model-builders/build-system-model';
import { CSHARP_VOCABULARY } from '#backend/app/scanners/system-model-builders/csharp.vocabulary';
import { JAVA_VOCABULARY } from '#backend/app/scanners/system-model-builders/java.vocabulary';
import type { LibraryManifest } from '#backend/app/scanners/system-model-builders/library-manifest';
import {
  NamespaceConfig,
  type NamespaceConfigInput,
} from '#backend/app/scanners/system-model-builders/namespace-config';
import type { AnnotationVocabulary } from '#backend/app/scanners/system-model-builders/vocabulary';
import { SystemModel } from '#backend/app/system-model/system-model';
import {
  extendsOf,
  inputOf,
  invokesOf,
  outputOf,
  stateOf,
} from '../support/relations';

/*
 * One `describe` per section of docs/plans/code-model-to-system-model.md,
 * one `it` per rule, each over the smallest code model that shows it. The
 * builder below writes a `CodeModelFile` the way the .NET parser does:
 * `T:A.B.Order+Line` is a nested type, `M:A.B.Order#Place(…)` a method,
 * `P:A.B.Order.Total` a property; the parent is read off the id.
 */

/* --------------------------------------------------------- type refs */

type Nullable = Extract<TypeRef, { nullable: boolean }>;
const named = (type: string, ...typeArguments: TypeRef[]): Nullable => ({
  kind: 'named',
  type,
  typeArguments,
  unbound: false,
  nullable: false,
});
const prim = (name: string): Nullable => ({
  kind: 'primitive',
  name,
  nullable: false,
});
const nullable = (ref: Nullable): TypeRef => ({ ...ref, nullable: true });
const arr = (element: TypeRef): TypeRef => ({
  kind: 'array',
  element,
  rank: 1,
  nullable: false,
});
const tparam = (owner: string, ordinal = 0): TypeRef => ({
  kind: 'typeParameter',
  owner,
  ordinal,
  nullable: false,
});
const VOID: TypeRef = { kind: 'void' };

const SYS = {
  task: 'T:System.Threading.Tasks.Task',
  taskOf: 'T:System.Threading.Tasks.Task`1',
  valueTaskOf: 'T:System.Threading.Tasks.ValueTask`1',
  nullableOf: 'T:System.Nullable`1',
  guid: 'T:System.Guid',
  dateTime: 'T:System.DateTime',
  list: 'T:System.Collections.Generic.List`1',
  enumerable: 'T:System.Collections.Generic.IEnumerable`1',
  dictionary: 'T:System.Collections.Generic.Dictionary`2',
  func: 'T:System.Func`2',
  cancellation: 'T:System.Threading.CancellationToken',
  object: 'T:System.Object',
};

const JAVA = {
  boolean: 'T:java.lang.Boolean',
  string: 'T:java.lang.String',
  list: 'T:java.util.List`1',
};

/* ------------------------------------------------------- annotations */

const ANNOTATIONS = 'T:NoesisVision.Annotations';
type ArgumentInput = string | null;

function attr(
  short: string,
  args: Record<string, ArgumentInput> = {},
): Annotation {
  return {
    type: named(`${ANNOTATIONS}.${short}`),
    arguments: Object.entries(args).map(([name, value]) => ({
      name,
      positional: name === 'name' || name === 'markdownText',
      value: argumentValue(value),
    })),
  };
}

function argumentValue(value: ArgumentInput): AnnotationValue {
  return value === null
    ? { kind: 'literal', text: 'null' }
    : { kind: 'literal', text: JSON.stringify(value) };
}

const aggregate = (name: string | null = null) =>
  attr('Domain.DDD.DddAggregateAttribute', { name });
const entity = (name: string | null = null) =>
  attr('Domain.DDD.DddEntityAttribute', { name });
const valueObject = (name: string | null = null) =>
  attr('Domain.DDD.DddValueObjectAttribute', { name });
const repository = (name: string | null = null) =>
  attr('Domain.DDD.DddRepositoryAttribute', { name });
const domainService = () => attr('Domain.DDD.DddDomainServiceAttribute');
const behavior = (name: string | null = null) =>
  attr('Domain.DomainBehaviorAttribute', { name });
const actor = (name: string) => attr('People.ActorAttribute', { name });
const description = (markdownText: string) =>
  attr('ShortDescriptionAttribute', { markdownText });
/** Reqnroll's `[When("…")]`: the step definition a `When` step binds to. */
const when = (expression: string): Annotation => ({
  type: named('T:Reqnroll.WhenAttribute'),
  arguments: [
    {
      name: 'expression',
      positional: true,
      value: { kind: 'literal', text: JSON.stringify(expression) },
    },
  ],
});
const exclude = () => attr('ExcludeFromDocsAttribute');
const domainModel = () => attr('Domain.DomainModelAttribute');

/** A `vision.noesis.annotations` annotation, which carries no arguments. */
const javaAnnotation = (short: string): Annotation => ({
  type: named(`T:vision.noesis.annotations.${short}`),
  arguments: [],
});

/** Java's `@Layer("<name>")`, written on a `package-info.java`: one string argument, named `value`. */
const javaLayer = (name: string): Annotation => ({
  type: named('T:vision.noesis.annotations.Layer'),
  arguments: [
    {
      name: 'value',
      positional: true,
      value: { kind: 'literal', text: JSON.stringify(name) },
    },
  ],
});

/** Java's `@Actor("<name>")`: one string argument, named `value`. */
const javaActor = (name: string): Annotation => ({
  type: named('T:vision.noesis.annotations.Actor'),
  arguments: [
    {
      name: 'value',
      positional: true,
      value: { kind: 'literal', text: JSON.stringify(name) },
    },
  ],
});

/** Java's `@Adapter(Direction.<direction>)`: one enum argument, named `value`. */
const javaAdapter = (direction: string): Annotation => ({
  type: named('T:vision.noesis.annotations.Adapter'),
  arguments: [
    {
      name: 'value',
      positional: true,
      value: {
        kind: 'enum',
        type: named('T:vision.noesis.annotations.Direction'),
        member: direction,
      },
    },
  ],
});

/* ----------------------------------------------------------- builder */

interface TypeOptions {
  kind?: TypeKind;
  annotations?: Annotation[];
  visibility?: Visibility;
  modifiers?: Modifier[];
  typeParameters?: TypeParameter[];
  extends?: TypeRef[];
  implements?: TypeRef[];
  documentation?: string | null;
  file?: string;
}

interface ParameterInput {
  name: string;
  type: TypeRef;
  optional?: boolean;
}

interface MethodOptions {
  languageSpecific?: LanguageBag;
  parameters?: ParameterInput[];
  returns?: TypeRef;
  annotations?: Annotation[];
  visibility?: Visibility;
  modifiers?: Modifier[];
  methodKind?: MethodNode['methodKind'];
  origin?: 'declared' | 'generated';
  typeParameters?: TypeParameter[];
  overrides?: string[];
  implementsMember?: string[];
  invokes?: string[];
  documentation?: string | null;
  file?: string;
}

interface MemberOptions {
  languageSpecific?: LanguageBag;
  annotations?: Annotation[];
  visibility?: Visibility;
  modifiers?: Modifier[];
  origin?: 'declared' | 'generated';
  documentation?: string | null;
  accessors?: ('get' | 'set' | 'init' | 'add' | 'remove')[];
  indexer?: boolean;
  constantValue?: string | null;
  enumMember?: boolean;
  file?: string;
  line?: number;
}

function typeParameter(
  name: string,
  ordinal: number,
  constraints: TypeRef[] = [],
): TypeParameter {
  return {
    name,
    ordinal,
    annotations: [],
    variance: 'invariant',
    constraints: constraints.map((type) => ({ kind: 'type', type })),
    languageSpecific: {},
  };
}

class ArtifactBuilder {
  readonly id: string;
  private readonly nodes: DeclarationNode[] = [];
  private readonly edges: Edge[] = [];
  private readonly stubs: StubNode[] = [];
  private readonly annotations: Annotation[];
  private readonly dependencies: string[];
  private readonly executable: boolean;
  private line = 1;

  constructor(
    readonly name: string,
    options: ArtifactOptions = {},
  ) {
    this.id = `A:${name}`;
    this.annotations = options.annotations ?? [];
    this.dependencies = options.dependsOn ?? [];
    this.executable = options.executable ?? false;
  }

  private location(file?: string, line?: number): SourceSpan {
    const startLine = line ?? this.line++;
    return {
      file: file ?? `${this.name}/${this.name}.cs`,
      startLine,
      startColumn: 1,
      endLine: startLine,
      endColumn: 1,
    };
  }

  private contains(parent: string, child: string): void {
    this.edges.push({ kind: 'CONTAINS', from: parent, to: child });
  }

  /** `N:A.B.C`, with every level above it; `annotations` go on `N:A.B.C` itself. */
  namespace(
    dotted: string,
    file?: string,
    annotations: readonly Annotation[] = [],
  ): this {
    const parts = dotted.split('.');
    for (let depth = 1; depth <= parts.length; depth++) {
      const id = `N:${parts.slice(0, depth).join('.')}`;
      const existing = this.nodes.find((node) => node.id === id);
      if (existing !== undefined) {
        if (file !== undefined) existing.locations.push(this.location(file));
        continue;
      }
      this.nodes.push({
        kind: 'namespace',
        id,
        name: parts[depth - 1]!,
        origin: 'declared',
        locations: [this.location(file)],
        annotations: [],
        documentation: null,
        languageSpecific: {},
      });
    }
    this.nodes
      .find((node) => node.id === `N:${dotted}`)!
      .annotations.push(...annotations);
    return this;
  }

  type(id: string, options: TypeOptions = {}): this {
    const path = id.slice(2);
    const plus = path.lastIndexOf('+');
    const dot = path.lastIndexOf('.');
    const namespace = plus === -1 && dot !== -1 ? path.slice(0, dot) : '';
    const parent = plus === -1 ? `N:${namespace}` : `T:${path.slice(0, plus)}`;
    if (plus === -1) {
      if (namespace === '') {
        if (!this.nodes.some((node) => node.id === 'N:')) {
          this.nodes.push({
            kind: 'namespace',
            id: 'N:',
            name: '',
            origin: 'declared',
            locations: [],
            annotations: [],
            documentation: null,
            languageSpecific: {},
          });
        }
      } else {
        this.namespace(namespace, options.file);
      }
    }
    const simple = path.slice(plus === -1 ? dot + 1 : plus + 1);
    this.nodes.push({
      kind: 'type',
      id,
      name: simple.replace(/`\d+$/, ''),
      origin: 'declared',
      locations: [this.location(options.file)],
      annotations: options.annotations ?? [],
      documentation: options.documentation ?? null,
      languageSpecific: {},
      typeKind: options.kind ?? 'class',
      visibility: options.visibility ?? 'public',
      modifiers: options.modifiers ?? [],
      typeParameters: options.typeParameters ?? [],
      underlyingType: null,
      delegateSignature: null,
      aliasOf: null,
    });
    this.contains(parent, id);
    for (const to of options.extends ?? []) {
      this.edges.push({ kind: 'EXTENDS', from: id, to });
    }
    for (const to of options.implements ?? []) {
      this.edges.push({ kind: 'IMPLEMENTS', from: id, to });
    }
    return this;
  }

  method(id: string, options: MethodOptions = {}): this {
    const hash = id.indexOf('#');
    const parent = `T:${id.slice(2, hash)}`;
    const name = id.slice(hash + 1, id.indexOf('(')).replace(/`\d+$/, '');
    this.nodes.push({
      kind: 'method',
      id,
      name,
      origin: options.origin ?? 'declared',
      locations: [this.location(options.file)],
      annotations: options.annotations ?? [],
      documentation: options.documentation ?? null,
      languageSpecific: options.languageSpecific ?? {},
      methodKind: options.methodKind ?? 'method',
      visibility: options.visibility ?? 'public',
      modifiers: options.modifiers ?? [],
      typeParameters: options.typeParameters ?? [],
      signature: {
        parameters: (options.parameters ?? []).map((parameter) => ({
          name: parameter.name,
          type: parameter.type,
          passing: 'value',
          variadic: false,
          optional: parameter.optional ?? false,
          defaultValue: parameter.optional ? 'default' : null,
          annotations: [],
          languageSpecific: {},
        })),
        returnType: options.returns ?? VOID,
        returnPassing: 'value',
        returnAnnotations: [],
      },
      extensionReceiver: null,
      bodiless: false,
    });
    this.contains(parent, id);
    for (const to of options.overrides ?? []) {
      this.edges.push({ kind: 'OVERRIDES', from: id, to });
    }
    for (const to of options.implementsMember ?? []) {
      this.edges.push({
        kind: 'IMPLEMENTS_MEMBER',
        from: id,
        to,
        interface: named(`T:${to.slice(2, to.indexOf('#'))}`),
        declaredOn: parent,
      });
    }
    for (const to of options.invokes ?? []) this.invokes(id, to);
    return this;
  }

  property(id: string, type: TypeRef, options: MemberOptions = {}): this {
    const path = id.slice(2);
    const dot = path.lastIndexOf('.');
    this.nodes.push({
      kind: 'property',
      id,
      name: path.slice(dot + 1),
      origin: options.origin ?? 'declared',
      locations: [this.location(options.file, options.line)],
      annotations: options.annotations ?? [],
      documentation: options.documentation ?? null,
      languageSpecific: {},
      visibility: options.visibility ?? 'public',
      modifiers: options.modifiers ?? [],
      type,
      returnPassing: 'value',
      parameters: options.indexer
        ? [
            {
              name: 'index',
              type: prim('int'),
              passing: 'value',
              variadic: false,
              optional: false,
              defaultValue: null,
              annotations: [],
              languageSpecific: {},
            },
          ]
        : [],
      extensionReceiver: null,
      accessors: options.accessors ?? ['get', 'set'],
    });
    this.contains(`T:${path.slice(0, dot)}`, id);
    return this;
  }

  field(id: string, type: TypeRef, options: MemberOptions = {}): this {
    const path = id.slice(2);
    const dot = path.lastIndexOf('.');
    this.nodes.push({
      kind: 'field',
      id,
      name: path.slice(dot + 1),
      origin: options.origin ?? 'declared',
      locations: [this.location(options.file, options.line)],
      annotations: options.annotations ?? [],
      documentation: options.documentation ?? null,
      languageSpecific: options.languageSpecific ?? {},
      fieldKind: options.enumMember ? 'enumMember' : 'field',
      visibility: options.visibility ?? 'public',
      modifiers: options.modifiers ?? [],
      type,
      passing: 'value',
      constantValue: options.constantValue ?? null,
    });
    this.contains(`T:${path.slice(0, dot)}`, id);
    return this;
  }

  stub(id: string, kind: StubNode['kind'] = 'type'): this {
    this.stubs.push({
      id,
      kind,
      name: id.slice(id.lastIndexOf('.') + 1),
      typeKind: kind === 'type' ? 'class' : null,
      artifact: 'A:System.Runtime@10.0.0.0',
    });
    return this;
  }

  /** An `INVOKES` edge; `from` may be a property or field (an initialiser). */
  invokes(from: string, to: string): this {
    this.edges.push({
      kind: 'INVOKES',
      from,
      to,
      typeArguments: [],
      site: {
        location: this.location(),
        viaClosure: false,
        languageSpecific: {},
      },
      invocationKind: 'call',
      receiver: null,
    });
    return this;
  }

  build(): CodeModelFile {
    return {
      schemaVersion: 1,
      generator: { name: 'spec', version: '0' },
      artifact: {
        id: this.id,
        kind: 'source',
        name: this.name,
        version: null,
        rootDirectory: this.name,
        target: 'net10.0',
        executable: this.executable,
        dependencies: this.dependencies.map((id) => ({
          id,
          kind: 'source',
          package: null,
        })),
        annotations: this.annotations,
        languageSpecific: {},
      },
      nodes: this.nodes,
      edges: this.edges,
      stubs: this.stubs,
      diagnostics: [],
    };
  }
}

interface ArtifactOptions {
  annotations?: Annotation[];
  dependsOn?: string[];
  /** Built to run on its own: a deployable unit rather than a library (R13). */
  executable?: boolean;
}

const artifact = (name: string, options?: ArtifactOptions) =>
  new ArtifactBuilder(name, options);

/** Builds the system model of the artifacts in the given (dependency) order. */
function buildFrom(
  artifacts: ArtifactBuilder[],
  config: NamespaceConfigInput = {},
  vocabulary: AnnotationVocabulary = CSHARP_VOCABULARY,
  featureFiles: readonly FeatureFileSource[] = [],
  libraries: readonly LibraryManifest[] = [],
): BuiltSystemModel {
  const files = artifacts.map((a) => a.build());
  const manifest: ParseManifest = {
    schemaVersion: 1,
    generator: { name: 'spec', version: '0' },
    language: vocabulary.language,
    repository: { name: 'spec', revision: 'none' },
    root: '',
    artifacts: files.map((file) => ({
      id: file.artifact.id,
      file: `${file.artifact.name}.code-model.json`,
    })),
    diagnostics: [],
  };
  const built = buildSystemModel({
    manifest,
    files,
    featureFiles,
    vocabulary,
    config: NamespaceConfig.of(config),
    libraries,
  });
  // Whatever the builder yields must be a system model.
  SystemModel.parse({
    id: '019a0000-0000-7000-8000-000000000000',
    name: 'spec',
    scanned_at: '2026-10-21T00:00:00.000Z',
    ...built.model,
  });
  return built;
}

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
/** The names of a block's state, in the model's order. */
const stateNamesOf = (model: BuiltSystemModel['model'], block: string) =>
  stateOf(model, block).map((slot) => (slot as string[])[0]);
/** A block's state as `[name, to]`. */
const stateTypesOf = (model: BuiltSystemModel['model'], block: string) =>
  stateOf(model, block).map((slot) => (slot as string[]).slice(0, 2));
/** A block's collaborators as `[name, to]`, in the model's order. */
const collaboratorsOf = (model: BuiltSystemModel['model'], block: string) =>
  model.relations.flatMap((relation) =>
    relation.kind === 'has_collaborator' && relation.from === block
      ? [[relation.name, relation.to]]
      : [],
  );
const messages = (built: BuiltSystemModel, level?: 'info' | 'debug') =>
  built.diagnostics
    .filter((d) => level === undefined || d.level === level)
    .map((d) => d.message);

/** A `Sales` artifact with the aggregate `Sales.Orders.Order`, to hang members on. */
function sales(): ArtifactBuilder {
  return artifact('Sales').type('T:Sales.Orders.Order', {
    annotations: [aggregate()],
  });
}
const ORDER = 'building_block|Sales.Orders.Order';

/* ====================================================== 2 vocabulary */

describe('2. the annotation vocabulary', () => {
  it('reads a literal as the compiler spells it: quoted, verbatim, raw, or null', () => {
    expect<unknown>(unquote('"Customer order"')).toBe('Customer order');
    expect<unknown>(unquote('"Say \\"hi\\"\\n"')).toBe('Say "hi"\n');
    expect<unknown>(unquote('@"C:\\x ""quoted"""')).toBe('C:\\x "quoted"');
    expect<unknown>(unquote('"""  raw text  """')).toBe('raw text');
    // A Java text block spells itself the raw way.
    expect<unknown>(unquote('"""\n    Placed by the customer.\n    """')).toBe(
      'Placed by the customer.',
    );
    expect<unknown>(unquote('null')).toBe(null);
    expect<unknown>(unquote('42')).toBe('42');
  });

  it('matches an annotation by the id of its type alone: the package base type is no role', () => {
    const { model } = buildFrom([
      artifact('Sales')
        .type('T:Sales.A', {
          annotations: [attr('Domain.DomainObjectAttribute', { name: 'A' })],
        })
        .type('T:Sales.B', { annotations: [domainModel()] })
        .type('T:Sales.C', {
          annotations: [attr('Domain.ReadModelAttribute')],
        }),
    ]);
    expect<unknown>(ids(model.buildingBlocks)).toEqual([
      'building_block|Sales.C',
    ]);
    expect<unknown>(model.buildingBlocks[0]?.type).toBe('value_object');
  });

  it('takes an argument whose literal is null as absent', () => {
    const { model, diagnostics } = buildFrom([
      artifact('Sales').type('T:Sales.Order', {
        annotations: [aggregate(null)],
      }),
    ]);
    expect<unknown>(ids(model.buildingBlocks)).toEqual([
      'building_block|Sales.Order',
    ]);
    expect<unknown>(diagnostics).toEqual([]);
  });
});

/* ============================================================ 3 scope */

describe('3. scope', () => {
  it('R3.1 reads an excluded artifact for resolution only: no block, module or behavior from it', () => {
    const technical = artifact('Technical', { annotations: [exclude()] })
      .type('T:Technical.Entity', { annotations: [entity()] })
      .type('T:Technical.Guard', { modifiers: ['static'] })
      .method('M:Technical.Guard#Check(object)', { modifiers: ['static'] });
    const sales = artifact('Sales', { dependsOn: ['A:Technical'] })
      .type('T:Sales.Order', {
        annotations: [aggregate()],
        extends: [named('T:Technical.Entity')],
      })
      .method('M:Sales.Order#Total()', { returns: prim('decimal') })
      .method('M:Sales.Order#Place()', {
        invokes: ['M:Technical.Guard#Check(object)', 'M:Sales.Audit#Run()'],
      })
      // An excluded type: no block, but its calls are stepped through (R3.3).
      .type('T:Sales.Audit', { annotations: [domainService(), exclude()] })
      .method('M:Sales.Audit#Run()', { invokes: ['M:Sales.Order#Total()'] });
    const { model } = buildFrom([technical, sales]);
    expect<unknown>(ids(model.modules)).toEqual(['module|Sales']);
    expect<unknown>(ids(model.buildingBlocks)).toEqual([
      'building_block|Sales.Order',
    ]);
    expect<unknown>(extendsOf(model, 'building_block|Sales.Order')).toEqual([]);
    expect<unknown>(invokesOf(model, 'behavior|Sales.Order.Place')).toEqual([
      'behavior|Sales.Order.Total',
    ]);
  });

  it('R3.2 drops a namespace .noesis/settings.json excludes, with everything in it', () => {
    const { model, diagnostics } = buildFrom(
      [
        artifact('Sales')
          .type('T:Sales.Orders.Order', { annotations: [aggregate()] })
          .type('T:Sales.Internal.Tools.Hidden', {
            annotations: [domainService()],
          }),
      ],
      { namespacesToExclude: ['*.Internal.*'] },
    );
    expect<unknown>(ids(model.buildingBlocks)).toEqual([
      'building_block|Sales.Orders.Order',
    ]);
    expect<unknown>(ids(model.modules)).toEqual([
      'module|Sales',
      'module|Sales.Orders',
    ]);
    expect<unknown>(diagnostics.map((d) => d.message)).toEqual([
      expect.stringContaining('T:Sales.Internal.Tools.Hidden'),
    ]);
  });

  it('R3.3 drops an excluded type, method or property, and nothing else with it', () => {
    const { model } = buildFrom([
      sales()
        .type('T:Sales.Orders.Draft', { annotations: [aggregate(), exclude()] })
        .method('M:Sales.Orders.Order#Place()')
        .method('M:Sales.Orders.Order#Debug()', { annotations: [exclude()] })
        .property('P:Sales.Orders.Order.Total', prim('decimal'))
        .property('P:Sales.Orders.Order.Secret', prim('string'), {
          annotations: [exclude()],
        })
        .type('T:Sales.Orders.Special', {
          annotations: [aggregate()],
          extends: [named('T:Sales.Orders.Draft')],
        }),
    ]);
    expect<unknown>(ids(model.buildingBlocks)).toEqual([
      ORDER,
      'building_block|Sales.Orders.Special',
    ]);
    expect<unknown>(ids(model.behaviors)).toEqual([
      'behavior|Sales.Orders.Order.Place',
    ]);
    expect<unknown>(stateNamesOf(model, ORDER)).toEqual(['Total']);
  });

  it('R3.4 never makes a generated member a behavior or a property', () => {
    const { model } = buildFrom([
      sales()
        .method('M:Sales.Orders.Order#<Clone>$()', { origin: 'generated' })
        .method('M:Sales.Orders.Order#Place()')
        .property('P:Sales.Orders.Order.EqualityContract', prim('string'), {
          origin: 'generated',
        })
        .property('P:Sales.Orders.Order.Total', prim('decimal')),
    ]);
    expect<unknown>(ids(model.behaviors)).toEqual([
      'behavior|Sales.Orders.Order.Place',
    ]);
    expect<unknown>(stateNamesOf(model, ORDER)).toEqual(['Total']);
  });

  it('R3.5 never makes a stub an element, however it is referenced', () => {
    const { model } = buildFrom([
      sales()
        .stub('T:External.Entity')
        .type('T:Sales.Orders.Line', {
          annotations: [entity()],
          extends: [named('T:External.Entity')],
        })
        .property('P:Sales.Orders.Order.Base', named('T:External.Entity')),
    ]);
    expect<unknown>(ids(model.buildingBlocks)).toEqual([
      'building_block|Sales.Orders.Line',
      ORDER,
    ]);
    expect<unknown>(
      extendsOf(model, 'building_block|Sales.Orders.Line'),
    ).toEqual([]);
    expect<unknown>(stateOf(model, ORDER)).toEqual([]);
  });
});

/* ================================================== 4 building blocks */

describe('4. building blocks', () => {
  it('R4.1 takes a class, struct, interface or enum with its own annotation, never a delegate', () => {
    const { model } = buildFrom([
      artifact('Sales')
        .type('T:Sales.A', { kind: 'class', annotations: [aggregate()] })
        .type('T:Sales.B', { kind: 'struct', annotations: [valueObject()] })
        .type('T:Sales.C', { kind: 'interface', annotations: [repository()] })
        .type('T:Sales.D', { kind: 'enum', annotations: [valueObject()] })
        .type('T:Sales.E', { kind: 'delegate', annotations: [valueObject()] })
        .type('T:Sales.F', { kind: 'class' }),
    ]);
    expect<unknown>(model.buildingBlocks.map((b) => [b.name, b.type])).toEqual([
      ['A', 'aggregate'],
      ['B', 'value_object'],
      ['C', 'repository'],
      ['D', 'value_object'],
    ]);
  });

  it('R4.1 reads messages, adapters by their direction and technical services as kinds of their own', () => {
    const java = buildFrom(
      [
        artifact('shop')
          .type('T:com.acme.PlaceOrder', {
            annotations: [javaAnnotation('Command')],
          })
          .type('T:com.acme.FindOrder', {
            annotations: [javaAnnotation('Query')],
          })
          .type('T:com.acme.OrderPlaced', {
            annotations: [javaAnnotation('Event')],
          })
          .type('T:com.acme.OrdersController', {
            annotations: [javaAdapter('PRIMARY')],
          })
          .type('T:com.acme.SmtpMailer', {
            annotations: [javaAdapter('SECONDARY')],
          })
          .type('T:com.acme.Weather', {
            annotations: [javaAnnotation('ExternalIntegration')],
          })
          .type('T:com.acme.Clock', {
            annotations: [javaAnnotation('TechnicalService')],
          }),
      ],
      {},
      JAVA_VOCABULARY,
    );
    expect<unknown>(
      java.model.buildingBlocks.map((b) => [b.name, b.type]),
    ).toEqual([
      ['Clock', 'technical_service'],
      ['FindOrder', 'query'],
      ['OrderPlaced', 'event'],
      ['OrdersController', 'in_adapter'],
      ['PlaceOrder', 'command'],
      ['SmtpMailer', 'out_adapter'],
      ['Weather', 'external_integration'],
    ]);
    const csharp = buildFrom([
      artifact('Sales')
        .type('T:Sales.Place', {
          annotations: [attr('Domain.CommandAttribute')],
        })
        .type('T:Sales.Placed', {
          annotations: [attr('Domain.DDD.DddDomainEventAttribute')],
        })
        .type('T:Sales.Find', { annotations: [attr('Domain.QueryAttribute')] }),
    ]);
    expect<unknown>(
      csharp.model.buildingBlocks.map((b) => [b.name, b.type]),
    ).toEqual([
      ['Find', 'query'],
      ['Place', 'command'],
      ['Placed', 'event'],
    ]);
  });

  it('R4.1 inherits nothing: a type deriving from a block is no block without its own annotation', () => {
    const { model } = buildFrom([
      sales()
        .type('T:Sales.Orders.SpecialOrder', {
          extends: [named('T:Sales.Orders.Order')],
        })
        .type('T:Sales.Orders.IOrderRepository', {
          kind: 'interface',
          annotations: [repository()],
        })
        .type('T:Sales.Orders.SqlOrderRepository', {
          implements: [named('T:Sales.Orders.IOrderRepository')],
        }),
    ]);
    expect<unknown>(ids(model.buildingBlocks)).toEqual([
      'building_block|Sales.Orders.IOrderRepository',
      ORDER,
    ]);
  });

  it('R4.1 lets the first of two block annotations win, with a diagnostic', () => {
    const built = buildFrom([
      artifact('Sales').type('T:Sales.Order', {
        annotations: [entity(), aggregate()],
      }),
    ]);
    expect<unknown>(built.model.buildingBlocks[0]?.type).toBe('entity');
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining('2 building block annotations'),
    ]);
  });

  it('R4.2 names a block by its annotation, else by the code, enclosing types first', () => {
    const built = buildFrom([
      artifact('Sales')
        .type('T:Sales.Order', { annotations: [aggregate('Customer order')] })
        .type('T:Sales.Order+Repository`1', {
          kind: 'interface',
          annotations: [repository()],
        })
        .type('T:Sales.Order+Item')
        .type('T:Sales.Order+Item+Detail', { annotations: [valueObject()] })
        .type('T:Sales.Order+Line', { annotations: [entity('Order line')] })
        .type('T:Sales.Bad', { annotations: [valueObject('Sales.Bad|x')] }),
    ]);
    expect<unknown>(ids(built.model.buildingBlocks)).toEqual([
      'building_block|Sales.Bad',
      'building_block|Sales.Customer order',
      'building_block|Sales.Order Item Detail',
      'building_block|Sales.Order Repository',
      'building_block|Sales.Order line',
    ]);
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining('"Sales.Bad|x" is no element name'),
    ]);
  });

  it("R4.3 places a block in the module of its namespace, the outermost type's for a nested one, and keeps the first of two with one id", () => {
    const built = buildFrom([
      artifact('Sales')
        .type('T:Sales.Orders.Order', { annotations: [aggregate()] })
        .type('T:Sales.Orders.Order+Line', { annotations: [entity('Line')] })
        .type('T:Sales.Orders.Line', { annotations: [valueObject()] })
        .type('T:Loose', { annotations: [aggregate()] }),
    ]);
    expect<unknown>(ids(built.model.buildingBlocks)).toEqual([
      'building_block|Sales.Orders.Line',
      ORDER,
    ]);
    expect<unknown>(built.model.buildingBlocks[0]?.type).toBe('entity');
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining(
        'T:Sales.Orders.Line in A:Sales has the id of T:Sales.Orders.Order+Line',
      ),
      expect.stringContaining('T:Loose is in the global namespace'),
    ]);
  });

  it('R4.4 extends the blocks among the direct supertypes, type arguments ignored, each once', () => {
    const { model } = buildFrom([
      artifact('Sales')
        .type('T:Sales.IRepository`1', {
          kind: 'interface',
          annotations: [repository()],
        })
        .type('T:Sales.IAudited', { kind: 'interface' })
        .type('T:Sales.Base', { annotations: [domainService()] })
        .type('T:Sales.Derived', { extends: [named('T:Sales.Base')] })
        .type('T:Sales.Zed', { annotations: [valueObject()] })
        .type('T:Sales.OrderRepository', {
          annotations: [repository()],
          extends: [named('T:Sales.Derived')],
          implements: [
            named('T:Sales.Zed'),
            named('T:Sales.IRepository`1', named('T:Sales.Order')),
            named('T:Sales.IAudited'),
            named('T:Sales.IRepository`1', named('T:Sales.Line')),
          ],
        }),
    ]);
    expect<unknown>(
      extendsOf(model, 'building_block|Sales.OrderRepository'),
    ).toEqual(['building_block|Sales.IRepository', 'building_block|Sales.Zed']);
  });

  it('R4.5 describes a block by its ShortDescription, else its doc comment', () => {
    const { model } = buildFrom([
      artifact('Sales')
        .type('T:Sales.A', {
          annotations: [aggregate(), description('*Short*')],
          documentation: 'Doc',
        })
        .type('T:Sales.B', { annotations: [aggregate()], documentation: 'Doc' })
        .type('T:Sales.C', { annotations: [aggregate()] }),
    ]);
    expect<unknown>(model.buildingBlocks.map((b) => b.description)).toEqual([
      '*Short*',
      'Doc',
      null,
    ]);
  });

  it('R4.6 points a block at its first location', () => {
    const { model } = buildFrom([
      artifact('Sales').type('T:Sales.Order', {
        annotations: [aggregate()],
        file: 'Sales/Orders/Order.cs',
      }),
    ]);
    // The namespace nodes take lines 1 and 2 of the builder's counter.
    expect<unknown>(model.buildingBlocks[0]?.source).toEqual({
      path: 'Sales/Orders/Order.cs',
      line: 2,
    });
  });
});

/* ======================================================= 5 properties */

describe('5. state', () => {
  it('R5.1 takes public instance properties and fields as state; not static, event, indexer, enum member or constant ones', () => {
    const { model } = buildFrom([
      sales()
        .property('P:Sales.Orders.Order.Total', prim('decimal'))
        .field('F:Sales.Orders.Order.Count', prim('int'))
        .field('F:Sales.Orders.Order._hidden', prim('int'), {
          visibility: 'private',
        })
        .property('P:Sales.Orders.Order.Internal', prim('int'), {
          visibility: 'artifact',
        })
        .property('P:Sales.Orders.Order.Shared', prim('int'), {
          modifiers: ['static'],
        })
        .property('P:Sales.Orders.Order.Placed', named('T:System.Action'), {
          accessors: ['add', 'remove'],
        })
        .property('P:Sales.Orders.Order.Item', prim('int'), { indexer: true })
        .field('F:Sales.Orders.Order.Max', prim('int'), { constantValue: '10' })
        .type('T:Sales.Orders.Status', {
          kind: 'enum',
          annotations: [valueObject()],
        })
        .field('F:Sales.Orders.Status.Open', named('T:Sales.Orders.Status'), {
          enumMember: true,
          modifiers: ['static'],
          constantValue: '0',
        }),
    ]);
    expect<unknown>(
      stateNamesOf(model, ORDER).toSorted((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    ).toEqual(['Count', 'Total']);
    expect<unknown>(
      stateOf(model, 'building_block|Sales.Orders.Status'),
    ).toEqual([]);
  });

  it('R5.2 makes a field and a property of one name one piece of state, the property winning', () => {
    const { model } = buildFrom([
      sales()
        .field('F:Sales.Orders.Order._total', prim('int'))
        .property('P:Sales.Orders.Order.Total', prim('decimal')),
    ]);
    expect<unknown>(model.relations).toEqual([
      { kind: 'contains', from: 'library|Sales', to: ORDER },
      { kind: 'contains', from: 'module|Sales', to: 'module|Sales.Orders' },
      { kind: 'contains', from: 'module|Sales.Orders', to: ORDER },
      {
        kind: 'has_state',
        from: ORDER,
        to: 'primitive|decimal',
        name: 'Total',
        cardinality: '1',
      },
    ]);
  });

  it('R5.3 leaves out a member whose type has no word in the model, with a debug diagnostic', () => {
    const built = buildFrom([
      sales()
        .stub('T:Sales.Clock')
        .property('P:Sales.Orders.Order.Clock', named('T:Sales.Clock'))
        .property('P:Sales.Orders.Order.Total', prim('decimal')),
    ]);
    expect<unknown>(stateNamesOf(built.model, ORDER)).toEqual(['Total']);
    expect<unknown>(messages(built, 'debug')).toEqual([
      expect.stringContaining('P:Sales.Orders.Order.Clock'),
    ]);
  });

  it('R5.4 gives a nullable or Nullable<T> member the cardinality 0..1, a collection 0..*, anything else 1', () => {
    const { model } = buildFrom([
      sales()
        .property('P:Sales.Orders.Order.A', nullable(prim('string')))
        .property('P:Sales.Orders.Order.B', named(SYS.nullableOf, prim('int')))
        .property(
          'P:Sales.Orders.Order.C',
          nullable(named('T:Sales.Orders.Order')),
        )
        .property('P:Sales.Orders.Order.D', prim('int'))
        .property('P:Sales.Orders.Order.E', named(SYS.list, prim('int')))
        .property(
          'P:Sales.Orders.Order.F',
          nullable(named(SYS.list, nullable(prim('int')))),
        ),
    ]);
    expect<unknown>(
      stateOf(model, ORDER).map((slot) => {
        const [name, , cardinality] = slot as string[];
        return [name, cardinality];
      }),
    ).toEqual([
      ['C', '0..1'],
      ['B', '0..1'],
      ['D', '1'],
      ['E', '0..*'],
      ['F', '0..*'],
      ['A', '0..1'],
    ]);
  });

  it('R5.5 keeps one piece of state per name, whichever member comes first by location', () => {
    const { model } = buildFrom([
      sales()
        .property('P:Sales.Orders.Order.Z', prim('int'), {
          file: 'b.cs',
          line: 1,
        })
        .property('P:Sales.Orders.Order.B', prim('int'), {
          file: 'a.cs',
          line: 9,
        })
        .property('P:Sales.Orders.Order.A', prim('int'), {
          file: 'a.cs',
          line: 9,
        })
        .property('P:Sales.Orders.Order.C', prim('int'), {
          file: 'a.cs',
          line: 2,
        }),
    ]);
    expect<unknown>(stateNamesOf(model, ORDER)).toEqual(['A', 'B', 'C', 'Z']);
  });

  it("R5.7 takes a Java record's components as properties although their fields are private, and their accessors as no behaviors", () => {
    const { model } = buildFrom(
      [
        artifact('shop')
          .type('T:com.acme.Money', {
            modifiers: ['final', 'record'],
            annotations: [javaAnnotation('ValueObject')],
          })
          .field('F:com.acme.Money.amount', prim('long'), {
            visibility: 'private',
            modifiers: ['readonly'],
            languageSpecific: { 'java.isRecordComponent': true },
          })
          .field('F:com.acme.Money.cache', prim('long'), {
            visibility: 'private',
          })
          .method('M:com.acme.Money#amount()', {
            returns: prim('long'),
            languageSpecific: { 'java.isRecordComponent': true },
          })
          .method('M:com.acme.Money#negate()', {
            returns: named('T:com.acme.Money'),
          }),
      ],
      {},
      JAVA_VOCABULARY,
    );
    expect<unknown>(
      stateTypesOf(model, 'building_block|com.acme.Money'),
    ).toEqual([['amount', 'primitive|integer']]);
    expect<unknown>(model.behaviors.map((b) => b.name)).toEqual(['negate']);
  });

  /** A Java value object `com.acme.Offer`, to hang private fields and getters on. */
  const offer = () =>
    artifact('shop').type('T:com.acme.Offer', {
      modifiers: ['final'],
      annotations: [javaAnnotation('ValueObject')],
    });
  const privateField: MemberOptions = {
    visibility: 'private',
    modifiers: ['readonly'],
  };
  const javaModel = (artifact: ArtifactBuilder) =>
    buildFrom([artifact], {}, JAVA_VOCABULARY).model;
  const propertiesOfOffer = (model: BuiltSystemModel['model']) =>
    stateTypesOf(model, 'building_block|com.acme.Offer');

  it("R5.8 takes a Java field behind Lombok's generated getter as state", () => {
    const model = javaModel(
      offer()
        .field('F:com.acme.Offer.products', named(JAVA.list, prim('long')), {
          ...privateField,
          languageSpecific: { 'java.processorModified': true },
        })
        .field('F:com.acme.Offer.total', prim('long'), {
          ...privateField,
          documentation: 'What is owed.',
        })
        .method('M:com.acme.Offer#getProducts()', {
          returns: named(JAVA.list, prim('long')),
          origin: 'generated',
          documentation: 'The products offered.',
          languageSpecific: { 'java.engine': 'bytecode' },
        })
        .method('M:com.acme.Offer#getTotal()', {
          returns: prim('long'),
          origin: 'generated',
          documentation: 'Ignored: the field has its own.',
        })
        .method('M:com.acme.Offer#hashCode()', {
          returns: prim('int'),
          origin: 'generated',
        }),
    );
    expect<unknown>(propertiesOfOffer(model)).toEqual([
      ['products', 'primitive|integer'],
      ['total', 'primitive|integer'],
    ]);
    expect<unknown>(model.behaviors).toEqual([]);
  });

  it('R5.8 takes a Java field behind a hand-written getter as a property, and the getter as no behavior', () => {
    const model = javaModel(
      offer()
        .field('F:com.acme.Offer.total', prim('long'), privateField)
        .method('M:com.acme.Offer#getTotal()', { returns: prim('long') })
        .method('M:com.acme.Offer#discount()', { returns: prim('long') }),
    );
    expect<unknown>(propertiesOfOffer(model)).toEqual([
      ['total', 'primitive|integer'],
    ]);
    expect<unknown>(model.behaviors.map((b) => b.name)).toEqual(['discount']);
  });

  it('R5.8 takes isX() as the getter of a boolean or Boolean field, and only of one', () => {
    const model = javaModel(
      offer()
        .field('F:com.acme.Offer.paid', prim('boolean'), privateField)
        .field('F:com.acme.Offer.signed', named(JAVA.boolean), privateField)
        .field('F:com.acme.Offer.count', prim('int'), privateField)
        .method('M:com.acme.Offer#isPaid()', { returns: prim('boolean') })
        .method('M:com.acme.Offer#isSigned()', {
          returns: named(JAVA.boolean),
        })
        .method('M:com.acme.Offer#isCount()', { returns: prim('int') }),
    );
    expect<unknown>(propertiesOfOffer(model)).toEqual([
      ['paid', 'primitive|boolean'],
      ['signed', 'primitive|boolean'],
    ]);
    expect<unknown>(model.behaviors.map((b) => b.name)).toEqual(['isCount']);
  });

  it("R5.8 takes Lombok's fluent accessor x() as the getter of x", () => {
    const model = javaModel(
      offer()
        .field('F:com.acme.Offer.total', prim('long'), privateField)
        .method('M:com.acme.Offer#total()', {
          returns: prim('long'),
          origin: 'generated',
        }),
    );
    expect<unknown>(propertiesOfOffer(model)).toEqual([
      ['total', 'primitive|integer'],
    ]);
  });

  it("R5.8 takes no getter whose return type is not the field's, nor one that is static, takes parameters or is not public", () => {
    const model = javaModel(
      offer()
        .field('F:com.acme.Offer.total', prim('long'), privateField)
        .field('F:com.acme.Offer.code', prim('int'), privateField)
        .field('F:com.acme.Offer.name', named(JAVA.string), privateField)
        .field('F:com.acme.Offer.note', named(JAVA.string), privateField)
        .method('M:com.acme.Offer#getTotal()', { returns: named(JAVA.string) })
        .method('M:com.acme.Offer#getCode()', {
          returns: prim('int'),
          modifiers: ['static'],
        })
        .method('M:com.acme.Offer#getName(int)', {
          returns: named(JAVA.string),
          parameters: [{ name: 'index', type: prim('int') }],
        })
        .method('M:com.acme.Offer#getNote()', {
          returns: named(JAVA.string),
          visibility: 'namespace',
        }),
    );
    expect<unknown>(propertiesOfOffer(model)).toEqual([]);
    expect<unknown>(model.behaviors.map((b) => b.name)).toEqual([
      'getCode',
      'getName',
      'getTotal',
    ]);
  });

  it('R5.8 takes no static field, constant or excluded field for a property, getter or not', () => {
    const model = javaModel(
      offer()
        .field('F:com.acme.Offer.instances', prim('long'), {
          visibility: 'private',
          modifiers: ['static'],
        })
        .field('F:com.acme.Offer.limit', prim('long'), {
          ...privateField,
          constantValue: '10',
        })
        .method('M:com.acme.Offer#getInstances()', { returns: prim('long') })
        .method('M:com.acme.Offer#getLimit()', { returns: prim('long') }),
    );
    expect<unknown>(propertiesOfOffer(model)).toEqual([]);
    expect<unknown>(model.behaviors.map((b) => b.name)).toEqual([
      'getInstances',
      'getLimit',
    ]);
  });

  it('R5.8 leaves C# alone: a private field behind a getter method is no property, the method a behavior', () => {
    const { model } = buildFrom([
      sales()
        .field('F:Sales.Orders.Order.total', prim('decimal'), {
          visibility: 'private',
        })
        .method('M:Sales.Orders.Order#getTotal()', { returns: prim('decimal') })
        .method('M:Sales.Orders.Order#total()', { returns: prim('decimal') }),
    ]);
    expect<unknown>(stateOf(model, ORDER)).toEqual([]);
    expect<unknown>(model.behaviors.map((b) => b.name)).toEqual([
      'getTotal',
      'total',
    ]);
  });

  it('R5.6 carries no description: what a slot means is the description of the block or primitive it points at', () => {
    const { model } = buildFrom([
      sales().property('P:Sales.Orders.Order.Total', prim('decimal'), {
        documentation: 'What is owed.',
      }),
    ]);
    expect<unknown>(Object.keys(model.relations.at(-1) ?? {})).toEqual([
      'kind',
      'from',
      'to',
      'name',
      'cardinality',
    ]);
  });

  it('R5.9 holds a member typed by a block that is no value of the domain as a collaborator, without a cardinality', () => {
    const { model } = buildFrom([
      sales()
        .type('T:Sales.Orders.IOrders', {
          kind: 'interface',
          annotations: [repository()],
        })
        .type('T:Sales.Orders.Pricing', { annotations: [domainService()] })
        .type('T:Sales.Orders.Line', { annotations: [valueObject()] })
        .property(
          'P:Sales.Orders.Order.Orders',
          named('T:Sales.Orders.IOrders'),
        )
        .property(
          'P:Sales.Orders.Order.Policies',
          named(SYS.list, named('T:Sales.Orders.Pricing')),
        )
        .property(
          'P:Sales.Orders.Order.Lines',
          named(SYS.list, named('T:Sales.Orders.Line')),
        ),
    ]);
    expect<unknown>(collaboratorsOf(model, ORDER)).toEqual([
      ['Orders', 'building_block|Sales.Orders.IOrders'],
      ['Policies', 'building_block|Sales.Orders.Pricing'],
    ]);
    expect<unknown>(stateOf(model, ORDER)).toEqual([
      ['Lines', 'building_block|Sales.Orders.Line', '0..*'],
    ]);
  });

  it("R5.9 takes a constructor's parameters of a collaborator kind as collaborators, each name once", () => {
    const { model, diagnostics } = buildFrom([
      sales()
        .type('T:Sales.Orders.IOrders', {
          kind: 'interface',
          annotations: [repository()],
        })
        .type('T:Sales.Orders.Pricing', { annotations: [domainService()] })
        .type('T:Sales.Orders.Line', { annotations: [valueObject()] })
        .property(
          'P:Sales.Orders.Order.Orders',
          named('T:Sales.Orders.IOrders'),
        )
        .method(
          'M:Sales.Orders.Order#.ctor(Sales.Orders.IOrders,Sales.Orders.Pricing,Sales.Orders.Line,System.Guid)',
          {
            methodKind: 'constructor',
            visibility: 'private',
            parameters: [
              { name: 'Orders', type: named('T:Sales.Orders.IOrders') },
              { name: 'pricing', type: named('T:Sales.Orders.Pricing') },
              { name: 'line', type: named('T:Sales.Orders.Line') },
              { name: 'id', type: named(SYS.guid) },
            ],
          },
        )
        .method('M:Sales.Orders.Order#.ctor(Sales.Orders.Pricing)', {
          methodKind: 'constructor',
          origin: 'generated',
          parameters: [
            { name: 'pricing', type: named('T:Sales.Orders.Pricing') },
          ],
        }),
    ]);
    expect<unknown>(collaboratorsOf(model, ORDER)).toEqual([
      ['Orders', 'building_block|Sales.Orders.IOrders'],
      ['pricing', 'building_block|Sales.Orders.Pricing'],
    ]);
    expect<unknown>(stateOf(model, ORDER)).toEqual([]);
    expect<unknown>(messages({ model, diagnostics })).toEqual([]);
  });
});

/* ========================================================== 6 modules */

describe('6. modules', () => {
  it('R6.1 maps a namespace through .noesis/settings.json: skipped parts wherever they occur', () => {
    const { model } = buildFrom(
      [
        artifact('Sales')
          .type('T:MyCompany.Sales.Orders.Order', {
            annotations: [aggregate()],
          })
          .type('T:Shared.MyCompany.Pricing.Quote', {
            annotations: [valueObject()],
          }),
      ],
      { namespacePartsToSkip: ['MyCompany'] },
    );
    expect<unknown>(ids(model.modules)).toEqual([
      'module|Sales',
      'module|Sales.Orders',
      'module|Shared',
      'module|Shared.Pricing',
    ]);
  });

  it('R6.1 drops a block whose namespace is skipped to nothing, with a diagnostic', () => {
    const built = buildFrom(
      [
        artifact('Sales').type('T:MyCompany.Order', {
          annotations: [aggregate()],
        }),
      ],
      { namespacePartsToSkip: ['MyCompany'] },
    );
    expect<unknown>(built.model.buildingBlocks).toEqual([]);
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining('maps to no module'),
      expect.stringContaining('declares no building block'),
    ]);
  });

  it("R6.2 makes a module per prefix of a block's module path and none for an empty namespace, each containing the next and its blocks", () => {
    const { model } = buildFrom([
      artifact('Sales')
        .namespace('Sales.Empty.Deep')
        .type('T:Sales.Orders.Order', { annotations: [aggregate()] })
        .type('T:Sales.Orders.Draft.Helper'),
    ]);
    expect<unknown>(ids(model.modules)).toEqual([
      'module|Sales',
      'module|Sales.Orders',
    ]);
    expect<unknown>(model.relations).toEqual([
      { kind: 'contains', from: 'library|Sales', to: ORDER },
      { kind: 'contains', from: 'module|Sales', to: 'module|Sales.Orders' },
      { kind: 'contains', from: 'module|Sales.Orders', to: ORDER },
    ]);
  });

  it('R6.3 names a module by the last segment of its path', () => {
    const { model } = buildFrom([
      artifact('Sales').type('T:Sales.Orders.Order', {
        annotations: [aggregate()],
      }),
    ]);
    expect<unknown>(model.modules.map((m) => m.name)).toEqual([
      'Sales',
      'Orders',
    ]);
  });

  it('R6.4 sources a module at the first namespace declaring it, in scan order, excluded artifacts aside; else at a directory above its descendant', () => {
    const technical = artifact('Technical', {
      annotations: [exclude()],
    }).namespace('Sales.Orders', 'Technical/T.cs');
    const sales = artifact('Sales', { dependsOn: ['A:Technical'] }).type(
      'T:MyCompany.Sales.Orders.Deep.Order',
      { annotations: [aggregate()], file: 'Sales/Orders/Deep/Order.cs' },
    );
    const { model } = buildFrom([technical, sales], {
      namespacePartsToSkip: ['MyCompany'],
    });
    expect<unknown>(model.modules.map((m) => [m.id, m.source])).toEqual([
      ['module|Sales', { path: 'Sales/Orders/Deep/Order.cs', line: 2 }],
      ['module|Sales.Orders', { path: 'Sales/Orders/Deep/Order.cs', line: 3 }],
      [
        'module|Sales.Orders.Deep',
        { path: 'Sales/Orders/Deep/Order.cs', line: 4 },
      ],
    ]);
    // A prefix only skipping creates: the directory above the descendant's file.
    const { model: skipped } = buildFrom(
      [
        artifact('Sales').type('T:Sales.Skip.Orders.Order', {
          annotations: [aggregate()],
          file: 'Sales/Orders/Order.cs',
        }),
      ],
      { namespacePartsToSkip: ['Sales.Skip'] },
    );
    expect<unknown>(skipped.modules.map((m) => [m.id, m.source])).toEqual([
      ['module|Orders', { path: 'Sales/Orders/Order.cs', line: 3 }],
    ]);
  });

  it('R6.5 gives a module no description', () => {
    const { model } = buildFrom([
      artifact('Sales').type('T:Sales.Order', { annotations: [aggregate()] }),
    ]);
    expect<unknown>(model.modules[0]).toMatchObject({ description: null });
  });
});

/* ================================================== 7 type resolution */

/** Resolves `type` as the type of one piece of state of the aggregate `Sales.Order`. */
function resolved(
  type: TypeRef,
  extend: (builder: ArtifactBuilder) => ArtifactBuilder = (b) => b,
): { type: unknown; cardinality: string } | undefined {
  const builder = extend(
    artifact('Sales').type('T:Sales.Order', { annotations: [aggregate()] }),
  ).property('P:Sales.Order.Probe', type);
  const { model } = buildFrom([builder]);
  const slot = stateOf(model, 'building_block|Sales.Order').find(
    (each) => (each as string[])[0] === 'Probe',
  ) as string[] | undefined;
  return slot === undefined
    ? undefined
    : { type: slot[1], cardinality: slot[2]! };
}

describe('7. resolving a type reference', () => {
  it('R7.1 looks through Task<T> and ValueTask<T>, makes Nullable<T> 0..1, and gives Task, void and dynamic nothing', () => {
    expect<unknown>(resolved(named(SYS.taskOf, prim('int')))).toEqual({
      type: 'primitive|integer',
      cardinality: '1',
    });
    expect<unknown>(
      resolved(named(SYS.valueTaskOf, named('T:Sales.Order'))),
    ).toEqual({
      type: 'building_block|Sales.Order',
      cardinality: '1',
    });
    expect<unknown>(resolved(named(SYS.nullableOf, named(SYS.guid)))).toEqual({
      type: 'primitive|uuid',
      cardinality: '0..1',
    });
    expect<unknown>(resolved(named(SYS.task))).toBeUndefined();
    expect<unknown>(resolved({ kind: 'dynamic' })).toBeUndefined();
  });

  it('R7.2 maps the primitives by keyword and by platform type id; object is nothing', () => {
    expect<unknown>(resolved(prim('bool'))?.type).toBe('primitive|boolean');
    expect<unknown>(resolved(prim('long'))?.type).toBe('primitive|integer');
    expect<unknown>(resolved(prim('double'))?.type).toBe('primitive|decimal');
    expect<unknown>(resolved(prim('char'))?.type).toBe('primitive|string');
    expect<unknown>(resolved(prim('object'))).toBeUndefined();
    expect<unknown>(resolved(named(SYS.guid))?.type).toBe('primitive|uuid');
    expect<unknown>(resolved(named(SYS.dateTime))?.type).toBe(
      'primitive|datetime',
    );
    expect<unknown>(resolved(named('T:System.DateOnly'))?.type).toBe(
      'primitive|date',
    );
    expect<unknown>(resolved(named('T:NodaTime.Period'))?.type).toBe(
      'primitive|duration',
    );
    expect<unknown>(resolved(nullable(prim('string')))).toEqual({
      type: 'primitive|string',
      cardinality: '0..1',
    });
  });

  it('R7.3 makes arrays and the collection types 0..* of their element; a collection of collections too, with a diagnostic; a dictionary is nothing, with a diagnostic', () => {
    expect<unknown>(resolved(arr(prim('int')))).toEqual({
      type: 'primitive|integer',
      cardinality: '0..*',
    });
    expect<unknown>(resolved(named(SYS.list, named('T:Sales.Order')))).toEqual({
      type: 'building_block|Sales.Order',
      cardinality: '0..*',
    });
    expect<unknown>(resolved(named(SYS.list, nullable(prim('int'))))).toEqual({
      type: 'primitive|integer',
      cardinality: '0..*',
    });
    const nested = buildFrom([
      artifact('Sales')
        .type('T:Sales.Order', { annotations: [aggregate()] })
        .property(
          'P:Sales.Order.Notes',
          named(SYS.enumerable, arr(prim('string'))),
        ),
    ]);
    expect<unknown>(
      stateOf(nested.model, 'building_block|Sales.Order'),
    ).toEqual([['Notes', 'primitive|string', '0..*']]);
    expect<unknown>(messages(nested, 'info')).toEqual([
      expect.stringContaining(
        'P:Sales.Order.Notes: a collection of collections is read as one collection of primitive|string',
      ),
    ]);
    expect<unknown>(
      resolved(named(SYS.list, named(SYS.cancellation))),
    ).toBeUndefined();
    const built = buildFrom([
      artifact('Sales')
        .type('T:Sales.Order', { annotations: [aggregate()] })
        .property(
          'P:Sales.Order.Tags',
          named(SYS.dictionary, prim('string'), prim('int')),
        ),
    ]);
    expect<unknown>(stateOf(built.model, 'building_block|Sales.Order')).toEqual(
      [],
    );
    expect<unknown>(messages(built, 'debug')).toEqual([
      expect.stringContaining('key-value pairs'),
      expect.stringContaining('P:Sales.Order.Tags'),
    ]);
  });

  it('R7.4 resolves a block by its type id, type arguments ignored, across artifacts', () => {
    const shared = artifact('Shared').type('T:Shared.IRepository`1', {
      kind: 'interface',
      annotations: [repository()],
    });
    const sales = artifact('Sales', { dependsOn: ['A:Shared'] })
      .type('T:Sales.Order', { annotations: [aggregate()] })
      .property(
        'P:Sales.Order.Repo',
        named('T:Shared.IRepository`1', named('T:Sales.Order')),
      );
    const { model } = buildFrom([shared, sales]);
    expect<unknown>(
      collaboratorsOf(model, 'building_block|Sales.Order'),
    ).toEqual([['Repo', 'building_block|Shared.IRepository']]);
  });

  it('R7.5 resolves a type parameter through its one resolving constraint; two, none or a cycle give nothing', () => {
    const constrained = (constraints: TypeRef[]) =>
      resolved(tparam('T:Sales.Order+Box`1'), (b) =>
        b.type('T:Sales.Order+Box`1', {
          typeParameters: [typeParameter('T', 0, constraints)],
        }),
      );
    expect<unknown>(constrained([named('T:Sales.Order')])?.type).toBe(
      'building_block|Sales.Order',
    );
    expect<unknown>(
      constrained([named('T:System.IDisposable'), named('T:Sales.Order')])
        ?.type,
    ).toBe('building_block|Sales.Order');
    expect<unknown>(
      constrained([named('T:Sales.Order'), named(SYS.guid)]),
    ).toBeUndefined();
    expect<unknown>(constrained([])).toBeUndefined();
    expect<unknown>(
      constrained([
        named('T:System.IComparable`1', tparam('T:Sales.Order+Box`1')),
      ]),
    ).toBeUndefined();
  });

  it('R7.6 looks through an unmapped generic with exactly one resolving argument', () => {
    expect<unknown>(
      resolved(named('T:Sales.Result`1', named('T:Sales.Order')))?.type,
    ).toBe('building_block|Sales.Order');
    expect<unknown>(
      resolved(named(SYS.func, prim('decimal'), prim('decimal'))),
    ).toBeUndefined();
    expect<unknown>(
      resolved(named('T:Sales.Pair`2', named(SYS.cancellation), prim('int')))
        ?.type,
    ).toBe('primitive|integer');
    expect<unknown>(
      resolved(named('T:Sales.Result`1', named(SYS.cancellation))),
    ).toBeUndefined();
  });

  it('R7.7 gives everything else nothing: tuples, functions, unresolved names, an unannotated type', () => {
    expect<unknown>(
      resolved({
        kind: 'tuple',
        elements: [{ name: null, type: prim('int') }],
      }),
    ).toBeUndefined();
    expect<unknown>(
      resolved({ kind: 'unresolved', text: 'Missing' }),
    ).toBeUndefined();
    expect<unknown>(
      resolved(named('T:Sales.Plain'), (b) => b.type('T:Sales.Plain')),
    ).toBeUndefined();
    expect<unknown>(resolved(named(SYS.object))).toBeUndefined();
  });
});

/* ======================================== 8 resolving across artifacts */

describe('8. resolving ids across artifacts', () => {
  it('looks an id up in the referencing artifact, then its source dependencies in order, never the other way', () => {
    const shared = artifact('Shared').type('T:Common.Money', {
      annotations: [valueObject('Shared money')],
    });
    const sales = artifact('Sales', { dependsOn: ['A:Shared'] })
      .type('T:Common.Money', { annotations: [valueObject('Sales money')] })
      .type('T:Sales.Order', { annotations: [aggregate()] })
      .property('P:Sales.Order.Total', named('T:Common.Money'));
    const billing = artifact('Billing', { dependsOn: ['A:Shared'] })
      .type('T:Billing.Invoice', { annotations: [aggregate()] })
      .property('P:Billing.Invoice.Total', named('T:Common.Money'));
    const { model } = buildFrom([shared, sales, billing]);
    expect<unknown>(stateTypesOf(model, 'building_block|Sales.Order')).toEqual([
      ['Total', 'building_block|Common.Sales money'],
    ]);
    expect<unknown>(
      stateTypesOf(model, 'building_block|Billing.Invoice'),
    ).toEqual([['Total', 'building_block|Common.Shared money']]);
  });

  it('merges namespaces across artifacts into one module', () => {
    const a = artifact('A').type('T:Sales.Orders.Order', {
      annotations: [aggregate()],
    });
    const b = artifact('B').type('T:Sales.Orders.Line', {
      annotations: [entity()],
    });
    const { model } = buildFrom([a, b]);
    expect<unknown>(ids(model.modules)).toEqual([
      'module|Sales',
      'module|Sales.Orders',
    ]);
    expect<unknown>(model.modules[1]?.source.path).toBe('A/A.cs');
  });
});

/* ======================================================= 9 behaviors */

describe('9. behaviors', () => {
  it('R9.1 takes the public methods of a block, static ones too; not constructors, operators, technical or non-public ones', () => {
    const { model } = buildFrom([
      sales()
        .method('M:Sales.Orders.Order#.ctor()', { methodKind: 'constructor' })
        .method(
          'M:Sales.Orders.Order#op_Addition(Sales.Orders.Order,Sales.Orders.Order)',
          {
            methodKind: 'operator',
            modifiers: ['static'],
          },
        )
        .method('M:Sales.Orders.Order#Place()')
        .method('M:Sales.Orders.Order#Create()', { modifiers: ['static'] })
        .method('M:Sales.Orders.Order#ToString()')
        .method('M:Sales.Orders.Order#Equals(object)')
        .method('M:Sales.Orders.Order#Recalculate()', {
          visibility: 'artifact',
        })
        .method('M:Sales.Orders.Order#Audit()', { visibility: 'private' })
        .method('M:Sales.Orders.Order#Guarded()', { visibility: 'protected' }),
    ]);
    expect<unknown>(ids(model.behaviors)).toEqual([
      'behavior|Sales.Orders.Order.Create',
      'behavior|Sales.Orders.Order.Place',
    ]);
  });

  it('R9.1 takes a method with a behavior annotation whatever its visibility or name', () => {
    const { model } = buildFrom([
      sales()
        .method('M:Sales.Orders.Order#Audit()', {
          visibility: 'private',
          annotations: [behavior()],
        })
        .method('M:Sales.Orders.Order#ToString()', {
          annotations: [behavior('Describe')],
        }),
    ]);
    expect<unknown>(model.behaviors.map((b) => b.name)).toEqual([
      'Audit',
      'Describe',
    ]);
  });

  it('R9.2 names a behavior by the annotation on the method, else on the member it implements or overrides, else the code', () => {
    const built = buildFrom([
      sales()
        .type('T:Sales.Orders.IOrder', {
          kind: 'interface',
          annotations: [repository()],
        })
        .method('M:Sales.Orders.IOrder#Place()', {
          annotations: [behavior('Place order')],
        })
        .method('M:Sales.Orders.IOrder#Cancel()', {
          annotations: [behavior('Sales.Cancel')],
        })
        .method('M:Sales.Orders.Order#Place()', {
          implementsMember: ['M:Sales.Orders.IOrder#Place()'],
        })
        .method('M:Sales.Orders.Order#Cancel()', {
          implementsMember: ['M:Sales.Orders.IOrder#Cancel()'],
        })
        .method('M:Sales.Orders.Order#Ship()', {
          annotations: [behavior('Ship it')],
        }),
    ]);
    expect<unknown>(ids(built.model.behaviors)).toEqual([
      'behavior|Sales.Orders.IOrder.Cancel',
      'behavior|Sales.Orders.IOrder.Place order',
      'behavior|Sales.Orders.Order.Cancel',
      'behavior|Sales.Orders.Order.Place order',
      'behavior|Sales.Orders.Order.Ship it',
    ]);
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining('"Sales.Cancel" is no element name'),
      expect.stringContaining('"Sales.Cancel" is no element name'),
    ]);
  });

  it('R9.3 collapses overloads into one behavior that the overload with the most parameters stands for, the first declared of those', () => {
    const { model } = buildFrom([
      sales()
        .method('M:Sales.Orders.Order#Add(int)', {
          parameters: [{ name: 'quantity', type: prim('int') }],
        })
        .method('M:Sales.Orders.Order#Add(int,string)', {
          parameters: [
            { name: 'quantity', type: prim('int') },
            { name: 'note', type: prim('string') },
          ],
        })
        .method('M:Sales.Orders.Order#Add(string,int)', {
          parameters: [
            { name: 'note', type: prim('string') },
            { name: 'quantity', type: prim('int') },
          ],
        }),
    ]);
    expect<unknown>(model.behaviors).toHaveLength(1);
    expect<unknown>(
      inputOf(model, 'behavior|Sales.Orders.Order.Add').map(
        (slot) => (slot as string[])[0],
      ),
    ).toEqual(['quantity', 'note']);
    expect<unknown>(model.behaviors[0]?.source.line).toBe(5);
  });

  it('R9.4 gives a behavior no type: a handler annotation only marks it', () => {
    const { model } = buildFrom(
      [
        artifact('shop')
          .type('T:com.acme.Orders', {
            annotations: [javaAnnotation('ApplicationService')],
          })
          .method('M:com.acme.Orders#place()', {
            annotations: [javaAnnotation('CommandHandler')],
          })
          .method('M:com.acme.Orders#total()', {
            returns: prim('long'),
            annotations: [javaAnnotation('QueryHandler')],
          })
          .method('M:com.acme.Orders#onPlaced()', {
            annotations: [javaAnnotation('EventHandler')],
            visibility: 'namespace',
          }),
      ],
      {},
      JAVA_VOCABULARY,
    );
    expect<unknown>(model.behaviors.map((b) => [b.name, 'type' in b])).toEqual([
      ['onPlaced', false],
      ['place', false],
      ['total', false],
    ]);
  });

  it('R9.5 makes an actor of each name on the method, the members it implements and its type, once, and nothing on the behavior', () => {
    const { model } = buildFrom([
      artifact('Sales')
        .type('T:Sales.IOrder', {
          kind: 'interface',
          annotations: [repository()],
        })
        .method('M:Sales.IOrder#Place()', { annotations: [actor('Sales rep')] })
        .type('T:Sales.Order', {
          annotations: [aggregate(), actor('Customer')],
        })
        .method('M:Sales.Order#Place()', {
          annotations: [actor('Customer'), actor('Admin')],
          implementsMember: ['M:Sales.IOrder#Place()'],
        })
        .method('M:Sales.Order#Cancel()'),
    ]);
    expect<unknown>(model.actors.map((a) => [a.id, a.name])).toEqual([
      ['actor|Admin', 'Admin'],
      ['actor|Customer', 'Customer'],
      ['actor|Sales rep', 'Sales rep'],
    ]);
    expect<unknown>(model.behaviors.every((b) => !('visibility' in b))).toBe(
      true,
    );
    expect<unknown>(model.relations.map((r) => r.kind)).not.toContain(
      'performs',
    );
    expect<unknown>(model.manualProcesses).toEqual([]);
  });

  it('R9.5 drops an actor whose name is no element name, with a diagnostic', () => {
    const { model, diagnostics } = buildFrom([
      artifact('Sales')
        .type('T:Sales.Order', { annotations: [aggregate()] })
        .method('M:Sales.Order#Place()', {
          annotations: [actor('Sales.rep'), actor('Customer')],
        }),
    ]);
    expect<unknown>(model.actors.map((a) => a.name)).toEqual(['Customer']);
    expect<unknown>(diagnostics.map((d) => d.message)).toContainEqual(
      expect.stringContaining('the actor name "Sales.rep" is no element name'),
    );
  });

  it("R9.5 reads Java's @Actor by its value, repeated ones through their Actor.Actors container", () => {
    const { model } = buildFrom(
      [
        artifact('shop')
          .type('T:shop.Order', {
            annotations: [javaAnnotation('AggregateRoot'), javaActor('Clerk')],
          })
          .method('M:shop.Order#place()', {
            annotations: [
              {
                type: named('T:vision.noesis.annotations.Actor+Actors'),
                arguments: [
                  {
                    name: 'value',
                    positional: true,
                    value: {
                      kind: 'array',
                      items: [
                        {
                          kind: 'annotation',
                          annotation: javaActor('Customer'),
                        },
                        {
                          kind: 'annotation',
                          annotation: javaActor('Sales rep'),
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          }),
      ],
      {},
      JAVA_VOCABULARY,
    );
    expect<unknown>(model.actors.map((a) => a.id)).toEqual([
      'actor|Clerk',
      'actor|Customer',
      'actor|Sales rep',
    ]);
  });

  it('R9.6 takes one has_input per parameter, 0..1 for a default or a nullable type, leaving out what has no word', () => {
    const built = buildFrom([
      sales()
        .stub(SYS.cancellation)
        .method(
          'M:Sales.Orders.Order#Place(Sales.Orders.Order,string,int,System.Threading.CancellationToken)',
          {
            parameters: [
              { name: 'other', type: named('T:Sales.Orders.Order') },
              { name: 'note', type: nullable(prim('string')) },
              { name: 'count', type: prim('int'), optional: true },
              { name: 'token', type: named(SYS.cancellation) },
            ],
          },
        ),
    ]);
    expect<unknown>(
      inputOf(built.model, 'behavior|Sales.Orders.Order.Place'),
    ).toEqual([
      ['other', ORDER, '1'],
      ['note', 'primitive|string', '0..1'],
      ['count', 'primitive|integer', '0..1'],
    ]);
    expect<unknown>(messages(built, 'debug')).toEqual([
      expect.stringContaining('parameter token'),
    ]);
  });

  it('R9.7 gives no has_output for void, Task and ValueTask, and one otherwise, 0..1 when nullable', () => {
    const { model } = buildFrom([
      sales()
        .method('M:Sales.Orders.Order#A()')
        .method('M:Sales.Orders.Order#B()', { returns: named(SYS.task) })
        .method('M:Sales.Orders.Order#C()', {
          returns: named(SYS.taskOf, named('T:Sales.Orders.Order')),
        })
        .method('M:Sales.Orders.Order#D()', {
          returns: nullable(prim('string')),
        })
        .method('M:Sales.Orders.Order#E()', {
          returns: named(SYS.func, prim('int'), prim('int')),
        }),
    ]);
    expect<unknown>(
      model.behaviors.map((b) => [b.name, outputOf(model, b.id)]),
    ).toEqual([
      ['A', []],
      ['B', []],
      ['C', [[ORDER, '1']]],
      ['D', [['primitive|string', '0..1']]],
      ['E', []],
    ]);
  });

  it("R9.8 describes a behavior by its ShortDescription, its doc comment, or an overload's", () => {
    const { model } = buildFrom([
      sales()
        .method('M:Sales.Orders.Order#A()', {
          annotations: [description('Short')],
          documentation: 'Doc',
        })
        .method('M:Sales.Orders.Order#B()', { documentation: 'Doc' })
        .method('M:Sales.Orders.Order#C(int)', {
          parameters: [{ name: 'n', type: prim('int') }],
        })
        .method('M:Sales.Orders.Order#C()', {
          documentation: 'From the shorter overload',
        })
        .method('M:Sales.Orders.Order#D()'),
    ]);
    expect<unknown>(model.behaviors.map((b) => b.description)).toEqual([
      'Short',
      'Doc',
      'From the shorter overload',
      null,
    ]);
  });

  it('R9.10 points a behavior at the chosen overload', () => {
    const { model } = buildFrom([
      sales()
        .method('M:Sales.Orders.Order#Place()', { file: 'a.cs' })
        .method('M:Sales.Orders.Order#Place(int)', {
          parameters: [{ name: 'n', type: prim('int') }],
          file: 'b.cs',
        }),
    ]);
    expect<unknown>(model.behaviors[0]?.source).toEqual({
      path: 'b.cs',
      line: 5,
    });
  });

  it('R9.11 drops a behavior annotation on a method of a type that is no block, with a diagnostic', () => {
    const built = buildFrom([
      artifact('Sales')
        .type('T:Sales.Helpers', { modifiers: ['static'] })
        .method('M:Sales.Helpers#Count()', {
          annotations: [behavior('Count things')],
        }),
    ]);
    expect<unknown>(built.model.behaviors).toEqual([]);
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining(
        'M:Sales.Helpers#Count() is marked a behavior but its type is no building block',
      ),
      expect.stringContaining('declares no building block'),
    ]);
  });
});

/* ====================================================== 10 determinism */

describe('10. order and determinism', () => {
  it('R10.1 sorts modules, blocks, behaviors and actors by id, relations by kind, from, to, then name or order, and gives one output for one input', () => {
    const build = () => [
      artifact('Sales')
        .type('T:Sales.Zed', { annotations: [valueObject()] })
        .type('T:Sales.Alpha', {
          annotations: [aggregate(), actor('Zoe'), actor('Adam')],
        })
        .method('M:Sales.Alpha#Zip()', {
          invokes: ['M:Sales.Alpha#Act()', 'M:Sales.Zed#Make()'],
        })
        .method('M:Sales.Alpha#Act()')
        .method('M:Sales.Zed#Make()'),
    ];
    const first = buildFrom(build());
    const second = buildFrom(build());
    expect<unknown>(first).toEqual(second);
    expect<unknown>(ids(first.model.buildingBlocks)).toEqual([
      'building_block|Sales.Alpha',
      'building_block|Sales.Zed',
    ]);
    expect<unknown>(ids(first.model.behaviors)).toEqual([
      'behavior|Sales.Alpha.Act',
      'behavior|Sales.Alpha.Zip',
      'behavior|Sales.Zed.Make',
    ]);
    expect<unknown>(ids(first.model.actors)).toEqual([
      'actor|Adam',
      'actor|Zoe',
    ]);
    expect<unknown>(first.model.relations).toEqual([
      {
        kind: 'contains',
        from: 'library|Sales',
        to: 'building_block|Sales.Alpha',
      },
      {
        kind: 'contains',
        from: 'library|Sales',
        to: 'building_block|Sales.Zed',
      },
      {
        kind: 'contains',
        from: 'module|Sales',
        to: 'building_block|Sales.Alpha',
      },
      {
        kind: 'contains',
        from: 'module|Sales',
        to: 'building_block|Sales.Zed',
      },
      {
        kind: 'exposes',
        from: 'building_block|Sales.Alpha',
        to: 'behavior|Sales.Alpha.Act',
      },
      {
        kind: 'exposes',
        from: 'building_block|Sales.Alpha',
        to: 'behavior|Sales.Alpha.Zip',
      },
      {
        kind: 'exposes',
        from: 'building_block|Sales.Zed',
        to: 'behavior|Sales.Zed.Make',
      },
      {
        kind: 'invokes',
        from: 'behavior|Sales.Alpha.Zip',
        to: 'behavior|Sales.Alpha.Act',
        order: 1,
      },
      {
        kind: 'invokes',
        from: 'behavior|Sales.Alpha.Zip',
        to: 'behavior|Sales.Zed.Make',
        order: 2,
      },
    ]);
  });
});

/* ===================================================== 11 invocations */

describe('11. relations derived from invocations', () => {
  it("R11.1 attributes a call to the behaviors of the calling method and of the members it implements or overrides; an initialiser's call to nothing", () => {
    const { model } = buildFrom([
      artifact('Sales')
        .type('T:Sales.IOrderRepository', {
          kind: 'interface',
          annotations: [repository()],
        })
        .method('M:Sales.IOrderRepository#Save(Sales.Order)', {
          parameters: [{ name: 'order', type: named('T:Sales.Order') }],
        })
        .type('T:Sales.Order', { annotations: [aggregate()] })
        .method('M:Sales.Order#Total()', { returns: prim('decimal') })
        .method('M:Sales.Order#Place()', { invokes: ['M:Sales.Order#Total()'] })
        .method('M:Sales.Order#Place(int)', {
          parameters: [{ name: 'n', type: prim('int') }],
          invokes: ['M:Sales.IOrderRepository#Save(Sales.Order)'],
        })
        .property('P:Sales.Order.Cached', prim('decimal'))
        .invokes('P:Sales.Order.Cached', 'M:Sales.Order#Total()')
        .type('T:Sales.SqlOrderRepository', {
          implements: [named('T:Sales.IOrderRepository')],
        })
        .method('M:Sales.SqlOrderRepository#Save(Sales.Order)', {
          parameters: [{ name: 'order', type: named('T:Sales.Order') }],
          implementsMember: ['M:Sales.IOrderRepository#Save(Sales.Order)'],
          invokes: ['M:Sales.Order#Total()'],
        }),
    ]);
    expect<unknown>(
      model.behaviors.map((b) => [b.id, invokesOf(model, b.id)]),
    ).toEqual([
      ['behavior|Sales.IOrderRepository.Save', ['behavior|Sales.Order.Total']],
      [
        'behavior|Sales.Order.Place',
        ['behavior|Sales.Order.Total', 'behavior|Sales.IOrderRepository.Save'],
      ],
      ['behavior|Sales.Order.Total', []],
    ]);
  });

  it('R11.2 walks through methods that are no behavior, across artifacts and excluded types, to the behaviors they reach, and stops at stubs, constructors and cycles', () => {
    const technical = artifact('Technical', { annotations: [exclude()] })
      .type('T:Technical.Guard', { modifiers: ['static'] })
      .method('M:Technical.Guard#NotNull(object)', { modifiers: ['static'] });
    const sales = artifact('Sales', { dependsOn: ['A:Technical'] })
      .stub('M:System.Console#WriteLine(string)', 'method')
      .type('T:Sales.Order', { annotations: [aggregate()] })
      .method('M:Sales.Order#.ctor()', {
        methodKind: 'constructor',
        invokes: ['M:Sales.Order#Total()'],
      })
      .method('M:Sales.Order#Total()', { returns: prim('decimal') })
      .method('M:Sales.Order#Place()', {
        invokes: [
          'M:Sales.Order#Audit()',
          'M:Technical.Guard#NotNull(object)',
          'M:System.Console#WriteLine(string)',
          'M:Sales.Order#.ctor()',
          'M:Sales.Order#Loop()',
        ],
      })
      .method('M:Sales.Order#Audit()', {
        visibility: 'private',
        invokes: ['M:Sales.Order#Recalculate()'],
      })
      .method('M:Sales.Order#Recalculate()', {
        visibility: 'artifact',
        invokes: ['M:Sales.Order#Total()', 'M:Sales.Order#Audit()'],
      })
      .method('M:Sales.Order#Loop()', {
        visibility: 'private',
        invokes: ['M:Sales.Order#Loop()'],
      });
    const { model } = buildFrom([technical, sales]);
    expect<unknown>(invokesOf(model, 'behavior|Sales.Order.Place')).toEqual([
      'behavior|Sales.Order.Total',
    ]);
  });

  it('R11.2 resolves the target through the members it implements: a call to the implementation reaches the interface behavior', () => {
    const { model } = buildFrom([
      artifact('Sales')
        .type('T:Sales.IOrderRepository', {
          kind: 'interface',
          annotations: [repository()],
        })
        .method('M:Sales.IOrderRepository#Save()')
        .type('T:Sales.SqlOrderRepository', {
          implements: [named('T:Sales.IOrderRepository')],
        })
        .method('M:Sales.SqlOrderRepository#Save()', {
          implementsMember: ['M:Sales.IOrderRepository#Save()'],
        })
        .type('T:Sales.Order', { annotations: [aggregate()] })
        .method('M:Sales.Order#Persist()', {
          invokes: ['M:Sales.SqlOrderRepository#Save()'],
        }),
    ]);
    expect<unknown>(invokesOf(model, 'behavior|Sales.Order.Persist')).toEqual([
      'behavior|Sales.IOrderRepository.Save',
    ]);
  });

  it('R11.3 orders the invoked behaviors by their call sites, counting from 1, a second call of one behavior keeping its first, and never the behavior itself', () => {
    const { model } = buildFrom([
      artifact('Sales')
        .type('T:Sales.Order', { annotations: [aggregate()] })
        .method('M:Sales.Order#Place()', {
          invokes: [
            'M:Sales.Order#Place()',
            'M:Sales.Order#Total()',
            'M:Sales.Order#Audit()',
            'M:Sales.Order#Total()',
            'M:Sales.Order#Ship()',
          ],
        })
        .method('M:Sales.Order#Total()', { returns: prim('decimal') })
        .method('M:Sales.Order#Audit()')
        .method('M:Sales.Order#Ship()'),
    ]);
    expect<unknown>(
      model.relations.filter((r) => r.kind === 'invokes'),
    ).toEqual([
      {
        kind: 'invokes',
        from: 'behavior|Sales.Order.Place',
        to: 'behavior|Sales.Order.Audit',
        order: 2,
      },
      {
        kind: 'invokes',
        from: 'behavior|Sales.Order.Place',
        to: 'behavior|Sales.Order.Ship',
        order: 3,
      },
      {
        kind: 'invokes',
        from: 'behavior|Sales.Order.Place',
        to: 'behavior|Sales.Order.Total',
        order: 1,
      },
    ]);
  });

  it('R11.3 places a behavior reached through a method that is no behavior at the position of the call to that method', () => {
    const { model } = buildFrom([
      artifact('Sales')
        .type('T:Sales.Order', { annotations: [aggregate()] })
        .method('M:Sales.Order#Place()', {
          invokes: [
            'M:Sales.Order#Log()',
            'M:Sales.Order#Total()',
            'M:Sales.Order#Audit()',
          ],
        })
        .method('M:Sales.Order#Log()', {
          visibility: 'private',
          invokes: ['M:Sales.Order#Audit()', 'M:Sales.Order#Ship()'],
        })
        .method('M:Sales.Order#Total()', { returns: prim('decimal') })
        .method('M:Sales.Order#Audit()')
        .method('M:Sales.Order#Ship()'),
    ]);
    expect<unknown>(invokesOf(model, 'behavior|Sales.Order.Place')).toEqual([
      'behavior|Sales.Order.Audit',
      'behavior|Sales.Order.Ship',
      'behavior|Sales.Order.Total',
    ]);
  });
});

/* ======================================================== 12 relations */

describe('12. relations', () => {
  it('writes containment as a relation beside the id: a module contains its modules and blocks, a block exposes its behaviors', () => {
    const { model } = buildFrom([
      sales()
        .type('T:Sales.Orders.Line', { annotations: [entity()] })
        .method('M:Sales.Orders.Order#Place()')
        .type('T:Sales.Pricing.Quote', { annotations: [valueObject()] }),
    ]);
    expect<unknown>(
      model.relations.filter((r) => r.kind !== 'has_state'),
    ).toEqual([
      {
        kind: 'contains',
        from: 'library|Sales',
        to: 'building_block|Sales.Orders.Line',
      },
      { kind: 'contains', from: 'library|Sales', to: ORDER },
      {
        kind: 'contains',
        from: 'library|Sales',
        to: 'building_block|Sales.Pricing.Quote',
      },
      { kind: 'contains', from: 'module|Sales', to: 'module|Sales.Orders' },
      { kind: 'contains', from: 'module|Sales', to: 'module|Sales.Pricing' },
      {
        kind: 'contains',
        from: 'module|Sales.Orders',
        to: 'building_block|Sales.Orders.Line',
      },
      { kind: 'contains', from: 'module|Sales.Orders', to: ORDER },
      {
        kind: 'contains',
        from: 'module|Sales.Pricing',
        to: 'building_block|Sales.Pricing.Quote',
      },
      { kind: 'exposes', from: ORDER, to: 'behavior|Sales.Orders.Order.Place' },
    ]);
  });

  it('keeps every relation unique by its key: two slots of one type are two relations, one type extended twice is one', () => {
    const { model } = buildFrom([
      sales()
        .type('T:Sales.Orders.IAudited', {
          kind: 'interface',
          annotations: [repository()],
        })
        .type('T:Sales.Orders.Audited', {
          annotations: [aggregate()],
          implements: [
            named('T:Sales.Orders.IAudited', prim('int')),
            named('T:Sales.Orders.IAudited', prim('string')),
          ],
        })
        .property('P:Sales.Orders.Order.Net', prim('decimal'))
        .property('P:Sales.Orders.Order.Gross', prim('decimal')),
    ]);
    expect<unknown>(
      extendsOf(model, 'building_block|Sales.Orders.Audited'),
    ).toEqual(['building_block|Sales.Orders.IAudited']);
    expect<unknown>(stateOf(model, ORDER)).toEqual([
      ['Gross', 'primitive|decimal', '1'],
      ['Net', 'primitive|decimal', '1'],
    ]);
  });
});

/* ========================================== 12 rules from feature files */

const STEPS = 'T:Sales.Specs.OrderSteps';
const PLACE = 'behavior|Sales.Orders.Order.Place';
const CANCEL = 'behavior|Sales.Orders.Order.Cancel';
const FEATURE = 'features/orders.feature';

/** The `Sales` artifact with `Order.Place()` and `Order.Cancel()`, and the unannotated step definitions class. */
function withSteps(): ArtifactBuilder {
  return sales()
    .method('M:Sales.Orders.Order#Place()')
    .method('M:Sales.Orders.Order#Cancel()')
    .type(STEPS);
}

const feature = (text: string, path = FEATURE): FeatureFileSource => ({
  path,
  text,
});

const ORDERS_FEATURE = `Feature: Orders

  Background:
    Given an order with one line

  @validation
  Rule: Non-empty order
    An order must have at least one line.

    Scenario: Placed
      When the customer places the order
      Then the order is placed

    Scenario: Cancelled before placing
      When the customer cancels the order
      Then the order is gone
`;

const rulesFrom = (
  steps: ArtifactBuilder,
  ...features: FeatureFileSource[]
): BuiltSystemModel => buildFrom([steps], {}, CSHARP_VOCABULARY, features);

const rulesRelationsOf = (model: BuiltSystemModel['model']) =>
  model.relations.filter(
    (r) => r.kind === 'governs' || r.kind === 'illustrates',
  );

describe('12. rules and scenarios from feature files (R12)', () => {
  it("makes a rule of a Rule:, governed by the behavior its scenarios' When steps invoke, in that behavior's module", () => {
    const built = rulesFrom(
      withSteps()
        .method(`M:${STEPS.slice(2)}#WhenPlaced()`, {
          annotations: [when('the customer places the order')],
          invokes: ['M:Sales.Orders.Order#Place()'],
        })
        .method(`M:${STEPS.slice(2)}#WhenCancelled()`, {
          annotations: [when('the customer cancels the order')],
          invokes: ['M:Sales.Orders.Order#Cancel()'],
        }),
      feature(ORDERS_FEATURE),
    );
    const RULE = 'rule|Sales.Orders.Non-empty order';

    expect<unknown>(built.model.rules).toEqual([
      {
        id: RULE,
        name: 'Non-empty order',
        kind: 'validation',
        description: 'An order must have at least one line.',
        source: { path: FEATURE, line: 7 },
      },
    ]);
    expect<unknown>(built.model.scenarios).toEqual([
      {
        id: `scenario|Sales.Orders.Non-empty order.Cancelled before placing`,
        name: 'Cancelled before placing',
        description: null,
        steps: [
          { kind: 'given', text: 'an order with one line' },
          { kind: 'when', text: 'the customer cancels the order' },
          { kind: 'then', text: 'the order is gone' },
        ],
        source: { path: FEATURE, line: 14 },
      },
      {
        id: `scenario|Sales.Orders.Non-empty order.Placed`,
        name: 'Placed',
        description: null,
        steps: [
          { kind: 'given', text: 'an order with one line' },
          { kind: 'when', text: 'the customer places the order' },
          { kind: 'then', text: 'the order is placed' },
        ],
        source: { path: FEATURE, line: 10 },
      },
    ]);
    expect<unknown>(rulesRelationsOf(built.model)).toEqual([
      { kind: 'governs', from: CANCEL, to: RULE },
      { kind: 'governs', from: PLACE, to: RULE },
      {
        kind: 'illustrates',
        from: `scenario|Sales.Orders.Non-empty order.Cancelled before placing`,
        to: RULE,
      },
      {
        kind: 'illustrates',
        from: `scenario|Sales.Orders.Non-empty order.Placed`,
        to: RULE,
      },
    ]);
    expect<unknown>(messages(built)).toEqual([]);
  });

  it('follows a step definition through methods that are no behavior, and stops at the first behavior it reaches', () => {
    const built = rulesFrom(
      sales()
        .method('M:Sales.Orders.Order#Place()', {
          invokes: ['M:Sales.Orders.Order#Cancel()'],
        })
        .method('M:Sales.Orders.Order#Cancel()')
        .type(STEPS)
        .method(`M:${STEPS.slice(2)}#WhenPlaced()`, {
          annotations: [when('the customer places the order')],
          invokes: [`M:${STEPS.slice(2)}#Helper()`],
        })
        .method(`M:${STEPS.slice(2)}#Helper()`, {
          visibility: 'private',
          invokes: ['M:Sales.Orders.Order#Place()'],
        }),
      feature(`Feature: F
  @post
  Rule: Placed orders stay
    Scenario: Placed
      When the customer places the order
`),
    );

    expect<unknown>(rulesRelationsOf(built.model)).toContainEqual({
      kind: 'governs',
      from: PLACE,
      to: 'rule|Sales.Orders.Placed orders stay',
    });
  });

  it('binds a step by a Cucumber expression or a regular expression, an outline by its first example', () => {
    const built = rulesFrom(
      withSteps()
        .method(`M:${STEPS.slice(2)}#WhenAdded(int)`, {
          annotations: [when('the customer adds {int} lines')],
          parameters: [{ name: 'count', type: prim('int') }],
          invokes: ['M:Sales.Orders.Order#Place()'],
        })
        .method(`M:${STEPS.slice(2)}#WhenCancelled()`, {
          annotations: [when('^the order is (?:cancelled|dropped)$')],
          invokes: ['M:Sales.Orders.Order#Cancel()'],
        }),
      feature(`Feature: F
  @computation
  Rule: Lines count
    Scenario Outline: Adding
      When the customer adds <count> lines
      Examples:
        | count |
        | 2     |

  @state_change
  Rule: Cancelling
    Scenario: Dropped
      When the order is dropped
`),
    );

    expect<unknown>(ids(built.model.rules)).toEqual([
      'rule|Sales.Orders.Cancelling',
      'rule|Sales.Orders.Lines count',
    ]);
    expect<unknown>(
      built.model.scenarios.find(({ name }) => name === 'Adding')?.steps,
    ).toEqual([{ kind: 'when', text: 'the customer adds <count> lines' }]);
  });

  it("names a rule in the module of its first scenario's behavior when its scenarios bind to several", () => {
    const built = rulesFrom(
      withSteps()
        .type('T:Sales.Billing.Invoice', { annotations: [aggregate()] })
        .method('M:Sales.Billing.Invoice#Issue()')
        .method(`M:${STEPS.slice(2)}#WhenIssued()`, {
          annotations: [when('the invoice is issued')],
          invokes: ['M:Sales.Billing.Invoice#Issue()'],
        })
        .method(`M:${STEPS.slice(2)}#WhenPlaced()`, {
          annotations: [when('the customer places the order')],
          invokes: ['M:Sales.Orders.Order#Place()'],
        }),
      feature(`Feature: F
  @coordination
  Rule: Billed when placed
    Scenario: Issued
      When the invoice is issued
    Scenario: Placed
      When the customer places the order
`),
    );

    expect<unknown>(ids(built.model.rules)).toEqual([
      'rule|Sales.Billing.Billed when placed',
    ]);
    expect<unknown>(
      rulesRelationsOf(built.model)
        .filter(({ kind }) => kind === 'governs')
        .map(({ from }) => from),
    ).toEqual(['behavior|Sales.Billing.Invoice.Issue', PLACE]);
  });

  it('drops a scenario whose When step binds to no step definition, or to several', () => {
    const built = rulesFrom(
      withSteps()
        .method(`M:${STEPS.slice(2)}#WhenPlaced()`, {
          annotations: [when('the customer places the order')],
          invokes: ['M:Sales.Orders.Order#Place()'],
        })
        .method(`M:${STEPS.slice(2)}#WhenPlacedAgain()`, {
          annotations: [when('the customer places the {word}')],
          invokes: ['M:Sales.Orders.Order#Place()'],
        }),
      feature(ORDERS_FEATURE),
    );

    expect<unknown>(built.model.rules).toEqual([]);
    expect<unknown>(built.model.scenarios).toEqual([]);
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining(
        'scenario "Placed": the When step "the customer places the order" matches 2 step definitions',
      ),
      expect.stringContaining(
        'scenario "Cancelled before placing": the When step "the customer cancels the order" matches no step definition',
      ),
      expect.stringContaining(
        'rule "Non-empty order": none of its scenarios binds to a behavior; dropped',
      ),
    ]);
  });

  it('drops a scenario whose When steps invoke no behavior, or more than one', () => {
    const built = rulesFrom(
      withSteps()
        .method(`M:${STEPS.slice(2)}#WhenPlaced()`, {
          annotations: [when('the customer places the order')],
          invokes: [
            'M:Sales.Orders.Order#Place()',
            'M:Sales.Orders.Order#Cancel()',
          ],
        })
        .method(`M:${STEPS.slice(2)}#WhenCancelled()`, {
          annotations: [when('the customer cancels the order')],
        }),
      feature(ORDERS_FEATURE),
    );

    expect<unknown>(built.model.rules).toEqual([]);
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining(
        `scenario "Placed": its When steps invoke 2 behaviors (${CANCEL}, ${PLACE}), not one`,
      ),
      expect.stringContaining(
        'scenario "Cancelled before placing": its When steps invoke no behavior, not one',
      ),
      expect.stringContaining('rule "Non-empty order": none of its scenarios'),
    ]);
  });

  it('keeps the rule of the first feature file by path when two make one id', () => {
    const steps = () =>
      withSteps().method(`M:${STEPS.slice(2)}#WhenPlaced()`, {
        annotations: [when('the customer places the order')],
        invokes: ['M:Sales.Orders.Order#Place()'],
      });
    const text = (kind: string) => `Feature: F
  @${kind}
  Rule: Placing
    Scenario: Placed
      When the customer places the order
`;

    const built = rulesFrom(
      steps(),
      feature(text('post'), 'features/b.feature'),
      feature(text('validation'), 'features/a.feature'),
    );

    expect<unknown>(built.model.rules).toEqual([
      expect.objectContaining({
        id: 'rule|Sales.Orders.Placing',
        kind: 'validation',
        source: { path: 'features/a.feature', line: 3 },
      }),
    ]);
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining(
        'rule "Placing" has the id rule|Sales.Orders.Placing of the rule at features/a.feature:3, which came first; dropped',
      ),
    ]);
  });

  it('keeps the first of two scenarios of one name in a rule', () => {
    const built = rulesFrom(
      withSteps().method(`M:${STEPS.slice(2)}#WhenPlaced()`, {
        annotations: [when('the customer places the order')],
        invokes: ['M:Sales.Orders.Order#Place()'],
      }),
      feature(`Feature: F
  @post
  Rule: Placing
    Scenario: Placed
      When the customer places the order
    Scenario: Placed
      When the customer places the order
      Then again
`),
    );

    expect<unknown>(built.model.scenarios.map(({ source }) => source)).toEqual([
      { path: FEATURE, line: 4 },
    ]);
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining(
        'scenario "Placed" is the second of its name in rule "Placing"',
      ),
    ]);
  });

  it('leaves out a step definition whose expression is none, with a diagnostic', () => {
    const built = rulesFrom(
      withSteps().method(`M:${STEPS.slice(2)}#WhenPlaced()`, {
        annotations: [when('the {customer} places the order')],
        invokes: ['M:Sales.Orders.Order#Place()'],
      }),
    );

    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining(
        `M:${STEPS.slice(2)}#WhenPlaced(): a step definition no step can bind to`,
      ),
    ]);
  });

  it("passes the feature file's own diagnostics on", () => {
    const built = rulesFrom(
      withSteps(),
      feature('Feature: F\n  Scenario: Alone\n    When it runs\n'),
    );

    expect<unknown>(built.diagnostics).toEqual([
      {
        level: 'info',
        message: expect.stringContaining('is under no Rule:'),
        source: { path: FEATURE, line: 2 },
      },
    ]);
  });

  it("binds each of a Java method's repeated @When, as the container annotation holds them", () => {
    const javaWhen = (text: string): Annotation => ({
      type: named('T:io.cucumber.java.en.When'),
      arguments: [
        {
          name: 'value',
          positional: true,
          value: { kind: 'literal', text: JSON.stringify(text) },
        },
      ],
    });
    const built = buildFrom(
      [
        artifact('shop')
          .type('T:shop.orders.Order', {
            annotations: [javaAnnotation('AggregateRoot')],
          })
          .method('M:shop.orders.Order#place()')
          .type('T:shop.orders.OrderSteps')
          .method('M:shop.orders.OrderSteps#placed()', {
            annotations: [
              {
                type: named('T:io.cucumber.java.en.When+Whens'),
                arguments: [
                  {
                    name: 'value',
                    positional: false,
                    value: {
                      kind: 'array',
                      items: [
                        {
                          kind: 'annotation',
                          annotation: javaWhen('it is placed'),
                        },
                        {
                          kind: 'annotation',
                          annotation: javaWhen('it is sent'),
                        },
                      ],
                    },
                  },
                ],
              },
            ],
            invokes: ['M:shop.orders.Order#place()'],
          }),
      ],
      {},
      JAVA_VOCABULARY,
      [
        feature(`Feature: F
  @validation
  Rule: Placing
    Scenario: Placed
      When it is placed
    Scenario: Sent
      When it is sent
`),
      ],
    );

    expect<unknown>(built.model.scenarios.map(({ name }) => name)).toEqual([
      'Placed',
      'Sent',
    ]);
  });

  it("binds Java's Cucumber @When by its value", () => {
    const built = buildFrom(
      [
        artifact('shop')
          .type('T:shop.orders.Order', {
            annotations: [javaAnnotation('AggregateRoot')],
          })
          .method('M:shop.orders.Order#place()')
          .type('T:shop.orders.OrderSteps')
          .method('M:shop.orders.OrderSteps#placed()', {
            annotations: [
              {
                type: named('T:io.cucumber.java.en.When'),
                arguments: [
                  {
                    name: 'value',
                    positional: true,
                    value: {
                      kind: 'literal',
                      text: '"the customer places the order"',
                    },
                  },
                ],
              },
            ],
            invokes: ['M:shop.orders.Order#place()'],
          }),
      ],
      {},
      JAVA_VOCABULARY,
      [
        feature(`Feature: F
  @validation
  Rule: Placing
    Scenario: Placed
      When the customer places the order
`),
      ],
    );

    expect<unknown>(rulesRelationsOf(built.model)).toContainEqual({
      kind: 'governs',
      from: 'behavior|shop.orders.Order.place',
      to: 'rule|shop.orders.Placing',
    });
  });
});

/* ================================================ 13 artifacts (R13) */

describe('13. deployable units and libraries (R13)', () => {
  const unitsAndLibraries = (model: BuiltSystemModel['model']) => ({
    deployableUnits: model.deployableUnits,
    libraries: model.libraries,
    contains: model.relations.filter(
      (relation) =>
        relation.kind === 'contains' &&
        (relation.from.startsWith('deployable_unit|') ||
          relation.from.startsWith('library|')),
    ),
  });

  it('R13.1 makes an executable artifact a deployable unit containing the modules that hold its blocks, by its name and root directory', () => {
    const { model } = buildFrom([
      artifact('MyCompany.Shop.Api', { executable: true })
        .type('T:Sales.Orders.Order', { annotations: [aggregate()] })
        .type('T:Sales.Orders.Line', { annotations: [entity()] })
        .type('T:Sales.Pricing.Quote', { annotations: [valueObject()] }),
    ]);
    expect<unknown>(unitsAndLibraries(model)).toEqual({
      deployableUnits: [
        {
          id: 'deployable_unit|MyCompany.Shop.Api',
          name: 'MyCompany.Shop.Api',
          description: null,
          source: { path: 'MyCompany.Shop.Api', line: null },
        },
      ],
      libraries: [],
      contains: [
        {
          kind: 'contains',
          from: 'deployable_unit|MyCompany.Shop.Api',
          to: 'module|Sales.Orders',
        },
        {
          kind: 'contains',
          from: 'deployable_unit|MyCompany.Shop.Api',
          to: 'module|Sales.Pricing',
        },
      ],
    });
  });

  it('R13.2 makes any other artifact a library containing its blocks', () => {
    const { model } = buildFrom([
      sales().type('T:Sales.Orders.Line', { annotations: [entity()] }),
    ]);
    expect<unknown>(unitsAndLibraries(model)).toEqual({
      deployableUnits: [],
      libraries: [
        {
          id: 'library|Sales',
          name: 'Sales',
          description: null,
          source: { path: 'Sales', line: null },
        },
      ],
      contains: [
        {
          kind: 'contains',
          from: 'library|Sales',
          to: 'building_block|Sales.Orders.Line',
        },
        { kind: 'contains', from: 'library|Sales', to: ORDER },
      ],
    });
  });

  it('R13.3 makes nothing of an artifact that declares no block or is excluded, with a diagnostic for the first', () => {
    const built = buildFrom([
      sales(),
      artifact('Sales.Tests', { executable: true }).type('T:Sales.Tests.Steps'),
      artifact('Legacy', { annotations: [exclude()] }).type(
        'T:Legacy.Old.Thing',
        { annotations: [aggregate()] },
      ),
    ]);
    expect<unknown>(ids(built.model.deployableUnits)).toEqual([]);
    expect<unknown>(ids(built.model.libraries)).toEqual(['library|Sales']);
    expect<unknown>(messages(built, 'info')).toEqual([
      'A:Sales.Tests declares no building block; no deployable unit or library',
    ]);
  });

  it('R13.4 keeps the first of two artifacts with one name, with a diagnostic', () => {
    const built = buildFrom([
      artifact('Shop').type('T:Sales.Orders.Order', {
        annotations: [aggregate()],
      }),
      artifact('Shop').type('T:Sales.Pricing.Quote', {
        annotations: [valueObject()],
      }),
    ]);
    expect<unknown>(ids(built.model.libraries)).toEqual(['library|Shop']);
    expect<unknown>(messages(built, 'info')).toContainEqual(
      'A:Shop has the id library|Shop, which came first; dropped',
    );
  });
});

/* ======================================== 14 library manifests (R14) */

describe('14. libraries described by hand (R14)', () => {
  const KERNEL = '.noesis/libraries/kernel.json';
  const kernel = (
    buildingBlocks: LibraryManifest['buildingBlocks'],
    more: Partial<LibraryManifest> = {},
  ): LibraryManifest => ({
    name: 'MyCompany.Shared.Kernel',
    buildingBlocks,
    path: KERNEL,
    ...more,
  });
  const MONEY = 'building_block|Shared.Money';
  const CLOCK = 'building_block|Shared.Clock';
  /** An order holding a stubbed Money and Clock. */
  const order = () =>
    sales()
      .stub('T:Shared.Money')
      .stub('T:Shared.Clock')
      .property('P:Sales.Orders.Order.Total', named('T:Shared.Money'))
      .property('P:Sales.Orders.Order.Clock', named('T:Shared.Clock'));

  it("R14.1 makes each listed type a block of its namespace's module, which a slot typed by its stub resolves to", () => {
    const { model } = buildFrom(
      [order()],
      {},
      CSHARP_VOCABULARY,
      [],
      [
        kernel([
          {
            type: 'Shared.Money',
            kind: 'value_object',
            description: 'An amount in a currency.',
          },
          { type: 'Shared.Clock', kind: 'technical_service' },
        ]),
      ],
    );
    expect<unknown>(
      model.buildingBlocks.find((block) => block.id === MONEY),
    ).toEqual({
      id: MONEY,
      name: 'Money',
      type: 'value_object',
      description: 'An amount in a currency.',
      source: { path: KERNEL, line: null },
    });
    expect<unknown>(ids(model.modules)).toContain('module|Shared');
    expect<unknown>(stateTypesOf(model, ORDER)).toEqual([['Total', MONEY]]);
    expect<unknown>(collaboratorsOf(model, ORDER)).toEqual([['Clock', CLOCK]]);
  });

  it('R14.2 names a listed block by its "name", else by the type, nested types joined and a generic\'s arity left out', () => {
    const { model } = buildFrom(
      [sales()],
      {},
      CSHARP_VOCABULARY,
      [],
      [
        kernel([
          { type: 'Shared.Result`1', kind: 'value_object' },
          { type: 'Shared.Money+Currency', kind: 'value_object' },
          { type: 'Shared.Clk', kind: 'technical_service', name: 'Clock' },
        ]),
      ],
    );
    expect<unknown>(
      ids(model.buildingBlocks).filter((id) => id.includes('Shared')),
    ).toEqual([
      'building_block|Shared.Clock',
      'building_block|Shared.Money Currency',
      'building_block|Shared.Result',
    ]);
  });

  it('R14.3 drops a listed type the code declares, one in no module, and one listed twice, with a diagnostic each', () => {
    const built = buildFrom(
      [sales()],
      {},
      CSHARP_VOCABULARY,
      [],
      [
        kernel([
          { type: 'Sales.Orders.Order', kind: 'entity' },
          { type: 'Money', kind: 'value_object' },
          { type: 'Shared.Clock', kind: 'technical_service' },
          { type: 'Shared.Clock', kind: 'domain_service' },
        ]),
      ],
    );
    expect<unknown>(
      built.model.buildingBlocks.find((block) => block.id === ORDER)?.type,
    ).toBe('aggregate');
    expect<unknown>(messages(built, 'info')).toEqual([
      `${KERNEL}: Sales.Orders.Order is declared in the scanned code; annotate it there instead; dropped`,
      `${KERNEL}: Money is in the global namespace, which maps to no module; dropped`,
      `${KERNEL}: Shared.Clock is listed already; dropped`,
    ]);
  });

  it('R14.4 makes each manifest a library containing its blocks, after the scanned ones, the first of one name winning', () => {
    const built = buildFrom(
      [sales()],
      {},
      CSHARP_VOCABULARY,
      [],
      [
        kernel([{ type: 'Shared.Money', kind: 'value_object' }], {
          description: 'Shared value types.',
        }),
        kernel([{ type: 'Shared.Clock', kind: 'technical_service' }], {
          name: 'Sales',
          path: '.noesis/libraries/sales.json',
        }),
      ],
    );
    expect<unknown>(built.model.libraries).toEqual([
      {
        id: 'library|MyCompany.Shared.Kernel',
        name: 'MyCompany.Shared.Kernel',
        description: 'Shared value types.',
        source: { path: KERNEL, line: null },
      },
      {
        id: 'library|Sales',
        name: 'Sales',
        description: null,
        source: { path: 'Sales', line: null },
      },
    ]);
    expect<unknown>(built.model.relations).toContainEqual({
      kind: 'contains',
      from: 'library|MyCompany.Shared.Kernel',
      to: MONEY,
    });
    expect<unknown>(messages(built, 'info')).toContain(
      '.noesis/libraries/sales.json has the id library|Sales, which came first; dropped',
    );
  });
});

/* =================================================== 15 layers (R15) */

describe('15. layers (R15)', () => {
  const layersOf = (model: BuiltSystemModel['model']) => ({
    layers: model.layers,
    contains: model.relations.filter(
      (relation) =>
        relation.kind === 'contains' && relation.from.startsWith('layer|'),
    ),
  });
  const shop = () =>
    artifact('shop')
      .type('T:com.shop.domain.Order', {
        annotations: [javaAnnotation('AggregateRoot')],
      })
      .type('T:com.shop.domain.pricing.Quote', {
        annotations: [javaAnnotation('ValueObject')],
      })
      .type('T:com.shop.app.PlaceOrder', {
        annotations: [javaAnnotation('ApplicationService')],
      })
      .type('T:com.shop.app.web.OrdersController', {
        annotations: [javaAdapter('PRIMARY')],
      })
      .type('T:com.shop.Main', {
        annotations: [javaAnnotation('TechnicalService')],
      });
  const PACKAGE_INFO = 'shop/src/main/java/com/shop/domain/package-info.java';

  it('R15.1 makes a layer of each name a package annotation gives, found in its package-info.java, containing the blocks under the package', () => {
    const { model } = buildFrom(
      [
        shop()
          .namespace('com.shop.domain', PACKAGE_INFO, [javaLayer('domain')])
          .namespace('com.shop.app', undefined, [javaLayer('application')]),
      ],
      {},
      JAVA_VOCABULARY,
    );
    expect<unknown>(layersOf(model)).toEqual({
      layers: [
        {
          id: 'layer|application',
          name: 'application',
          description: null,
          source: expect.objectContaining({ path: expect.any(String) }),
        },
        {
          id: 'layer|domain',
          name: 'domain',
          description: null,
          source: { path: PACKAGE_INFO, line: expect.any(Number) },
        },
      ],
      contains: [
        {
          kind: 'contains',
          from: 'layer|application',
          to: 'building_block|com.shop.app.PlaceOrder',
        },
        {
          kind: 'contains',
          from: 'layer|application',
          to: 'building_block|com.shop.app.web.OrdersController',
        },
        {
          kind: 'contains',
          from: 'layer|domain',
          to: 'building_block|com.shop.domain.Order',
        },
        {
          kind: 'contains',
          from: 'layer|domain',
          to: 'building_block|com.shop.domain.pricing.Quote',
        },
      ],
    });
  });

  it('R15.2 puts a block in the layer of the nearest annotated package above it, and one under none in no layer', () => {
    const { model } = buildFrom(
      [
        shop()
          .namespace('com.shop', undefined, [javaLayer('application')])
          .namespace('com.shop.domain', undefined, [javaLayer('domain')]),
      ],
      {},
      JAVA_VOCABULARY,
    );
    expect<unknown>(
      layersOf(model).contains.map((relation) => [relation.from, relation.to]),
    ).toEqual([
      ['layer|application', 'building_block|com.shop.Main'],
      ['layer|application', 'building_block|com.shop.app.PlaceOrder'],
      ['layer|application', 'building_block|com.shop.app.web.OrdersController'],
      ['layer|domain', 'building_block|com.shop.domain.Order'],
      ['layer|domain', 'building_block|com.shop.domain.pricing.Quote'],
    ]);
    const none = buildFrom([shop()], {}, JAVA_VOCABULARY);
    expect<unknown>(layersOf(none.model)).toEqual({ layers: [], contains: [] });
  });

  it('R15.3 gathers the packages of one layer name into one layer', () => {
    const { model } = buildFrom(
      [
        shop()
          .namespace('com.shop.domain', undefined, [javaLayer('core')])
          .namespace('com.shop.app', undefined, [javaLayer('core')]),
      ],
      {},
      JAVA_VOCABULARY,
    );
    expect<unknown>(model.layers.map((layer) => layer.id)).toEqual([
      'layer|core',
    ]);
    expect(layersOf(model).contains).toHaveLength(4);
  });

  it('R15.4 drops a layer no block is in, a name that is no element name, and a second annotation, with a diagnostic each', () => {
    const built = buildFrom(
      [
        shop()
          .namespace('com.shop.domain', undefined, [
            javaLayer('domain'),
            javaLayer('core'),
          ])
          .namespace('com.shop.app', undefined, [javaLayer('app.layer')])
          .namespace('com.shop.infra', undefined, [
            javaLayer('infrastructure'),
          ]),
      ],
      {},
      JAVA_VOCABULARY,
    );
    expect<unknown>(built.model.layers.map((layer) => layer.id)).toEqual([
      'layer|domain',
    ]);
    expect<unknown>(messages(built, 'info')).toEqual(
      expect.arrayContaining([
        'namespace com.shop.domain carries 2 layer annotations; the first wins',
        'namespace com.shop.app: the layer name "app.layer" is no element name; dropped',
        'layer|infrastructure holds no building block; dropped',
      ]),
    );
  });

  it('R15.5 lets the first artifact by id win a package two artifacts annotate apart', () => {
    const built = buildFrom(
      [
        shop().namespace('com.shop.domain', undefined, [javaLayer('domain')]),
        artifact('tests').namespace('com.shop.domain', undefined, [
          javaLayer('test'),
        ]),
      ],
      {},
      JAVA_VOCABULARY,
    );
    expect<unknown>(built.model.layers.map((layer) => layer.id)).toEqual([
      'layer|domain',
    ]);
    expect<unknown>(messages(built, 'info')).toContain(
      'namespace com.shop.domain is in layer|domain by an annotation that came first; layer|test dropped',
    );
  });

  it('R15.6 reads no layer from C#, whose annotation package has none yet', () => {
    const built = buildFrom([
      sales().namespace('Sales', undefined, [
        attr('LayerAttribute', { name: 'domain' }),
      ]),
    ]);
    expect<unknown>(built.model.layers).toEqual([]);
  });
});
