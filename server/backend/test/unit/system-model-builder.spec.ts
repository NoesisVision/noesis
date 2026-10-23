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
  ScanManifest,
  SourceSpan,
  StubNode,
  TypeKind,
  TypeParameter,
  TypeRef,
  Visibility,
} from '#backend/app/scanner/code-model/code-model';
import { unquote } from '#backend/app/scanner/code-model/system-model-builder/annotations';
import {
  type BuiltSystemModel,
  buildSystemModel,
} from '#backend/app/scanner/code-model/system-model-builder/build-system-model';
import { CSHARP_VOCABULARY } from '#backend/app/scanner/code-model/system-model-builder/csharp.vocabulary';
import { JAVA_VOCABULARY } from '#backend/app/scanner/code-model/system-model-builder/java.vocabulary';
import {
  NamespaceConfig,
  type NamespaceConfigInput,
} from '#backend/app/scanner/code-model/system-model-builder/namespace-config';
import type { AnnotationVocabulary } from '#backend/app/scanner/code-model/system-model-builder/vocabulary';
import { SystemModel } from '#backend/app/scanner/system-model/system-model';

/*
 * One `describe` per section of docs/plans/code-model-to-system-model.md,
 * one `it` per rule, each over the smallest code model that shows it. The
 * builder below writes a `CodeModelFile` the way the .NET scanner does:
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
type ArgumentInput = string | null | { readonly enum: string };

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
  if (value === null) return { kind: 'literal', text: 'null' };
  if (typeof value === 'string') {
    return { kind: 'literal', text: JSON.stringify(value) };
  }
  return {
    kind: 'enum',
    type: named(`${ANNOTATIONS}.Domain.TriggeredBy`),
    member: value.enum,
  };
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
const behaviour = (name: string | null = null) =>
  attr('Domain.DomainBehaviorAttribute', { name });
const entryPoint = (triggeredBy: string, name: string | null = null) =>
  attr('Domain.EntryPointAttribute', {
    name,
    TriggeredBy: { enum: triggeredBy },
  });
const actor = (name: string) => attr('People.ActorAttribute', { name });
const description = (markdownText: string) =>
  attr('ShortDescriptionAttribute', { markdownText });
const scenario = (name: string | null) =>
  attr('Domain.ScenarioAttribute', { name });
const exclude = () => attr('ExcludeFromDocsAttribute');
const domainModel = () => attr('Domain.DomainModelAttribute');

/** A `vision.noesis.annotations` annotation, which carries no arguments. */
const javaAnnotation = (short: string): Annotation => ({
  type: named(`T:vision.noesis.annotations.${short}`),
  arguments: [],
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
  private line = 1;

  constructor(
    readonly name: string,
    options: { annotations?: Annotation[]; dependsOn?: string[] } = {},
  ) {
    this.id = `A:${name}`;
    this.annotations = options.annotations ?? [];
    this.dependencies = options.dependsOn ?? [];
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

  /** `N:A.B.C`, with every level above it. */
  namespace(dotted: string, file?: string): this {
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
        executable: false,
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

const artifact = (
  name: string,
  options?: { annotations?: Annotation[]; dependsOn?: string[] },
) => new ArtifactBuilder(name, options);

/** Builds the system model of the artifacts in the given (dependency) order. */
function buildFrom(
  artifacts: ArtifactBuilder[],
  config: NamespaceConfigInput = {},
  vocabulary: AnnotationVocabulary = CSHARP_VOCABULARY,
): BuiltSystemModel {
  const files = artifacts.map((a) => a.build());
  const manifest: ScanManifest = {
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
    vocabulary,
    config: NamespaceConfig.of(config),
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
  it('R3.1 reads an excluded artifact for resolution only: no block, module or behaviour from it', () => {
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
    expect<unknown>(model.buildingBlocks[0]?.implements).toEqual([]);
    expect<unknown>(
      model.behaviours.find((b) => b.name === 'Place')?.invokes,
    ).toEqual(['behavior|Sales.Order.Total']);
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
    expect<unknown>(ids(model.behaviours)).toEqual([
      'behavior|Sales.Orders.Order.Place',
    ]);
    expect<unknown>(
      model.buildingBlocks[0]?.properties.map((p) => p.name),
    ).toEqual(['Total']);
  });

  it('R3.4 never makes a generated member a behaviour or a property', () => {
    const { model } = buildFrom([
      sales()
        .method('M:Sales.Orders.Order#<Clone>$()', { origin: 'generated' })
        .method('M:Sales.Orders.Order#Place()')
        .property('P:Sales.Orders.Order.EqualityContract', prim('string'), {
          origin: 'generated',
        })
        .property('P:Sales.Orders.Order.Total', prim('decimal')),
    ]);
    expect<unknown>(ids(model.behaviours)).toEqual([
      'behavior|Sales.Orders.Order.Place',
    ]);
    expect<unknown>(
      model.buildingBlocks[0]?.properties.map((p) => p.name),
    ).toEqual(['Total']);
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
    expect<unknown>(model.buildingBlocks[0]?.implements).toEqual([]);
    expect<unknown>(model.buildingBlocks[1]?.properties).toEqual([]);
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

  it('R4.4 lists the blocks among the direct supertypes, type arguments ignored, sorted and unique', () => {
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
      model.buildingBlocks.find((b) => b.name === 'OrderRepository')
        ?.implements,
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

  it('R4.7 takes the Scenario annotations on a type as its scenarios, by title only, and has no rules', () => {
    const built = buildFrom([
      artifact('Sales').type('T:Sales.Order', {
        annotations: [
          aggregate(),
          scenario('Order is placed'),
          scenario('With.Dots'),
          scenario(null),
        ],
      }),
    ]);
    expect<unknown>(built.model.buildingBlocks[0]).toMatchObject({
      rules: [],
      scenarios: [{ name: 'Order is placed', description: null, steps: [] }],
    });
    expect<unknown>(messages(built, 'info')).toHaveLength(2);
  });
});

/* ======================================================= 5 properties */

describe('5. properties', () => {
  it('R5.1 takes public instance properties and fields; not static, event, indexer, enum member or constant ones', () => {
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
      model.buildingBlocks
        .find((b) => b.name === 'Order')
        ?.properties.map((p) => p.name),
    ).toEqual(['Total', 'Count']);
    expect<unknown>(
      model.buildingBlocks.find((b) => b.name === 'Status')?.properties,
    ).toEqual([]);
  });

  it('R5.2 makes a field and a property of one name one property, the property winning', () => {
    const { model } = buildFrom([
      sales()
        .field('F:Sales.Orders.Order._total', prim('int'))
        .property('P:Sales.Orders.Order.Total', prim('decimal')),
    ]);
    expect<unknown>(model.buildingBlocks[0]?.properties).toEqual([
      {
        name: 'Total',
        type: 'primitive|decimal',
        description: null,
        optional: false,
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
    expect<unknown>(
      built.model.buildingBlocks[0]?.properties.map((p) => p.name),
    ).toEqual(['Total']);
    expect<unknown>(messages(built, 'debug')).toEqual([
      expect.stringContaining('P:Sales.Orders.Order.Clock'),
    ]);
  });

  it('R5.4 marks a nullable or Nullable<T> member optional', () => {
    const { model } = buildFrom([
      sales()
        .property('P:Sales.Orders.Order.A', nullable(prim('string')))
        .property('P:Sales.Orders.Order.B', named(SYS.nullableOf, prim('int')))
        .property(
          'P:Sales.Orders.Order.C',
          nullable(named('T:Sales.Orders.Order')),
        )
        .property('P:Sales.Orders.Order.D', prim('int')),
    ]);
    expect<unknown>(
      model.buildingBlocks[0]?.properties.map((p) => [p.name, p.optional]),
    ).toEqual([
      ['A', true],
      ['B', true],
      ['C', true],
      ['D', false],
    ]);
  });

  it('R5.5 orders properties by location, then name', () => {
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
    expect<unknown>(
      model.buildingBlocks[0]?.properties.map((p) => p.name),
    ).toEqual(['C', 'A', 'B', 'Z']);
  });

  it("R5.7 takes a Java record's components as properties although their fields are private, and their accessors as no behaviours", () => {
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
    const money = model.buildingBlocks.find((b) => b.name === 'Money');
    expect<unknown>(money?.properties.map((p) => [p.name, p.type])).toEqual([
      ['amount', 'primitive|integer'],
    ]);
    expect<unknown>(model.behaviours.map((b) => b.name)).toEqual(['negate']);
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
    model.buildingBlocks
      .find((b) => b.name === 'Offer')
      ?.properties.map((p) => [p.name, p.type]);

  it("R5.8 takes a Java field behind Lombok's generated getter as a property, described by the field, else the getter", () => {
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
    expect<unknown>(
      model.buildingBlocks[0]?.properties.map((p) => [p.name, p.description]),
    ).toEqual([
      ['products', 'The products offered.'],
      ['total', 'What is owed.'],
    ]);
    expect<unknown>(model.behaviours).toEqual([]);
  });

  it('R5.8 takes a Java field behind a hand-written getter as a property, and the getter as no behaviour', () => {
    const model = javaModel(
      offer()
        .field('F:com.acme.Offer.total', prim('long'), privateField)
        .method('M:com.acme.Offer#getTotal()', { returns: prim('long') })
        .method('M:com.acme.Offer#discount()', { returns: prim('long') }),
    );
    expect<unknown>(propertiesOfOffer(model)).toEqual([
      ['total', 'primitive|integer'],
    ]);
    expect<unknown>(model.behaviours.map((b) => b.name)).toEqual(['discount']);
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
    expect<unknown>(model.behaviours.map((b) => b.name)).toEqual(['isCount']);
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
    expect<unknown>(model.behaviours.map((b) => b.name)).toEqual([
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
    expect<unknown>(model.behaviours.map((b) => b.name)).toEqual([
      'getInstances',
      'getLimit',
    ]);
  });

  it('R5.8 leaves C# alone: a private field behind a getter method is no property, the method a behaviour', () => {
    const { model } = buildFrom([
      sales()
        .field('F:Sales.Orders.Order.total', prim('decimal'), {
          visibility: 'private',
        })
        .method('M:Sales.Orders.Order#getTotal()', { returns: prim('decimal') })
        .method('M:Sales.Orders.Order#total()', { returns: prim('decimal') }),
    ]);
    expect<unknown>(model.buildingBlocks[0]?.properties).toEqual([]);
    expect<unknown>(model.behaviours.map((b) => b.name)).toEqual([
      'getTotal',
      'total',
    ]);
  });

  it('R5.6 describes a property by its doc comment', () => {
    const { model } = buildFrom([
      sales().property('P:Sales.Orders.Order.Total', prim('decimal'), {
        documentation: 'What is owed.',
      }),
    ]);
    expect<unknown>(model.buildingBlocks[0]?.properties[0]?.description).toBe(
      'What is owed.',
    );
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
    ]);
  });

  it("R6.2 makes a module per prefix of a block's module path and none for an empty namespace", () => {
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

  it('R6.5 gives a module no description and no rules', () => {
    const { model } = buildFrom([
      artifact('Sales').type('T:Sales.Order', { annotations: [aggregate()] }),
    ]);
    expect<unknown>(model.modules[0]).toMatchObject({
      description: null,
      rules: [],
    });
  });
});

/* ================================================== 7 type resolution */

/** Resolves `type` as the type of one property of the aggregate `Sales.Order`. */
function resolved(
  type: TypeRef,
  extend: (builder: ArtifactBuilder) => ArtifactBuilder = (b) => b,
): { type: unknown; optional: boolean } | undefined {
  const builder = extend(
    artifact('Sales').type('T:Sales.Order', { annotations: [aggregate()] }),
  ).property('P:Sales.Order.Probe', type);
  const { model } = buildFrom([builder]);
  const property = model.buildingBlocks
    .find((b) => b.id === 'building_block|Sales.Order')
    ?.properties.find((p) => p.name === 'Probe');
  return property === undefined
    ? undefined
    : { type: property.type, optional: property.optional };
}

describe('7. resolving a type reference', () => {
  it('R7.1 looks through Task<T> and ValueTask<T>, makes Nullable<T> optional, and gives Task, void and dynamic nothing', () => {
    expect<unknown>(resolved(named(SYS.taskOf, prim('int')))).toEqual({
      type: 'primitive|integer',
      optional: false,
    });
    expect<unknown>(
      resolved(named(SYS.valueTaskOf, named('T:Sales.Order'))),
    ).toEqual({
      type: 'building_block|Sales.Order',
      optional: false,
    });
    expect<unknown>(resolved(named(SYS.nullableOf, named(SYS.guid)))).toEqual({
      type: 'primitive|uuid',
      optional: true,
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
      optional: true,
    });
  });

  it('R7.3 makes arrays and the collection types collections of their element, nested too; a dictionary is nothing, with a diagnostic', () => {
    expect<unknown>(resolved(arr(prim('int')))?.type).toEqual({
      collectionOf: 'primitive|integer',
    });
    expect<unknown>(
      resolved(named(SYS.list, named('T:Sales.Order')))?.type,
    ).toEqual({
      collectionOf: 'building_block|Sales.Order',
    });
    expect<unknown>(
      resolved(named(SYS.enumerable, arr(prim('string'))))?.type,
    ).toEqual({
      collectionOf: { collectionOf: 'primitive|string' },
    });
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
    expect<unknown>(built.model.buildingBlocks[0]?.properties).toEqual([]);
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
      model.buildingBlocks.find((b) => b.name === 'Order')?.properties[0]?.type,
    ).toBe('building_block|Shared.IRepository');
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
    expect<unknown>(
      model.buildingBlocks.find((b) => b.name === 'Order')?.properties[0]?.type,
    ).toBe('building_block|Common.Sales money');
    expect<unknown>(
      model.buildingBlocks.find((b) => b.name === 'Invoice')?.properties[0]
        ?.type,
    ).toBe('building_block|Common.Shared money');
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

/* ======================================================= 9 behaviours */

describe('9. behaviours', () => {
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
    expect<unknown>(ids(model.behaviours)).toEqual([
      'behavior|Sales.Orders.Order.Create',
      'behavior|Sales.Orders.Order.Place',
    ]);
  });

  it('R9.1 takes a method with a behaviour annotation whatever its visibility or name, as a private behaviour when not public', () => {
    const { model } = buildFrom([
      sales()
        .method('M:Sales.Orders.Order#Audit()', {
          visibility: 'private',
          annotations: [behaviour()],
        })
        .method('M:Sales.Orders.Order#ToString()', {
          annotations: [behaviour('Describe')],
        }),
    ]);
    expect<unknown>(
      model.behaviours.map((b) => [b.name, b.visibility]),
    ).toEqual([
      ['Audit', { kind: 'private' }],
      ['Describe', { kind: 'public', actors: [] }],
    ]);
  });

  it('R9.2 names a behaviour by the annotation on the method, else on the member it implements or overrides, else the code', () => {
    const built = buildFrom([
      sales()
        .type('T:Sales.Orders.IOrder', {
          kind: 'interface',
          annotations: [repository()],
        })
        .method('M:Sales.Orders.IOrder#Place()', {
          annotations: [behaviour('Place order')],
        })
        .method('M:Sales.Orders.IOrder#Cancel()', {
          annotations: [behaviour('Sales.Cancel')],
        })
        .method('M:Sales.Orders.Order#Place()', {
          implementsMember: ['M:Sales.Orders.IOrder#Place()'],
        })
        .method('M:Sales.Orders.Order#Cancel()', {
          implementsMember: ['M:Sales.Orders.IOrder#Cancel()'],
        })
        .method('M:Sales.Orders.Order#Ship()', {
          annotations: [behaviour('Ship it')],
        }),
    ]);
    expect<unknown>(ids(built.model.behaviours)).toEqual([
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

  it('R9.3 collapses overloads into one behaviour that the overload with the most parameters stands for, the first declared of those', () => {
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
    expect<unknown>(model.behaviours).toHaveLength(1);
    expect<unknown>(model.behaviours[0]?.input.map((i) => i.name)).toEqual([
      'quantity',
      'note',
    ]);
    expect<unknown>(model.behaviours[0]?.source.line).toBe(5);
  });

  it("R9.4 types a behaviour by TriggeredBy on its own or an implemented member's annotation; a Command without one", () => {
    const { model } = buildFrom([
      sales()
        .type('T:Sales.Orders.IHandler', {
          kind: 'interface',
          annotations: [domainService()],
        })
        .method('M:Sales.Orders.IHandler#Handle()', {
          annotations: [entryPoint('Event')],
        })
        .method('M:Sales.Orders.Order#Total()', {
          returns: prim('decimal'),
          annotations: [entryPoint('Query')],
        })
        .method('M:Sales.Orders.Order#Place()', {
          annotations: [entryPoint('Command')],
        })
        .method('M:Sales.Orders.Order#Handle()', {
          implementsMember: ['M:Sales.Orders.IHandler#Handle()'],
        })
        .method('M:Sales.Orders.Order#Unspecified()', {
          returns: prim('decimal'),
          annotations: [entryPoint('Unspecified')],
        })
        .method('M:Sales.Orders.Order#GetTotal()', {
          returns: prim('decimal'),
        }),
    ]);
    expect<unknown>(model.behaviours.map((b) => [b.name, b.type])).toEqual([
      ['Handle', 'Event'],
      ['GetTotal', 'Command'],
      ['Handle', 'Event'],
      ['Place', 'Command'],
      ['Total', 'Query'],
      ['Unspecified', 'Command'],
    ]);
  });

  it('R9.4 takes the type a Java handler annotation fixes itself, which carries no argument', () => {
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
          })
          .method('M:com.acme.Orders#list()', { returns: prim('long') }),
      ],
      {},
      JAVA_VOCABULARY,
    );
    expect<unknown>(
      model.behaviours.map((b) => [b.name, b.type, b.visibility.kind]),
    ).toEqual([
      ['list', 'Command', 'public'],
      ['onPlaced', 'Event', 'private'],
      ['place', 'Command', 'public'],
      ['total', 'Query', 'public'],
    ]);
  });

  it('R9.5 collects the actors of the method, the members it implements and its type, sorted and unique', () => {
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
    expect<unknown>(model.behaviours.map((b) => b.visibility)).toEqual([
      { kind: 'public', actors: ['Sales rep'] },
      { kind: 'public', actors: ['Customer'] },
      { kind: 'public', actors: ['Admin', 'Customer', 'Sales rep'] },
    ]);
  });

  it('R9.6 reads the input in declaration order, optional for a default or a nullable type, leaving out what has no word', () => {
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
    expect<unknown>(built.model.behaviours[0]?.input).toEqual([
      { name: 'other', type: ORDER, description: null, optional: false },
      {
        name: 'note',
        type: 'primitive|string',
        description: null,
        optional: true,
      },
      {
        name: 'count',
        type: 'primitive|integer',
        description: null,
        optional: true,
      },
    ]);
    expect<unknown>(messages(built, 'debug')).toEqual([
      expect.stringContaining('parameter token'),
    ]);
  });

  it('R9.7 gives no output for void, Task and ValueTask, and one result otherwise, optional when nullable', () => {
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
    expect<unknown>(model.behaviours.map((b) => [b.name, b.output])).toEqual([
      ['A', []],
      ['B', []],
      ['C', [{ type: ORDER, description: null, optional: false }]],
      ['D', [{ type: 'primitive|string', description: null, optional: true }]],
      ['E', []],
    ]);
  });

  it("R9.8 describes a behaviour by its ShortDescription, its doc comment, or an overload's", () => {
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
    expect<unknown>(model.behaviours.map((b) => b.description)).toEqual([
      'Short',
      'Doc',
      'From the shorter overload',
      null,
    ]);
  });

  it("R9.9 takes the Scenario annotations on every overload as the behaviour's scenarios, by title only", () => {
    const built = buildFrom([
      sales()
        .method('M:Sales.Orders.Order#Place()', {
          annotations: [scenario('Placed empty')],
        })
        .method('M:Sales.Orders.Order#Place(int)', {
          parameters: [{ name: 'n', type: prim('int') }],
          annotations: [scenario('Placed with lines'), scenario(null)],
        }),
    ]);
    expect<unknown>(built.model.behaviours[0]?.scenarios).toEqual([
      { name: 'Placed empty', description: null, steps: [] },
      { name: 'Placed with lines', description: null, steps: [] },
    ]);
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining('without a name'),
    ]);
  });

  it('R9.10 points a behaviour at the chosen overload', () => {
    const { model } = buildFrom([
      sales()
        .method('M:Sales.Orders.Order#Place()', { file: 'a.cs' })
        .method('M:Sales.Orders.Order#Place(int)', {
          parameters: [{ name: 'n', type: prim('int') }],
          file: 'b.cs',
        }),
    ]);
    expect<unknown>(model.behaviours[0]?.source).toEqual({
      path: 'b.cs',
      line: 5,
    });
  });

  it('R9.11 drops a behaviour annotation on a method of a type that is no block, with a diagnostic', () => {
    const built = buildFrom([
      artifact('Sales')
        .type('T:Sales.Helpers', { modifiers: ['static'] })
        .method('M:Sales.Helpers#Count()', {
          annotations: [behaviour('Count things')],
        }),
    ]);
    expect<unknown>(built.model.behaviours).toEqual([]);
    expect<unknown>(messages(built, 'info')).toEqual([
      expect.stringContaining(
        'M:Sales.Helpers#Count() is marked a behaviour but its type is no building block',
      ),
    ]);
  });
});

/* ====================================================== 10 determinism */

describe('10. order and determinism', () => {
  it('R10.1 sorts modules, blocks, behaviours, implements, actors and invokes by id, and gives one output for one input', () => {
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
    expect<unknown>(ids(first.model.behaviours)).toEqual([
      'behavior|Sales.Alpha.Act',
      'behavior|Sales.Alpha.Zip',
      'behavior|Sales.Zed.Make',
    ]);
    expect<unknown>(first.model.behaviours[1]).toMatchObject({
      visibility: { kind: 'public', actors: ['Adam', 'Zoe'] },
      invokes: ['behavior|Sales.Alpha.Act', 'behavior|Sales.Zed.Make'],
    });
  });
});

/* ===================================================== 11 invocations */

describe('11. relations derived from invocations', () => {
  it("R11.1 attributes a call to the behaviours of the calling method and of the members it implements or overrides; an initialiser's call to nothing", () => {
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
    expect<unknown>(model.behaviours.map((b) => [b.id, b.invokes])).toEqual([
      ['behavior|Sales.IOrderRepository.Save', ['behavior|Sales.Order.Total']],
      [
        'behavior|Sales.Order.Place',
        ['behavior|Sales.IOrderRepository.Save', 'behavior|Sales.Order.Total'],
      ],
      ['behavior|Sales.Order.Total', []],
    ]);
  });

  it('R11.2 walks through methods that are no behaviour, across artifacts and excluded types, to the behaviours they reach, and stops at stubs, constructors and cycles', () => {
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
    expect<unknown>(
      model.behaviours.find((b) => b.name === 'Place')?.invokes,
    ).toEqual(['behavior|Sales.Order.Total']);
  });

  it('R11.2 resolves the target through the members it implements: a call to the implementation reaches the interface behaviour', () => {
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
    expect<unknown>(
      model.behaviours.find((b) => b.name === 'Persist')?.invokes,
    ).toEqual(['behavior|Sales.IOrderRepository.Save']);
  });

  it('R11.3 lists the invoked behaviours sorted, unique and never the behaviour itself', () => {
    const { model } = buildFrom([
      artifact('Sales')
        .type('T:Sales.Order', { annotations: [aggregate()] })
        .method('M:Sales.Order#Place()', {
          invokes: [
            'M:Sales.Order#Place()',
            'M:Sales.Order#Total()',
            'M:Sales.Order#Total()',
            'M:Sales.Order#Audit()',
          ],
        })
        .method('M:Sales.Order#Total()', { returns: prim('decimal') })
        .method('M:Sales.Order#Audit()'),
    ]);
    expect<unknown>(
      model.behaviours.find((b) => b.name === 'Place')?.invokes,
    ).toEqual(['behavior|Sales.Order.Audit', 'behavior|Sales.Order.Total']);
  });
});
