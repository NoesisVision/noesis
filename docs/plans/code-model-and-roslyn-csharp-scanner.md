# Design: the common code model and the Roslyn C# scanner

Noesis needs one description of code it can read the same way whatever the
language: C# first, then Java (which today ships a DDD-level graph), then
TypeScript and PHP. This document defines that description, the **code
model**, and the design of the C# scanner that produces it with Roslyn. The
scanner runs with .NET at scan time and accepts source that does not compile.

The code model sits one level below the DDD system model the server keeps in
`.noesis/graph/system-models/`. Building blocks, behaviours and messages are a
projection of the code model through an annotation mapping, computed
downstream once for all languages. Scanners ship code facts; they do not
decide what an aggregate is.

Resolution of type names is Roslyn's job.
[`csharp-type-name-resolution.md`](csharp-type-name-resolution.md) is the
inventory of what influences resolution and the test oracle design.

This is the first iteration. Sections 1 to 7 describe what is built now:
complete declarations, a small set of body-level facts, no caches, no
guesses. Section 8 holds the designed-but-deferred parts, so that a later
iteration starts from a written decision rather than from scratch.

## 1. Decisions

| Topic           | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model level     | Declarations and member-level relations: namespaces, types, members, signatures, generics, attributes, inheritance, overrides, invocations, member accesses, object creation and type tests in bodies. No statements, no expressions, no control flow.                                                                                                                                                                                                                                                           |
| One vocabulary  | A closed set of node and edge kinds shared by all languages. Language-only facts go into a language bag, `languageSpecific`, on the node, never into new kinds.                                                                                                                                                                                                                                                                                                                                                  |
| Identity        | Every node has a stable string id, `<kind letter>:<canonical path>`, built from the language's own canonical names (section 3.2); the manifest names the language of the whole scan. An id is unique within one artifact file; the join key across files is (artifact, id), resolved through the artifact's dependencies.                                                                                                                                                                                        |
| External code   | A symbol declared in another scanned artifact is referenced by its id and never duplicated. Every other referenced symbol is a stub: id, name, kind, owning artifact, and for a type its kind and base chain. Where a type is declared never changes how it is referenced: a NuGet struct, an own class and a project-reference record are the same `TypeRef` shape.                                                                                                                                             |
| Error tolerance | The scanner never fails because code does not compile. Unbound names become `unresolved` type references, unbound calls become diagnostics and no edge; a project that cannot load becomes an empty model with a diagnostic. Exit code is non-zero only when nothing could be loaded.                                                                                                                                                                                                                            |
| Engine          | Roslyn through `MSBuildWorkspace` for exact project options and the referenced source generators. Bodies are read through the `IOperation` tree, not raw syntax, because every site there carries the symbol the compiler bound.                                                                                                                                                                                                                                                                                 |
| Output          | An intermediate model: one scan manifest and one JSON file per artifact under `code-model/<language>/` of the output root, deterministic ordering, `schemaVersion: 1`. The output root defaults to `<repository-root>/.noesis/sessions/scanner/`; the server passes `--out` into its own session directory (`.noesis/sessions/<session>/scanner`), reads the model to build the system model and the session sweep removes it: it is session scratch, gitignored like everything else under `.noesis/sessions/`. |
| Home            | `scanners/dotnet/`, a self-contained .NET 10 solution outside the bun workspace, as the Java scanner is a self-contained Maven build. Published as a `dotnet` tool.                                                                                                                                                                                                                                                                                                                                              |

## 2. Code model: concepts

A scan covers one solution: every C# project of a `.sln`, every module of a
Maven build, every package of an npm workspace. Four node kinds carry
declarations, one carries grouping, and one carries the unit the build tool
produces:

| Node        | What it is                                                                                                    | Examples per language                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Artifact`  | What one build-tool unit produces: the unit the scanner loads, binds and writes as one file                   | C# project (an assembly); Maven module (a jar); npm package; Composer package; an external library is an `Artifact` too                        |
| `Namespace` | A named grouping of types that is not itself a type; a tree by name, each level may hold types                | C# namespace; Java package; TS module file or directory; PHP namespace                                                                         |
| `Type`      | A named type declaration                                                                                      | class, struct, interface, enum, delegate, trait, type alias; a record is a class or struct with the `record` modifier                          |
| `Method`    | A callable member: method, constructor, static initializer, destructor, operator, TS/PHP free function        | a free function hangs off its `Namespace`, not off a synthetic type                                                                            |
| `Property`  | A member reached through accessors: `get`/`set`/`init` for properties and indexers, `add`/`remove` for events | C# property, indexer (a property with parameters), event (a property with `add`/`remove`); TS accessors; Java bean property is **not** derived |
| `Field`     | A storage member                                                                                              | field, TS class field, enum member; a constant is a field with `constantValue`                                                                 |

Everything else is either an attribute of a node (type parameters,
parameters, modifiers, visibility, annotations, locations) or an edge:

| Edge                | From → to                                                                                        | Meaning                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTAINS`          | Artifact → Namespace; Namespace → Namespace/Type/Method/Field; Type → Type/Method/Property/Field | Declaration nesting, one hop: a type sits under the namespace that declares it, at whatever depth; TS/PHP free functions and module-level constants sit under their namespace |
| `EXTENDS`           | Type → Type                                                                                      | Declared base class, base interface of an interface; enum underlying type is **not** an edge                                                                                  |
| `IMPLEMENTS`        | Type → Type                                                                                      | Directly declared interface                                                                                                                                                   |
| `OVERRIDES`         | Method/Property → Method/Property                                                                | Directly overridden member, one hop                                                                                                                                           |
| `IMPLEMENTS_MEMBER` | Method/Property → Method/Property                                                                | Interface member this member satisfies, over every interface of the type, inherited ones included: member mapping needs them all, type-level `IMPLEMENTS` stays direct        |
| `INVOKES`           | Method/Property/Field → Method                                                                   | A call or object creation with a known constructor in the body or initializer of the source member                                                                            |
| `ACCESSES`          | Method/Property/Field → Property/Field                                                           | A read or write of a member                                                                                                                                                   |
| `USES_TYPE`         | Method/Property/Field → Type                                                                     | Body-level use of a type: creation with no constructor symbol, cast, type test                                                                                                |

Signature-level type use (return types, parameter types, field types, base
types, constraints) is written on the node as a `TypeRef`, not as a
`USES_TYPE` edge; a consumer that wants "every type this method touches"
unions the two. Only body-level use needs an edge because bodies are not in
the model. Type arguments are never a use of their own: `List<Order>` in a
field, `new Order[n]` or `M<Order>()` carry `Order` nested in the `TypeRef`
of the field, the array creation or the `INVOKES.typeArguments`, and "every
type touched" is a walk over nested `TypeRef`s, which a consumer needs anyway
for signatures. An object creation with a known constructor is only an
`INVOKES` of that constructor, and the arguments of a constructed generic
(`new Dictionary<string, Order>()`) are that edge's `typeArguments`.

### 2.1 What is deliberately not in the model

- Statements, expressions, local variables, lambdas as entities. Calls made
  inside a lambda or local function are attributed to the enclosing member
  with `viaClosure: true` on the edge.
- Derived relations: "type A depends on type B", "module X uses module Y",
  transitive interface implementation at type level, call graphs lifted to
  types. The server derives these.
- Semantic stereotypes (aggregate, port, command). Derived from the nodes'
  `annotations` plus a mapping, downstream.
- Bodies and members of external code. External types are stubs with a base
  chain (section 4.4).

## 3. Code model: schema

Expressed as TypeScript types because the server validates with zod and the
schema file is the contract every scanner writes against. Scanners in other
languages mirror it (the .NET scanner has a C# copy with a schema test). The
zod schema is `server/backend/src/app/code-model/code-model.ts`; `bun run
generate` writes it as JSON Schema into `scanners/code-model/`
(`manifest.schema.json`, `code-model.schema.json`), the readable copy a
scanner author works from.

### 3.1 Files

One scan writes one manifest and one model file per artifact. The manifest is
what the server opens first: it lists every file the scan produced, so the
server never globs a directory and never mixes files of two scans.

```ts
export interface ScanManifest {
  readonly schemaVersion: 1;
  readonly generator: { readonly name: string; readonly version: string };
  /** The language of the whole scan. */
  readonly language: Language; // 'csharp' | 'java' | 'typescript' | 'php'
  /** Passed in by the server (`--repository`, `--revision`); the scanner does not read git. Lets a system spanning several repositories tell its artifacts apart. */
  readonly repository: { readonly name: string; readonly revision: string };
  /** Repository-relative path of what was scanned: a solution file, a build file or a directory. */
  readonly root: string;
  /** Source artifacts of the solution, one model file each, in dependency order. */
  readonly artifacts: readonly { readonly id: NodeId; readonly file: string }[];
  /** Problems that belong to no artifact: restore failed, solution file unreadable, SDK missing. */
  readonly diagnostics: readonly Diagnostic[];
}

export interface CodeModelFile {
  readonly schemaVersion: 1;
  readonly generator: { readonly name: string; readonly version: string };
  // No `language`: the manifest names the language of the whole scan.
  /** The artifact this file describes. */
  readonly artifact: ArtifactNode;
  readonly nodes: readonly DeclarationNode[]; // sorted by id
  readonly edges: readonly Edge[]; // sorted by (kind, from, canonical string of to, location)
  /**
   * Symbols referenced from this artifact that no scanned artifact declares: each reached symbol plus its
   * containing types and namespace, and for a type its base chain, so a consumer can place it without the library.
   * Symbols of other artifacts of the solution are never stubbed; their ids resolve to that artifact's file.
   */
  readonly stubs: readonly StubNode[]; // sorted by id
  readonly diagnostics: readonly Diagnostic[];
}

/** LSP language identifiers; new entries follow the same convention (`javascript`, `kotlin`). */
export type Language = 'csharp' | 'java' | 'typescript' | 'php';
```

File paths in the manifest are relative to the output root; artifact files
sit beside the manifest in `code-model/<language>/`. The output root is
`--out`, by default `<repository-root>/.noesis/sessions/scanner/`; the server
passes `--out` pointing into its own session directory
(`.noesis/sessions/<session>/scanner`). An explicit relative `--out` resolves
against the current directory, the default against `--repository-root`. The
whole directory is session scratch: gitignored, swept by the server with the
session, and recreated by the next scan.

### 3.2 Identity

```ts
/** `<kind-letter>:<canonical path>`; unique within one artifact file. The language is the manifest's, never part of the id. */
export type NodeId = string & { readonly __brand: 'NodeId' };
```

| Kind      | Letter | Canonical path                                                | C# example                                        |
| --------- | ------ | ------------------------------------------------------------- | ------------------------------------------------- |
| Artifact  | `A`    | assembly name; external artifacts add `@` assembly version    | `A:Sales.Domain`, `A:NodaTime@3.3.2.0`            |
| Namespace | `N`    | dotted name, empty for global; one node per level of the name | `N:Sales.Domain.Orders`                           |
| Type      | `T`    | namespace `.` type path with `+` for nesting and `` ` ``arity | ``T:Sales.Domain.Orders.Order+Line`1``            |
| Method    | `M`    | type path `#` name `` ` ``arity `(` parameter type ids `)`    | ``M:Sales.Domain.Orders.Order#AddLine`1(int,!0)`` |
| Property  | `P`    | type path `.` name, indexers `this[...]` with parameter types | `P:Sales.Domain.Orders.Order.Total`               |
| Field     | `F`    | type path `.` name                                            | `F:Sales.Domain.Orders.Order._lines`              |

Parameter types inside a method id are written as `TypeRef` canonical strings
(section 3.4), with type parameters as `!n` (type's) and `!!n` (method's), so
overloads and generic overloads stay distinct and the id never depends on
parameter _names_. `n` is the CLR-flattened ordinal: parameters of containing
types count first, so in `Outer<T>.Inner<TInner>` `T` is `!0` and `TInner`
is `!1`, while Roslyn's `ITypeParameterSymbol.Ordinal` would report 0 for
both. The scanner adds the containing types' arity to Roslyn's value.
Constructors are `#.ctor`, static initializers `#.cctor`, finalizers
`#Finalize`, operators `#op_Addition` and conversions
`#op_Implicit`/`#op_Explicit` with their return type appended after `:`, as
the CLR does. An explicit interface implementation is named
`<interface canonical string>.<member>` built by the scanner from
`ExplicitInterfaceImplementations[0]`, never from Roslyn's own `Name`, whose
spelling (`IGenericInterface<System.Int32>.GetValue`) is not this grammar.
`file`-local C# types get `@<file hash>` after the type name. Java uses `$`
for nesting in its own canonical form; the model keeps `+` everywhere so
consumers never branch on language for nesting, and for the same reason a
Java constructor is `#.ctor` and a static initializer block `#.cctor`
([`code-model-java-scanner.md`](code-model-java-scanner.md) has the Java
side).

An id is unique within one artifact file, not across the scan: every
artifact that declares `Sales.Domain` has a namespace node
`N:Sales.Domain`, every executable has `T:Program`, and a
`Shared.cs` linked into two projects declares its types twice. The join key
across files is therefore (artifact, id). An edge or a `TypeRef` may point at
an id that its own file does not declare; the target is resolved in the
referencing artifact's own file first, then in its `dependencies` in listed
order, then in `stubs`, never in an unrelated artifact. Namespace nodes
declared by several artifacts are merged by the server by id: locations and
`CONTAINS` are unioned.

The type path never records how the source spelt the name: `using` aliases,
`extern alias` qualifiers, `global::`, namespace aliases and project-file
`<Using>` items all resolve to the same id, and `InternalsVisibleTo` changes
nothing but the `visibility` of the target. An external artifact id uses the
assembly identity because that is what Roslyn knows for every metadata
reference; the NuGet package id and version, when `project.assets.json` maps
the assembly to a package, travel on the artifact's `dependencies` entry.

### 3.3 Nodes

```ts
export interface ArtifactNode {
  readonly id: NodeId;
  /**
   * 'source': built from the solution's own code. 'platform': part of the `target` runtime or SDK
   * (.NET ref pack, JDK modules, TS `lib.d.ts`, PHP built-ins). 'library': any other external artifact.
   * A model file is written for 'source' artifacts only; the other two appear in `dependencies` and on stubs.
   */
  readonly kind: 'source' | 'library' | 'platform';
  /** The name references bind to: assembly name, Maven artifactId, npm package name. The project's own name, when different, is `csharp.projectName`. */
  readonly name: string;
  readonly version: string | null;
  /** Repository-relative directory for source artifacts; null for external ones. */
  readonly rootDirectory: string | null;
  /** 'net10.0', 'jdk-21', 'es2022', 'php-8.3': the platform the declarations were bound against. */
  readonly target: string;
  /** Produces a runnable program: C# `OutputType` Exe, a jar with a main class, an npm package with `bin`. */
  readonly executable: boolean;
  readonly dependencies: readonly {
    readonly id: NodeId;
    readonly kind: 'source' | 'library' | 'platform';
    /** NuGet/Maven/npm/Composer package that ships the library, when the restore output maps it; null for source artifacts and platform assemblies. */
    readonly package: { readonly id: string; readonly version: string } | null;
  }[];
  /** Assembly- and module-level attributes, e.g. `[assembly: InternalsVisibleTo]`. */
  readonly annotations: readonly Annotation[];
  /** `csharp.projectName`, `csharp.projectFile`, `csharp.rootNamespace`, `csharp.outputKind`. */
  readonly languageSpecific: LanguageBag;
}

export type DeclarationNode =
  NamespaceNode | TypeNode | MethodNode | PropertyNode | FieldNode;

interface NodeBase {
  readonly id: NodeId;
  readonly name: string;
  /**
   * 'declared': written in this artifact's code. 'generated': not written by a person, which today covers two
   * things kept apart only by `locations`: compiler-synthesised members (empty `locations`) and source-generator
   * output (locations in generated files). A later split into 'synthesised' and 'generated' is additive.
   */
  readonly origin: 'declared' | 'generated';
  /** Declaration sites; several for partial types. */
  readonly locations: readonly SourceSpan[];
  readonly annotations: readonly Annotation[];
  readonly documentation: string | null; // doc-comment summary when the project parses doc comments (C#: `DocumentationMode` on), else null
  readonly languageSpecific: LanguageBag; // language-only facts, see 3.6
}

export interface NamespaceNode extends NodeBase {
  readonly kind: 'namespace';
  // No namespaceKind: the manifest's `language` already says package, namespace or module file.
  // `annotations` is filled by Java (`package-info`) and empty for C#, which has no namespace attributes;
  // a convention like "an attribute on a type applies to its namespace" is a projection rule, not a scanner fact.
}
```

Namespaces form a tree by name, and every level of the tree is a node: a
declaration `namespace Sales.Domain.Orders` yields `Sales`, `Sales.Domain`
and `Sales.Domain.Orders`, with `CONTAINS` from each to the next. Types may
hang off any level, not only leaves: `Sales.Domain.Order` and
`Sales.Domain.Orders.OrderLine` are both ordinary. A level that no file
declares (here `Sales`) has empty `locations` and `origin: 'declared'`. The
tree has one root: the global namespace, a node with an empty name, which the
artifact's `CONTAINS` points at and which contains the root-level namespaces
and the types declared outside any namespace. The tree is by name alone:
Java packages are flat for access rules and TS directories are real
containers, but both are written the same way, and a consumer that wants
"every type under `Sales`" walks `CONTAINS` transitively.

```ts
export interface TypeNode extends NodeBase {
  readonly kind: 'type';
  readonly typeKind:
    | 'class'
    | 'interface'
    | 'struct' // value type: C# struct and record struct
    | 'enum'
    | 'delegate' // nominal function type: C# delegate
    | 'trait' // PHP trait
    | 'typeAlias'; // TS `type X = ...`
  readonly visibility: Visibility;
  readonly modifiers: readonly Modifier[];
  readonly typeParameters: readonly TypeParameter[];
  /** Enum underlying type, delegate signature, alias target: on the node, not as edges. */
  readonly underlyingType: TypeRef | null;
  readonly delegateSignature: Signature | null;
  readonly aliasOf: TypeRef | null;
}

export interface MethodNode extends NodeBase {
  readonly kind: 'method';
  readonly methodKind:
    | 'method'
    | 'constructor'
    | 'staticInitializer' // C# static constructor, Java and TS static block
    | 'destructor' // C# finalizer, PHP `__destruct`
    | 'operator' // C# operators and conversion operators, CLR `op_*` name
    | 'function'; // TS/PHP free function, contained by its namespace
  readonly visibility: Visibility;
  readonly modifiers: readonly Modifier[];
  readonly typeParameters: readonly TypeParameter[];
  readonly signature: Signature;
  /** For extension methods and C# `extension` members: the receiver type. */
  readonly extensionReceiver: TypeRef | null;
  /** True when the body is absent by design: abstract, interface member, extern, partial without implementation. */
  readonly bodiless: boolean;
}

export interface PropertyNode extends NodeBase {
  readonly kind: 'property';
  // No propertyKind: an indexer is a property with `parameters`, an event a property with `add`/`remove` accessors.
  readonly visibility: Visibility;
  readonly modifiers: readonly Modifier[];
  /** The delegate type for an event. */
  readonly type: TypeRef;
  /** `ref int P => ref _x;`; `ref readonly` adds `csharp.readonlyRef` to the bag. */
  readonly returnPassing: 'value' | 'ref';
  /** Non-empty for indexers (C# `this[...]`, TS index signatures). */
  readonly parameters: readonly Parameter[];
  /** C# `extension` block properties: the receiver type. */
  readonly extensionReceiver: TypeRef | null;
  /** Which accessors exist. Per-accessor visibility, attributes and bodies are deferred (section 8). */
  readonly accessors: readonly ('get' | 'set' | 'init' | 'add' | 'remove')[];
}

export interface FieldNode extends NodeBase {
  readonly kind: 'field';
  /** `enumMember` is not derivable: a Java enum holds ordinary fields beside its constants, and a constant of object type has no `constantValue`. */
  readonly fieldKind: 'field' | 'enumMember';
  readonly visibility: Visibility;
  readonly modifiers: readonly Modifier[];
  readonly type: TypeRef;
  /** C# `ref` fields of a `ref struct`; `ref readonly` adds `csharp.readonlyRef` to the bag. */
  readonly passing: 'value' | 'ref';
  /** Literal value of constants and enum members, as text. */
  readonly constantValue: string | null;
}

/** One shape for every stubbed symbol. Stubs never carry visibility, modifiers, signatures or members. */
export interface StubNode {
  readonly id: NodeId;
  readonly kind: 'namespace' | 'type' | 'method' | 'property' | 'field';
  readonly name: string;
  /** For type stubs: the same values as `TypeNode.typeKind`; null for other kinds. */
  readonly typeKind: TypeNode['typeKind'] | null;
  /** Artifact the symbol comes from, one of the containing artifact's `dependencies`, which say library or platform; null when the stub was built from unbound text. */
  readonly artifact: NodeId | null;
}
```

Shared pieces:

```ts
export interface Signature {
  readonly parameters: readonly Parameter[];
  readonly returnType: TypeRef; // `void` is a TypeRef of kind 'void'
  /** By value or by reference: C# `ref` returns, PHP `function &f()`; `ref readonly` adds `csharp.readonlyRef` to the method's bag. */
  readonly returnPassing: 'value' | 'ref';
  readonly returnAnnotations: readonly Annotation[];
}

export interface Parameter {
  readonly name: string;
  readonly type: TypeRef;
  /** By value or by reference: C# `ref`/`out`/`in`/`ref readonly` (all byref in the CLR), PHP `&$x`; the C# flavour is `csharp.refKind: 'in' | 'out' | 'refReadonly'` in the bag. */
  readonly passing: 'value' | 'ref';
  readonly variadic: boolean; // params, varargs, ...rest
  readonly optional: boolean;
  readonly defaultValue: string | null;
  readonly annotations: readonly Annotation[];
  readonly languageSpecific: LanguageBag; // e.g. `csharp.scoped`, `csharp.refKind`
}

export interface TypeParameter {
  readonly name: string;
  /** CLR-flattened position: containing types' parameters count first (section 3.2). */
  readonly ordinal: number;
  readonly annotations: readonly Annotation[];
  readonly variance: 'invariant' | 'covariant' | 'contravariant';
  readonly constraints: readonly TypeParameterConstraint[];
  /** `csharp.unmanaged`, `csharp.allowsRefStruct`, `csharp.nullableReferenceConstraint` (`class?`), `ts.defaultType` (canonical string). */
  readonly languageSpecific: LanguageBag;
}

export type TypeParameterConstraint =
  | { readonly kind: 'type'; readonly type: TypeRef } // base class, interface, another type parameter; Java `A & B` is several
  | { readonly kind: 'referenceType' } // C# `class`; not emitted for Java, where it is the language rule
  | { readonly kind: 'valueType' } // C# `struct`, also `unmanaged` (then `csharp.unmanaged` in the parameter's bag)
  | { readonly kind: 'notNull' } // C# `notnull`, TS `extends {}`
  | { readonly kind: 'parameterlessConstructor' } // C# `new()`
  | { readonly kind: 'other'; readonly text: string }; // outside the vocabulary, e.g. TS `keyof T`

export type Visibility =
  | 'public'
  | 'protected' // declaring type and its subtypes
  | 'private' // declaring type
  | 'artifact' // C# `internal`
  | 'namespace' // declaring namespace: Java package-private
  | 'file' // C# `file` types, TS non-exported declarations
  | 'protectedOrArtifact' // C# `protected internal`: subtypes anywhere, or the artifact
  | 'protectedAndArtifact' // C# `private protected`: subtypes within the artifact
  | 'protectedOrNamespace'; // Java `protected`: subtypes anywhere, or the package

export type Modifier =
  | 'static'
  | 'abstract'
  | 'final' // cannot be subclassed or overridden: C# `sealed`, Java/PHP `final` on a type or method
  | 'virtual' // has a body and may be overridden; emitted in every language, not only where a keyword exists
  | 'hiding' // hides an inherited member: C# `new`
  | 'readonly' // assigned once: C#/TS/PHP `readonly`, Java `final` on a field
  | 'record' // on a class or struct: compiler synthesises component equality, deconstruction and copy; C# record, Java record
  | 'volatile'
  | 'async'
  | 'external'; // body outside this language: C# `extern`, Java `native`, TS `declare`

export interface Annotation {
  readonly type: TypeRef;
  readonly arguments: readonly {
    /** Always the parameter or element name, so `[Database("Orders")]` and `[Database(Name = "Orders")]` read the same; Java elements are named by definition. */
    readonly name: string;
    readonly positional: boolean;
    readonly value: AnnotationValue;
  }[];
}

export type AnnotationValue =
  | { readonly kind: 'literal'; readonly text: string } // source text of the constant
  | { readonly kind: 'type'; readonly type: TypeRef } // C# `typeof(X)`, Java `X.class`, PHP `X::class`
  | { readonly kind: 'enum'; readonly type: TypeRef; readonly member: string }
  | { readonly kind: 'array'; readonly items: readonly AnnotationValue[] }
  | { readonly kind: 'annotation'; readonly annotation: Annotation } // Java `@Foo(bar = @Bar(1))`, PHP `#[Foo(new Bar())]`
  | { readonly kind: 'other'; readonly text: string }; // outside the vocabulary, text kept

export interface SourceSpan {
  readonly file: string; // repository-relative, forward slashes
  readonly startLine: number;
  readonly startColumn: number; // 1-based
  readonly endLine: number;
  readonly endColumn: number;
}
```

Visibility names the scope in the shared vocabulary (`artifact`,
`namespace`, `file`, type) and never a language keyword, so no two languages
share a value with different meanings. C# `internal` is `artifact`; Java
package-private is `namespace`, never `artifact`, because it is narrower;
TS non-exported declarations are `file`, exported ones `public`; PHP has
`public`, `protected`, `private` only. Composite scopes spell their rule:
C# `protected internal` is a union, `protectedOrArtifact`; C# `private
protected` an intersection, `protectedAndArtifact`; Java `protected` a union
with the package, `protectedOrNamespace`, so it never masquerades as C#
`protected`. A consumer that wants "protected-ish" matches the `protected`
prefix.

Modifiers are facts, not keywords, and the list holds only facts that at least
two languages share and that no other part of the model already carries.
`virtual` is therefore emitted for every Java, TS and PHP instance method that
is not `final`, `private` or `static`, although none of those languages has
the word; a consumer asks "overridable?" with `abstract` or `virtual` in every
language. What is not in the list and why:

| Keyword                                                          | Where the fact lives                                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `override`, Java `@Override`, TS `override`                      | the `OVERRIDES` edge; Java's annotation is optional, so a modifier would lie by omission                                                                                        |
| C# `const`, Java `static final` constant, PHP `const`            | `constantValue` is non-null exactly for a compile-time constant (Roslyn `HasConstantValue`, JLS constant variable); the field also carries `static` and `readonly`, which it is |
| C# explicit interface implementation                             | bag: `csharp.explicitInterfaceImplementation` on the member                                                                                                                     |
| Java `default` interface method                                  | interface `Method` with `bodiless: false`                                                                                                                                       |
| TS `export`                                                      | `visibility`: `public` when exported, `file` otherwise                                                                                                                          |
| C# `ref` / `ref readonly` on returns and fields                  | `returnPassing` on signatures and properties, `passing` on fields, `csharp.readonlyRef` in the bag                                                                              |
| C# `out`, `in`, `ref readonly` parameters                        | `passing: 'ref'` plus `csharp.refKind` in the parameter bag                                                                                                                     |
| Java `throws` clause                                             | bag: `java.throws: string[]` of type ids on the method                                                                                                                          |
| C# `partial`, `required`, `unsafe`, `readonly` member            | bag: `csharp.partial`, `csharp.required`, `csharp.unsafe`, `csharp.readonlyMember`                                                                                              |
| Java `synchronized`, `transient`, `strictfp`, `sealed`/`permits` | bag: `java.synchronized`, `java.transient`, `java.strictfp`, `java.permits: string[]`                                                                                           |

Java 17 `sealed` is not `final`: it restricts the hierarchy to `permits` and
is a bag fact, which is why the shared word for "cannot be derived" is `final`.

`record` is a modifier, not a `typeKind`, because a record is sugar over a
class or struct in both languages that have it. C# `record` compiles to a
class and `record struct` to a struct, each with synthesised `Equals`,
`GetHashCode`, `Deconstruct`, `<Clone>$` and `EqualityContract`; a Java
record is a final class extending `java.lang.Record` with synthesised
accessors, canonical constructor and `equals`/`hashCode`/`toString`. TS and
PHP have nothing comparable (PHP `readonly class` lacks the equality). So the
type is a `class` or `struct`, the synthesised members are emitted with
`origin: 'generated'`, and the one fact the two languages share, "declared
as a record", is the modifier. Kotlin's `data` would map the same way.

An annotation has no `target` field: its placement says what it decorates.
It sits in `annotations` of the node, parameter or type parameter it applies
to, or in `Signature.returnAnnotations`, or on the artifact for
assembly-level attributes. There is no annotation edge: the DDD projection
reads `annotations` on types and members directly.

### 3.4 Type references

```ts
export type TypeRef =
  | {
      readonly kind: 'named';
      readonly type: NodeId;
      /** CLR-flattened: arguments of containing types first, then the type's own; empty when `unbound`. */
      readonly typeArguments: readonly TypeRef[];
      /** `typeof(List<>)`, `typeof(Outer<,>.Inner<>)`: the open generic type with no arguments at all. */
      readonly unbound: boolean;
      readonly nullable: boolean;
    }
  | {
      readonly kind: 'typeParameter';
      readonly owner: NodeId;
      /** CLR-flattened, as on `TypeParameter`. */
      readonly ordinal: number;
      readonly nullable: boolean;
    }
  | {
      readonly kind: 'array';
      readonly element: TypeRef;
      readonly rank: number;
      readonly nullable: boolean;
    }
  | {
      readonly kind: 'tuple';
      readonly elements: readonly {
        readonly name: string | null;
        readonly type: TypeRef;
      }[];
    }
  | {
      readonly kind: 'function';
      readonly signature: Signature;
      readonly callingConvention: string | null;
    } // delegate*, TS function types, PHP closures
  | {
      readonly kind: 'structural';
      readonly members: readonly {
        readonly name: string;
        readonly type: TypeRef;
      }[];
    } // C# anonymous types, TS object literal types
  | { readonly kind: 'pointer'; readonly pointee: TypeRef }
  | { readonly kind: 'union'; readonly members: readonly TypeRef[] } // TS, PHP
  | { readonly kind: 'intersection'; readonly members: readonly TypeRef[] }
  | { readonly kind: 'literal'; readonly text: string } // TS literal types: `'a'`, `42`, `true`
  | { readonly kind: 'primitive'; readonly name: string } // the language's built-in keyword types, see below
  | { readonly kind: 'dynamic' } // member access not bound at compile time: C# dynamic, TS any, PHP mixed
  | { readonly kind: 'void' }
  | { readonly kind: 'unresolved'; readonly text: string } // a name the front end could not bind: the source text
  | { readonly kind: 'other'; readonly text: string }; // outside the vocabulary: TS conditional, mapped, indexed-access, template-literal types
```

`TypeRef` is structural and has no language bag, so a single-language
refinement of a shared kind stays as a field with a neutral default:
`array.rank` is 1 outside C# `int[,]`, `function.callingConvention` is null
outside C# function pointers, `nullable` is false where the language has no
annotation.

`primitive` is every type the language spells with a keyword and treats as
built in, written with that keyword: C# `bool`, `byte`, `sbyte`, `char`,
`short`, `ushort`, `int`, `uint`, `long`, `ulong`, `nint`, `nuint`, `float`,
`double`, `decimal`, `string`, `object`; Java `boolean`, `byte`, `char`,
`short`, `int`, `long`, `float`, `double`; TS `boolean`, `number`, `bigint`,
`string`, `symbol`, `object`, `undefined`, `null`, `unknown`, `never`; PHP
`bool`, `int`, `float`, `string`, `array`, `object`, `null`, `never`. The
same type is never also written as `named`: C# `int` is `primitive int`, not
`named System.Int32`, so an `int` field looks the same in every language.
Members of a primitive still have ids under the declaring platform type
(`"".Trim()` is an `INVOKES` to `M:System.String#Trim()`), because
the CLR declares them there and Java's `Integer` is not `int`. `System.Int32`
written out in C# source is the same type and is still `primitive int`.

`nullable` is the language's annotation (C# `?` under nullable reference
types, PHP `?Foo`, Kotlin-style later), not a wrapper type: C# `int?` is
``named System.Nullable`1`` with the argument `primitive int`, `string?` is
`primitive string` with `nullable: true`, and TS `string | null` is a
`union` of `primitive string` and `primitive null`. Tuples are structural in
every language that has them, so they stay structural here even though C#
lowers them to `ValueTuple`.

A generic type takes one of three forms as a `named` reference, and the
difference is explicit, never inferred from list lengths:

| Form                                    | `typeArguments`                                                    | `unbound` | Example                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------- |
| definition used as a type inside itself | its own parameters as `typeParameter` references                   | false     | `Box<T>` written inside `class Box<T>`: ``Box`1[!0]``                                                             |
| constructed, fully or partially         | the full flattened list, any mix of named and parameter references | false     | `Dictionary<string, T>`: ``Dictionary`2[string,!0]``; `Outer<int>.Inner<string>`: ``Outer`1+Inner`1[int,string]`` |
| unbound                                 | empty                                                              | true      | `typeof(Outer<,>.Inner<>)`: ``Outer`1+Inner`1<>``                                                                 |

C# has no partially unbound form, so these three are exhaustive. Flattening
matters because Roslyn splits the arguments of a nested type across
`ContainingType` and `TypeArguments`: for `Outer<int>.Inner`,
`Inner.TypeArguments` is empty and the `int` sits on the containing type. The
scanner walks the `ContainingType` chain and concatenates, so the fixture's
`GenericClassWithOneParameter<int>.NestedClassSharingOuterParameter` is
``GenericClassWithOneParameter`1+NestedClassSharingOuterParameter[int]``.
`TypeNode.typeParameters` lists the type's own parameters only, with
flattened ordinals, so `NestedGenericClass<TInner>` under
`GenericClassWithOneParameter<T>` declares one parameter with `ordinal: 1`.

Generic methods follow the same rule with nothing to flatten: a `Method` node
is the definition, `!!n` names its own parameters, and an `INVOKES` of a
generic method carries the method's own `typeArguments`, explicit or
inferred. A constructor of a generic type has no type parameters of its own:
its `to` is the constructor of the generic definition, and its
`typeArguments` are the created type's, CLR-flattened like a `named`
reference, so `new Outer<int>.Inner<string>()` carries `[int, string]`.

`canonicalString(TypeRef)` is defined by the same grammar as ids: ``List`1[int]``,
``List`1<>`` for unbound, `int` for a primitive, `int[]`, `int[,]`, `!0`, `!!1`,
`*`, `?` suffix, `(int,string)`, `<unresolved:Foo>`, `<other:T['k']>`. It is
used inside method ids, in edge ordering and in tests.

### 3.5 Edges

```ts
export type Edge =
  | { readonly kind: 'CONTAINS'; readonly from: NodeId; readonly to: NodeId }
  | { readonly kind: 'EXTENDS'; readonly from: NodeId; readonly to: TypeRef } // `from` may be a stub id (section 4.4)
  | { readonly kind: 'IMPLEMENTS'; readonly from: NodeId; readonly to: TypeRef } // `from` may be a stub id
  | { readonly kind: 'OVERRIDES'; readonly from: NodeId; readonly to: NodeId }
  | {
      readonly kind: 'IMPLEMENTS_MEMBER';
      readonly from: NodeId;
      readonly to: NodeId; // the interface member *definition*
      /** The constructed interface: tells `IGenericInterface<int>` from `IGenericInterface<string>` implemented by one type. */
      readonly interface: TypeRef;
      /** The type whose interface list produced this mapping; differs from `from`'s owner when a base-class member satisfies it. */
      readonly declaredOn: NodeId;
      // No `explicit`: C# explicit interface implementation is `csharp.explicitInterfaceImplementation` on the member node.
    }
  | {
      readonly kind: 'INVOKES';
      readonly from: NodeId;
      readonly to: NodeId; // the method *definition*; a constructor for `new T()`
      readonly typeArguments: readonly TypeRef[];
      readonly site: UsageSite;
      /** How the call appears in source; dispatch and target kind are read off `receiver` and the target. */
      readonly invocationKind:
        | 'call' // written as a call: `x.M()`, `M()`, `T.M()`, `new T()`, `: base(...)`
        | 'extension'; // written as an instance call on a static method whose receiver is the first argument
      /** What the receiver expression denotes; null when there is none (free function, `new T()`). */
      readonly receiver: ExpressionKind | null;
    }
  | {
      readonly kind: 'ACCESSES';
      readonly from: NodeId;
      readonly to: NodeId;
      /** `out x` and `{ P = 1 }` are writes; `x += 1`, `x++`, `ref x` and `E += handler` on an event are readWrite. */
      readonly access: 'read' | 'write' | 'readWrite';
      readonly site: UsageSite;
      readonly receiver: ExpressionKind | null;
    }
  | {
      readonly kind: 'USES_TYPE';
      readonly from: NodeId;
      readonly to: TypeRef;
      readonly role:
        | 'creation' // only where there is no constructor symbol: `new T[n]`, `new T()` on a type parameter, anonymous objects, an unbound constructor; a known constructor is an `INVOKES` only
        | 'cast' // C# `(T)x` and `x as T`, Java `(T)x`, TS `x as T`; never for PHP scalar casts
        | 'typeTest'; // C# `is` and type patterns, Java/TS/PHP `instanceof`
      readonly site: UsageSite;
    };

export interface UsageSite {
  readonly location: SourceSpan;
  /** The site is inside a lambda or local function of `from`. */
  readonly viaClosure: boolean;
  /** Language-only site facts: `csharp.eventAccessor: 'add' | 'remove'` for `+=`/`-=` on an event, `csharp.nullConditional` for `?.`. */
  readonly languageSpecific: LanguageBag;
}

/** What an expression denotes; used for receivers now, for arguments later (section 8). */
export type ExpressionKind =
  | 'this' // explicit or implicit `this`; PHP `$this`
  | 'base' // C# `base`, Java/TS `super`, PHP `parent::`
  | 'typeParameter' // `T.Create()` through a static abstract member
  | 'parameter'
  | 'local'
  | 'field'
  | 'property' // events included, since an event is a property
  | 'returnValue' // result of another call
  | 'type' // a type name: `Foo.Bar()`, `Foo::bar()`
  | 'creation' // `new Foo().Bar()`
  | 'literal'
  | 'other';
```

One edge per site, never aggregated: counting is the consumer's job.
`ACCESSES` records what the source wrote: a property access stays a property
access even when the property is auto-implemented over a field, and a
consumer that wants storage-level facts follows declarations and
`IMPLEMENTS_MEMBER`. The `receiver` is a C#/Java/TS/PHP-neutral
classification of what the call was made on; it is what lets the DDD
projection tell "calls a repository it holds in a field" from "calls a
repository passed in". Static versus instance dispatch is `receiver: 'type'`
versus anything else, a constructor call is a `call` whose target id ends in
`#.ctor`, and virtual dispatch is the target's `virtual`/`abstract` with a
receiver other than `base`; none of these is repeated on the edge.

A site the compiler could not bind produces no edge and one diagnostic. The
model never guesses (section 8 keeps the candidate-edge design for later).

### 3.6 Language bag

```ts
export type LanguageBag = Readonly<
  Record<string, string | number | boolean | readonly string[]>
>;
```

Flat, scalar, language-prefixed keys: `csharp.isRefStruct`, `csharp.isFileLocal`,
`csharp.primaryConstructor`, `csharp.extensionBlock`, `csharp.partial`,
`csharp.required`, `csharp.unsafe`, `csharp.readonlyMember`,
`csharp.unmanaged`, `csharp.allowsRefStruct`, `csharp.nullableReferenceConstraint`,
`csharp.refKind`, `csharp.readonlyRef`, `csharp.explicitInterfaceImplementation`,
`csharp.projectName`, `csharp.projectFile`, `csharp.rootNamespace`, `csharp.outputKind`,
`csharp.conversion` (`'implicit' | 'explicit'` on a conversion operator),
`csharp.backingFieldAnnotations` (type ids of `[field:]` attributes on a
property or event), `csharp.positional`, `csharp.fixedSize`, `java.throws`,
`java.isRecordComponent`, `java.isAnnotation`, `java.synchronized`,
`java.transient`, `java.strictfp`, `java.permits`, `java.nonSealed`,
`java.isLocal`, `java.isAnonymous`, `java.enclosingMethod`,
`java.defaultValue`, `java.implicitSuperCall` (on a site), `java.groupId`,
`java.packaging`, `java.buildFile`, `java.engine`, `java.mainClass` (on the
artifact), `ts.defaultType`, `ts.isAmbient`,
`php.isTrait`. A key is added to a per-language list in the schema file;
unknown keys are allowed by the validator and ignored by the server. This is
the escape hatch that keeps the shared vocabulary closed.

### 3.7 Diagnostics

```ts
export interface Diagnostic {
  readonly severity: 'error' | 'warning' | 'info'; // Roslyn Hidden and tsc Suggestion are not emitted
  readonly code: string; // front-end code (`CS0246`, `compiler.err.cant.resolve`, `TS2304`, `E_PARSE`) or scanner code (`NS1001`)
  readonly message: string;
  readonly location: SourceSpan | null;
  /** 'compiler' for the language front end's own diagnostics (csc, javac, tsc, the PHP parser), 'scanner' for load/mapping issues and unbound sites. */
  readonly source: 'compiler' | 'scanner';
}
```

Compiler errors are kept so the server can show "this part of the model is
built from code that does not compile" next to the affected elements.

## 4. C# scanner: architecture

```text
scanners/dotnet/
  src/Noesis.Scanner.Model/    the schema as C# records + JSON writer + canonical ids (language-neutral)
  src/Noesis.Scanner.CSharp/   Roslyn: loading, declaration walk, operation walk, mapping
  src/Noesis.Scanner.Cli/      `noesis-scan-csharp` tool: arguments, discovery, orchestration, exit codes
  test/Noesis.Scanner.Tests/   golden tests on test/fixtures and broken fixtures
  test/fixtures/               the C# syntax fixture solution (CSharpSyntax.slnx)
```

Pipeline for one solution:

```text
discover ─► open solution (MSBuildWorkspace) ─► order by references ─► per project = one artifact:
   Compilation ─► declaration pass ─► body pass (parallel per syntax tree) ─► external closure ─► write model
write scan manifest
```

### 4.1 Discovery and load

Input is a directory, a `.sln`/`.slnx` or one or more `.csproj`. Without a
solution file the scanner takes every `*.csproj` under the directory except
`bin/`, `obj/`, `node_modules/`. `--projects` and `--exclude-projects` narrow
the set by project-name glob; test projects are not filtered by the scanner,
the server tells them from `dependencies[].package` (`xunit`, `nunit`,
`MSTest`).

Loading uses `Microsoft.CodeAnalysis.Workspaces.MSBuild` with
`MSBuildLocator` picking the installed SDK. `MSBuildWorkspace` runs a
_design-time_ build per project: evaluation plus the reference-resolution
targets, never `CoreCompile`. It yields exact `ParseOptions`,
`CompilationOptions`, the generated files (`GlobalUsings.g.cs`,
`AssemblyInfo.cs`), generator references and every metadata reference path;
`Project.GetCompilationAsync()` then builds the `Compilation` with the
referenced source generators already run, so generated declarations come
out of the same walk, marked `origin: 'generated'`. Analyzers are never run.
`WorkspaceFailed` is subscribed, logged into `diagnostics`, and never aborts.

When `obj/project.assets.json` is missing the scanner runs `dotnet restore`
once for the solution, the only network-touching step; `--no-restore`
disables it and missing packages become stubs. Project references are
compilation references: `B` binds against the live `Compilation` of `A`,
which dependency order guarantees exists first.

A multi-targeted project is scanned for its highest target framework only,
so the same types are not emitted once per framework; `--tfm` picks another.

### 4.2 Declaration pass

A walk of `compilation.Assembly.GlobalNamespace` through `ISymbol`, not
syntax, so partial types, generated code and implicit members
(record `Equals`, enum `value__`) come merged and normalised. Mapping rules
(the full table is the test's checklist):

| C#                                                                                 | Model                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| namespace, block or file-scoped, across files                                      | one `Namespace` per level of the dotted name, ancestors synthesised when undeclared; `CONTAINS` parent → child, namespace → the types it declares at that level                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| class / struct / interface / enum / record / record struct / delegate              | `Type` with `typeKind`; `record` → `class` + `record` modifier, `record struct` → `struct` + `record` modifier; `sealed` → `final`; `ref struct`, `readonly struct`, `file`, primary constructor in the bag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| nested type                                                                        | `Type` with `CONTAINS` from the outer type; id uses `+`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `partial`                                                                          | one node, several `locations`, `csharp.partial: true` in the bag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| type parameters with constraints and variance                                      | `typeParameters` on the owner, `!n`/`!!n` in `TypeRef`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| base class, base interfaces                                                        | `EXTENDS` (class → class, interface → interface), `IMPLEMENTS` (class/struct/record → interface); `object` base omitted; enum underlying type in `underlyingType`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| method, generic method                                                             | `Method`; `signature` with `passing`, `params`, defaults, `[return:]` annotations; `sealed` → `final`, `new` → `hiding`, `extern` → `external`, `unsafe`/`readonly` member → bag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| constructor, static constructor, finalizer, primary constructor                    | `Method` with `methodKind` (`constructor`, `staticInitializer`, `destructor`); primary constructor is a `constructor` whose parameters are flagged in the bag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| operators, conversions, checked operators, compound assignment operators           | `Method` with `methodKind: 'operator'`, CLR name (`op_Addition`, `op_CheckedAddition`, `op_AdditionAssignment`, `op_Implicit`); conversions add `csharp.conversion` to the bag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| property, indexer, event, `field`-backed, partial                                  | `Property` with `accessors`; indexer has `parameters`, event has `add`/`remove`; the compiler-generated backing field is **not** emitted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| field, const, enum member, fixed buffer, `ref` field                               | `Field`; `const` → `constantValue` plus `static` and `readonly`; enum member → `fieldKind: 'enumMember'`; `ref` in `passing`, `ref readonly` adds `csharp.readonlyRef`; `required` in the bag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| classic extension method                                                           | `Method` on the static class with `extensionReceiver` = `this` parameter type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| C# 14 `extension` block members                                                    | Roslyn models an `extension(...)` block as an unspeakable nested _extension type_ (`INamedTypeSymbol.IsExtension`, `ExtensionParameter`) and synthesises static implementation methods on the enclosing static class. The scanner hoists every extension-type member onto the enclosing static class node, ids under that class, `extensionReceiver` = `ExtensionParameter.Type`, `csharp.extensionBlock` in the bag; the extension type itself and the synthesised implementations are never emitted, and every symbol Roslyn hands back for a call (extension member or implementation) is normalised to that one id. Exact Roslyn API names to be verified against the shipped Roslyn version in the first spike. |
| `override`, `sealed override`                                                      | no modifier; `OVERRIDES` to `OverriddenMethod.OriginalDefinition` / `OverriddenProperty.OriginalDefinition`, one hop; for `class D : Base<int>` Roslyn hands back the constructed `Base<int>.M(int)`, the edge targets `Base<T>.M(T)` and the construction is recoverable through the `EXTENDS` chain                                                                                                                                                                                                                                                                                                                                                                                                                |
| interface member implementation, implicit or explicit, inherited from a base class | `IMPLEMENTS_MEMBER` from `FindImplementationForInterfaceMember` over every interface member of every interface in `AllInterfaces`; explicit implementations carry `csharp.explicitInterfaceImplementation` on the member, `name` is the member name alone (`GetValue`), the interface stays in the id and in `IMPLEMENTS_MEMBER.interface`                                                                                                                                                                                                                                                                                                                                                                           |
| static abstract / static virtual interface members                                 | same edges; `static` modifier                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| default interface members                                                          | `Method` on the interface with `bodiless: false` and `virtual`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| accessibility                                                                      | `visibility`; `file` for file-local types                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| attributes on type, member, parameter, return, type parameter, assembly/module     | `annotations` of the element they sit on, `[return:]` in `returnAnnotations`, `[assembly:]`/`[module:]` on the artifact; no edge                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| local functions, lambdas                                                           | not nodes; their bodies attribute to the enclosing member with `viaClosure`. Calls _to_ a local function or lambda, and method groups of them, produce no edge; attributes on lambdas are dropped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| top-level statements                                                               | the generated `Program` type and `<Main>$` method, `origin: 'generated'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| implicitly declared members                                                        | emitted with `origin: 'generated'` when they are callable surface: record members (`Equals`, `GetHashCode`, `Deconstruct`, `PrintMembers`, `<Clone>$`, `EqualityContract`, `op_Equality`), enum `value__`, delegate `Invoke`/`BeginInvoke`/`EndInvoke`, top-level `Program.<Main>$`. **Never** emitted: auto-property and `field`-keyword backing fields, primary-constructor capture fields, closure display classes, state machines, anonymous types, extension skeleton types. Accesses to those are dropped                                                                                                                                                                                                      |

### 4.3 Body pass

For every syntax tree, in parallel, the scanner takes `GetSemanticModel`
and, for every member with a body or initializer, walks its `IOperation`
tree with an `OperationWalker`. Four facts are taken from it; everything
else in the tree is skipped (section 8 lists what comes next):

| Operation                                                                                                | Edge                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IInvocationOperation`                                                                                   | `INVOKES` with `invocationKind: 'call'`, or `'extension'` when `TargetMethod.ReducedFrom` is set; `TargetMethod.OriginalDefinition` as `to` (for a reduced extension call `ReducedFrom.OriginalDefinition`, with the unreduced method's `TypeArguments`, so `"".Ext()` on `Ext<T>(this T)` carries `[string]`); `receiver` from the `Instance` operation |
| `IObjectCreationOperation`, `IAnonymousObjectCreationOperation`                                          | object creation with a constructor: `INVOKES` the constructor (`#.ctor`), `typeArguments` the created type's CLR-flattened arguments, `invocationKind: 'call'`, `receiver: null`, no `USES_TYPE`; when Roslyn binds no constructor, and for anonymous objects, `USES_TYPE` role `creation` with the constructed type (`structural` for anonymous types)  |
| `IPropertyReferenceOperation`, `IFieldReferenceOperation`, `IEventReferenceOperation`, indexer reference | `ACCESSES` with `read`/`write`/`readWrite` from the parent operation (assignment target, compound assignment, `ref` argument); `+=`/`-=` on an event is `readWrite` with `csharp.eventAccessor` in the site bag; an indexer reference is one `ACCESSES` of the indexer `Property`, never an `INVOKES` of its accessor                                    |
| `IArrayCreationOperation`, `ITypeParameterObjectCreationOperation`                                       | `USES_TYPE` role `creation` with the array or type-parameter reference, no `INVOKES`                                                                                                                                                                                                                                                                     |
| `IIsTypeOperation`, `IIsPatternOperation` with type patterns, `IConversionOperation` that is a cast      | `USES_TYPE` with role `typeTest` or `cast`                                                                                                                                                                                                                                                                                                               |
| `IAnonymousFunctionOperation`, `ILocalFunctionOperation`                                                 | descend, with `viaClosure: true` for everything below                                                                                                                                                                                                                                                                                                    |
| `IInvalidOperation`, `IDynamicInvocationOperation`, `IDynamicMemberReferenceOperation`                   | no edge; one `scanner` diagnostic per site with the written name                                                                                                                                                                                                                                                                                         |

Property and field initializers, primary-constructor parameter captures and
`field`-keyword accessor bodies are walked the same way with the owning
`Property`/`Field`/constructor as `from`.

### 4.4 External closure

Every `TypeRef` and edge target that points outside the project's own
assembly and outside the solution is collected and written to `stubs`: the
symbol itself (type, method, property, field), its containing types and its
namespace, each with `artifact` set to the assembly's id. A type stub also
carries `typeKind` and its `EXTENDS` and `IMPLEMENTS` edges, with the base
types and interfaces stubbed in turn up to the platform, so that
`DddAggregateAttribute : DomainObjectAttribute` from an annotation package or
`IOrderRepository : IRepository<Order>` from a NuGet framework is visible;
members of those bases are not stubbed. A NuGet attribute applied to a member
therefore yields an entry in the member's `annotations` whose `type` points
at a stub; a call of a NuGet static factory or extension method yields an
`INVOKES` whose `to` is a stub method id under the stub type.

Symbols of a referenced project of the same solution are never in the
closure: their ids resolve to that project's own model file. The consumer
joins on (artifact, id); nothing about the reference is duplicated.

Types from the platform reached through a type forward are attributed to the
assembly that defines them, not the one that forwards.

### 4.5 Error tolerance

- Project load failure (broken `.csproj`, missing SDK): the project is
  written as an empty model with the error; dependents bind against nothing
  and get `unresolved` references.
- Missing references: Roslyn binds what it can; unbound types become
  `TypeRef.unresolved`, unbound calls become diagnostics.
- Syntax errors: Roslyn's recovery keeps every declaration it can read;
  members whose syntax `ContainsDiagnostics` are still emitted and their
  locations carry the compiler diagnostics.
- Duplicate declarations, conflicting aliases: emitted as bound, with the
  compiler's diagnostic attached. No refusal.
- Exit code 0 whenever at least one project produced a model; 2 when none
  could be loaded; 1 for invalid arguments.

### 4.6 Command line

```text
noesis-scan-csharp <path>                     directory, solution or project(s)
  --out <dir>                                 output root (default `<repository-root>/.noesis/sessions/scanner`)
  --repository-root <dir>                     directory file paths are relative to (default: current directory)
  --repository <name> --revision <commit>     written into the manifest, supplied by the server
  --configuration Debug|Release               MSBuild configuration (default Debug)
  --projects <glob,...>                       only these projects (by project name)
  --exclude-projects <glob,...>               skip these projects
  --tfm <moniker>                             target framework for multi-targeted projects (default: highest)
  --no-restore                                never run dotnet restore
  --verbosity quiet|normal|detailed
```

## 5. Performance expectations

The scanner must stay well under a `dotnet build` of the same solution.
Nothing is cached in this iteration: every scan evaluates every project,
builds every `Compilation` and walks every body. What keeps that fast is no
`Emit`, no analyzers, `IOperation` walked once per member, and parallelism
at tree level inside a project. The first measurement on the fixture solution
and on one real solution decides which of the caches in section 8 is built
next.

## 6. Testing

- **Golden model**: `scanners/dotnet/test/fixtures` scanned to a
  checked-in `code-model.json` per artifact, plus the manifest. Every syntax
  case in the fixtures must appear as the expected node or edge; the diff on
  a change is the review. The three `CSharpSyntax/TypeUsage` files place a
  type from the own project, from the referenced project and from NuGet in
  the same positions under the same member names, so the test asserts that
  the three models differ only in the ids the `TypeRef`s point at and in
  which of those ids are declared or stubbed.
- **Schema**: the C# model types round-trip through the TypeScript zod
  schema in `server/backend`, so a field added on one side fails the other.
  The golden files are also checked against the generated JSON Schema in
  `scanners/code-model/`, and that the committed schema is the one the zod
  source generates.
- **Broken fixtures**: a `csharp-broken` fixture set with a missing
  reference and a syntax error in one file. Asserts: models still written,
  diagnostics present, exit code 0.

## 7. Coverage audit against `scanners/dotnet/test/fixtures`

Every construct in the fixture solution maps onto sections 3 and 4,
including the `TypeUsage` fixtures that put own, project-reference and NuGet
(`NodaTime`, `JetBrains.Annotations`) types in every position a type can occupy.
Constructs whose facts are deferred (section 8) are in the fixtures already
and simply yield no edge yet. Rules that the general tables do not spell out:

| Fixture construct                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Rule                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[field: NonSerialized]` on a property or event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | the attribute sits on the synthesised backing field in Roslyn, which is not emitted; the attribute type ids go to `csharp.backingFieldAnnotations` on the property, arguments dropped                                                                                                     |
| `[Obsolete]` on an accessor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | dropped in this iteration (section 8)                                                                                                                                                                                                                                                     |
| positional record parameters                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | the synthesised property is emitted as `origin: 'declared'` with the parameter's location and `csharp.positional: true`; `[property:]` attributes land on it                                                                                                                              |
| explicit interface implementations of the same generic interface twice (`IGenericInterface<int>.GetValue`, `IGenericInterface<string>.GetValue`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | the method id carries the constructed interface in the scanner's canonical form, so the two ids differ; `IMPLEMENTS_MEMBER.interface` carries the instantiation                                                                                                                           |
| interface satisfied by a base-class member                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `IMPLEMENTS_MEMBER.from` is the base-class member, `declaredOn` the derived type                                                                                                                                                                                                          |
| `fixed byte Buffer[16]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `Field` with element type, `csharp.fixedSize: 16`                                                                                                                                                                                                                                         |
| `nint`/`nuint`, `int`, `string`, `object`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `primitive` with the keyword; `System.IntPtr` or `System.Int32` written out is the same `primitive`                                                                                                                                                                                       |
| `delegate* unmanaged[Cdecl]<int, void>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | function reference with `callingConvention: 'unmanaged[Cdecl]'`                                                                                                                                                                                                                           |
| a namespace declared in both projects (`CSharpSyntax.SharedNamespace`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | one `N:CSharpSyntax.SharedNamespace` node in each artifact file, each with its own `locations` and `CONTAINS`; the server merges them                                                                                                                                                     |
| a lambda returning an anonymous object passed as an argument (`Select(x => new { x.A })`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `INVOKES` of `Select` from the enclosing member; inside the lambda a `viaClosure` creation `USES_TYPE` with a `structural` reference                                                                                                                                                      |
| `GenericClassWithOneParameter<int>.NestedClassSharingOuterParameter`, `NestedGenericClass<TInner>` inside `GenericClassWithOneParameter<T>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | flattened `typeArguments` `[int]` on the field's `TypeRef`; `TInner` has `ordinal: 1` and is `!1` in ids, `T` is `!0`                                                                                                                                                                     |
| `new { A = 1 }` and `anon.A`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | creation yields `USES_TYPE` with a `structural` reference; member access on an anonymous type yields no `ACCESSES`                                                                                                                                                                        |
| `new T()` on a type parameter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `USES_TYPE` role `creation` with a `typeParameter` reference, no `INVOKES`                                                                                                                                                                                                                |
| `T.StaticAbstractFactory()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `INVOKES` to the interface member definition with `receiver: 'typeParameter'`                                                                                                                                                                                                             |
| `: base(...)`, `: this(...)`, primary-constructor base call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `INVOKES` with `invocationKind: 'call'` and `receiver: 'base'` / `'this'`; an implicit parameterless `base()` has no operation and produces no edge                                                                                                                                       |
| `partial void M();` without implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | emitted `bodiless: true`; the compiler removes call sites, so none appear                                                                                                                                                                                                                 |
| `event += handler`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `ACCESSES` with `readWrite` and `csharp.eventAccessor: 'add'` in the site bag; `-=` the same with `'remove'`                                                                                                                                                                              |
| LINQ query syntax                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Roslyn's `ITranslatedQueryOperation` exposes the `Select`/`Where`/`Join`/`GroupBy`/`OrderByDescending` calls, emitted as extension `INVOKES`                                                                                                                                              |
| top-level statements with a static local function                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `Program.<Main>$` is emitted as `generated`; the local function is not                                                                                                                                                                                                                    |
| `TypeUsage/OwnProjectTypeUsage`, `OtherProjectTypeUsage`, `NuGetPackageTypeUsage`: a custom type as field, static/readonly/const field, nullable struct, array, generic argument, tuple element, event, auto/init/required/static/ref property, indexer parameter and return, constructor and primary-constructor parameter, return (sync, `Task<T>`, iterator, `ref`), parameter (value, `ref`, `out`, `in`, `ref readonly`, `params` array and span, optional, nullable), delegate signature, record positional parameter, struct member, interface member, operator operand, conversion source and target, extension receiver | every signature position is a `TypeRef` on the node, built the same way whatever the origin; the three fixtures yield the same node shapes with `T:CSharpSyntax.Types.PublicClass`, `T:CSharpSyntax.OtherProject.PublicClassFromOtherProject` and `T:NodaTime.Instant` as the `named` ids |
| `const EnumFromOtherProject ConstEnumField = ...`, `const IsoDayOfWeek ...`, optional parameter defaulting to an other-project enum member or constant                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `constantValue` / `defaultValue` is the source text of the constant expression; the enum type is the field or parameter `TypeRef`, no `ACCESSES` edge for the enum member read in an initializer because it is a constant                                                                 |
| constraint `where T : PublicClassFromOtherProject`, `where T : IClock`, `where T : IPattern<LocalDate>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `TypeParameterConstraint` kind `type` with the foreign id; a NuGet constraint type is a stub                                                                                                                                                                                              |
| `[AttributeFromOtherProject(typeof(PublicClassFromOtherProject), NamedEnumArgument = ...)]`, `[BaseTypeRequired(typeof(IClock))]`, `[UsedImplicitly]`, `[ValueRange(1, 7)]`, `[Pure]`                                                                                                                                                                                                                                                                                                                                                                                                                                            | an entry in the node's `annotations` whose `type` is a project-reference id or a NuGet stub; `typeof` arguments as `AnnotationValue` kind `type`, enum arguments as kind `enum`                                                                                                           |
| `OtherProjectAlias::CSharpSyntax.OtherProject.PublicClassFromOtherProject`, `global::NodaTime.Offset`, `InternalClassVisibleViaInternalsVisibleTo` as member types                                                                                                                                                                                                                                                                                                                                                                                                                                                               | identical `TypeRef`s to the unqualified spellings; the extern alias and `InternalsVisibleTo` leave no trace beyond the artifact's `annotations`                                                                                                                                           |
| `: DateTimeZone("Fixture", true, Offset.Zero, Offset.Zero)`, `: RecordFromOtherProject(1)`, `: List<PublicClassFromOtherProject>`, `IGenericInterfaceFromOtherProject<StructFromOtherProject>`                                                                                                                                                                                                                                                                                                                                                                                                                                   | `EXTENDS` / `IMPLEMENTS` with a `TypeRef` whose `type` is foreign and whose `typeArguments` may be own types; the base-constructor call is an `INVOKES` to a stub or project-reference constructor id with `receiver: 'base'`                                                             |
| `IClock.GetCurrentInstant()`, `IPattern<LocalDate>.Parse`, `DateTimeZone.GetZoneInterval` implemented in the fixture                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `IMPLEMENTS_MEMBER` / `OVERRIDES` whose `to` is a stub member id of the NuGet type; `interface` carries `IPattern<LocalDate>` with the NuGet type argument                                                                                                                                |
| `Instant.FromUtc(...)`, `LocalDatePattern.Iso.Parse(...)`, `ProviderField["Europe/Warsaw"]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `INVOKES` with `receiver` `type` / `property` and `ACCESSES` of the indexer, all to stub ids under `A:NodaTime@3.3.2.0`                                                                                                                                                                   |
| `catch (ExceptionFromOtherProject)`, `is Instant`, `(PublicClassFromOtherProject)boxed`, `new Instant[1]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `USES_TYPE` with `typeTest`, `cast` or `creation` and a foreign `TypeRef`; body-level use of a foreign type is no different from body-level use of an own type; the `catch` type yields nothing yet                                                                                       |

Not represented, by design: attributes on lambdas, `scoped` on locals, and
`using` directives themselves, which Roslyn consumes during binding and which
leave no trace beyond the resolved ids.

## 8. Deferred to later iterations

Each item below was designed, then cut from the first iteration to keep the
model small and the scanner measurable. The text here is the decision to
start from when the item is picked up; schema additions are additive to
`schemaVersion: 1` unless marked otherwise.

### 8.1 Body-level facts

Order of value for the DDD projection: implicit calls first, then
`REFERENCES_METHOD`, then arguments.

| Fact                   | Design                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| implicit calls         | `invocationKind: 'implicit'` on `INVOKES` for calls the source never spells out: `IForEachLoopOperation` (`GetEnumerator`, `MoveNext`, `Current`, `Dispose` from `ForEachStatementInfo`), `IUsingOperation` (`Dispose`/`DisposeAsync`), `IAwaitOperation` (`GetAwaiter`, `GetResult`), `IDeconstructionAssignmentOperation` (`Deconstruct`), object and collection initializers (`Add`), collection expressions with `[CollectionBuilder]` (builder `Create`), `with` (`<Clone>$`), conversion operators (`IConversionOperation` with `OperatorMethod`; `csharp.conversion` on the target says implicit or explicit). Java `iterator()`/`close()`/autoboxing, TS iterator protocol, PHP magic methods map the same way |
| operator calls         | `invocationKind: 'operator'` for `IBinaryOperation`, `IUnaryOperation`, `IIncrementOrDecrementOperation`, `ICompoundAssignmentOperation` with `OperatorMethod`; `T.op_Addition` on `T : INumber<T>` has `receiver: 'typeParameter'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| delegate calls         | `invocationKind: 'delegate'` when the invocation `Target` is a delegate value; `to` is the delegate type's `Invoke`; TS function-typed values have no `Invoke`, so `to` becomes optional there (breaking)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `REFERENCES_METHOD`    | edge Method/Property/Field → Method for a method group taken as a value (`IMethodReferenceOperation`, `IDelegateCreationOperation`, `&Method`): `to` the definition, `typeArguments` (unreduced for extension groups), `site`, `receiverType`. Event handler registration `E += Handler` yields it beside the `ACCESSES`                                                                                                                                                                                                                                                                                                                                                                                               |
| `receiverType`         | constructed containing type at the site on `INVOKES` and `ACCESSES`, e.g. `List<Order>` for `List<Order>.Add`; null for free functions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| arguments              | `INVOKES.arguments: { parameter: number; source: ExpressionKind }[]`, by ordinal of the target's parameter, several entries for one `params` parameter. Lets the projection say "passes the aggregate held in a field to the repository". `ExpressionKind` is already named for this                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| more `USES_TYPE` roles | `typeLiteral` (`ITypeOfOperation`; Java `X.class`, PHP `X::class`), `localVariable` (`IVariableDeclaratorOperation`, also `foreach (T x …)`, `using T x`, `out T x`; a pattern variable is not also a local), `closureParameter` (explicitly typed lambda and local-function parameters), `catch` (`ICatchClauseOperation`; TS catch is untyped), `other` (`default(T)`, `sizeof(T)`, `stackalloc T[]`, local-function return types, TS `satisfies`). `typeof(Dictionary<,>)` is `typeLiteral` with `unbound: true`; `nameof` produces nothing. The fixture's `AllLocalVariableForms` yields a few hundred `localVariable` edges, accepted                                                                             |
| site bag               | `csharp.dynamic` on sites bound through `dynamic`, once candidate edges exist                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### 8.2 Candidate edges

Error-tolerance channel for sites the compiler could not bind: `UsageSite`
gains `confidence: 'bound' | 'candidate'` and `text` (the written callee or
member name). `IInvalidOperation` yields an `INVOKES` with `confidence:
'candidate'` to the first `CandidateSymbols` of `GetSymbolInfo`, else to a
stub built from the text; `IDynamicInvocationOperation` and
`IDynamicMemberReferenceOperation` yield candidate `INVOKES`/`ACCESSES` to
stubs named from the source text. Consumers that need certainty filter on
`bound`. Deferred because a guessed edge is worse than a diagnostic until a
consumer asks for it.

### 8.3 Accessor detail

`PropertyNode.accessors` becomes a list of objects (breaking): `{ kind,
visibility, bodiless, annotations, languageSpecific }`, with per-accessor
visibility (`private set`), `bodiless` for auto-implemented or abstract
accessors, `[Obsolete]` on a getter in `annotations`, and
`csharp.readonlyMember` for `readonly get` in a struct in the bag.

### 8.4 Library and platform models

Full declaration models of external assemblies, for consumers that need
members of external types (a projection that follows `List<T>.Add`, an AI
view of a framework type). Design: `--libraries <glob|package,...>`
(default the platform and the Noesis annotation package; never `Microsoft.*`
wholesale, since ASP.NET Core and EF are the largest assemblies in any
solution) selects assemblies whose section 4.2 walk, applied to
`IAssemblySymbol` without the body pass, is written once per assembly
version to `.noesis/cache/scanner/libraries/<name>@<version>.code-model.json`
(a persistent cache, never under a session directory, and added to
`.noesis/.gitignore`) and reused by later scans; the manifest gains
`externals: { id, file }[]`;
`ArtifactNode` files then exist for `library` and `platform` kinds; types
reached through a type forward are written under the defining assembly. A
first-party package built from another repository of the same system is
listed in `--libraries` too, and its `dependencies[].package` id and version
let the server join it with that repository's source artifact.
`System.Private.CoreLib` alone is tens of thousands of members; keep it
whole and let `--libraries` narrow.

### 8.5 Reusing a previous `dotnet build`

Three artifacts worth reusing, in decreasing value: (1) restore output,
already used in section 4.1; (2) the design-time evaluation, cached by the
scanner as `.noesis/cache/scanner/dotnet/<project>/<hash>.project.json`,
hash over the project file, imported `Directory.Build.*`, `global.json`,
`project.assets.json` and the SDK version, so a hit constructs the
`Compilation` with no MSBuild at all; (3) reference assemblies of project
references in place of live compilations: the scanner's own cached
metadata-only emit (`EmitOptions(metadataOnly: true, includePrivateMembers:
true)`, tens of milliseconds) when the referenced project's source hash is
unchanged, else the build's `obj/<cfg>/<tfm>/ref/A.dll` when it is newer
than every compile input (sources, generated files,
`A.csproj.CoreCompileInputs.cache`), which is MSBuild's own up-to-date rule
re-applied, else the live `Compilation`. Nothing is ever read from `bin/`:
implementation assemblies can differ from the `ref/` assembly, and `ref/` is
what `csc` itself binds against. Needs an **id stability** test: the same
declaration reached as a source symbol, as a metadata symbol from a cached
`ref.dll` and through the build's `ref/` assembly yields one id and one
`record` modifier (metadata record detection rests on `<Clone>$`), covering
`file`-local types, `<Main>$` and explicit implementations.

### 8.6 Incremental scanning

Per project, `.noesis/cache/scanner/dotnet/<project>/` holds the evaluated
project, the metadata-only `ref.dll` and the last model file, keyed by a
hash over the evaluation hash, every source and generated file, the MVID of
every metadata reference and the hashes of referenced projects. An unchanged
project costs one hash computation; its model is copied to the output and
its `ref.dll` feeds dependents. A change in a leaf project rescans that
project only; a change in a shared project rescans it and everything above
it, because bindings can change. The cache is safe to delete at any time;
it lives outside `.noesis/sessions/` so the session sweep keeps it, and
`.noesis/cache/` must be added to `.noesis/.gitignore`.
CLI: `--no-cache`, `--cache-dir <dir>`. Tests: scan, rescan, assert zero
compilations; edit, rescan, assert exactly the dependent set recompiled;
and an artifact-reuse test that asserts, from a `--verbosity detailed` log,
which reference path each project took. Expected profile once built:

| Step                  | Cold scan                                      | Rescan, nothing changed | Rescan, one leaf project changed |
| --------------------- | ---------------------------------------------- | ----------------------- | -------------------------------- |
| Restore               | skipped when `obj/project.assets.json` present | skipped                 | skipped                          |
| Project evaluation    | design-time build per project                  | cache hit               | cache hit                        |
| Compilation + binding | full, per project; references as `ref.dll`     | none                    | one project                      |
| Body pass             | parallel per tree                              | none                    | one project                      |
| Writing               | all projects                                   | copy from cache         | one project                      |

### 8.7 Smaller items

- **All target frameworks**: `--all-tfms` scans every framework of a
  multi-targeted project as its own artifact, ids suffixed `@<target>`
  (`A:Sales.Domain@net8.0`).
- **Fallback compilation** when a project fails to load: a `Compilation`
  built from `obj/project.assets.json` plus the directory's `*.cs` with
  default options, with a diagnostic recording the fallback.
- **Source generators without the workspace**: running `GeneratorDriver`
  directly, needed only once compilations are built from the cache of 8.5
  instead of from `MSBuildWorkspace`; `--no-generators` to skip them.
- **Broken fixtures, full set**: duplicate type, unknown attribute, broken
  project file, in addition to the two of section 6.
- **Origin split**: `'synthesised'` for compiler-implicit members versus
  `'generated'` for generator output, when a consumer needs to tell them
  apart without looking at `locations`.
