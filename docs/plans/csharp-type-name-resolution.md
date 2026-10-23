# Design: C# type name resolution without a compiler

> **Status: superseded.** The scanner uses Roslyn, see
> [`code-model-and-roslyn-csharp-scanner.md`](code-model-and-roslyn-csharp-scanner.md).
> This document remains the inventory of everything that influences type
> resolution in C# and the design of the Roslyn-based test oracle.

The next C# scanner has to know which type a name in the source refers to:
`Order` in `Order Create()` may be `Sales.Order`, `Sales.Legacy.Order`, a
nested `Service.Order`, a type parameter, or the alias
`using Order = Shipping.Parcel;`. Today the scanner reads text and keeps the
short name, so two building blocks with the same name collide and relations
cannot be derived. This document designs `resolveTypeName`, a pure
TypeScript function that maps a type name at a source position to a unique,
canonical identity, following the C# language specification's rules for
namespace and type names. No Roslyn, no `dotnet` at scan time.

Two claims are kept apart on purpose:

- **Resolution** (this function) is exact: given a complete picture of a
  compilation, it returns what the C# compiler would bind to, or a typed
  "cannot tell" result. It never guesses.
- **The picture of the compilation** (project model, referenced assemblies)
  is built by separate modules with stated limits. Where the picture is
  incomplete, the function says so in the result instead of degrading
  silently. "100% accurate" is a property of the function over its inputs
  and is verified by differential tests against Roslyn (section 8).

## 1. Decisions

| Topic                 | Decision                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope of names        | Names in **type positions** (`namespace-or-type-name` in the spec): declarations, base lists, member and parameter types, generic arguments, casts of known types, `new T`, `typeof`, `is T`, `catch`, `using` targets, attributes. Names in expression position (`Console.WriteLine`, `Color Color`) need member and local lookup first; section 7 gives the hook, not the implementation. |
| Unit of work          | One **compilation** = one project × one target framework × one configuration. Multi-targeted projects yield several compilations; results may legitimately differ between them.                                                                                                                                                                                                             |
| Purity                | `resolveTypeName(compilation, site, syntax)` is a pure function of immutable inputs. Same inputs, same output, on every platform.                                                                                                                                                                                                                                                           |
| Failure               | Resolution outcomes (`unresolved`, `ambiguous`, `error`) are **values**, not exceptions. Exceptions only for programmer errors (malformed inputs).                                                                                                                                                                                                                                          |
| Identity              | A structured `TypeIdentity` plus a canonical string in CLR metadata style (``System.Collections.Generic.List`1``, nested `Outer+Inner`). The string is the stable key for graphs and tests.                                                                                                                                                                                                 |
| Referenced assemblies | Supplied as **assembly catalogs** (namespaces, types, arity, accessibility, nesting, base types, type forwards, `InternalsVisibleTo`). Produced by a separate ECMA-335 metadata reader in TypeScript or by a pre-generated JSON per framework. The resolver does not read files.                                                                                                            |
| Project model         | Supplied as a `CompilationModel`. Preferred source: `obj/project.assets.json` and the generated `obj/**/*.GlobalUsings.g.cs`, `*.AssemblyInfo.cs` when present (restore output, exact). Fallback: a documented csproj evaluator with listed limits.                                                                                                                                         |
| Preprocessor          | Source is parsed with the compilation's `DefineConstants`; inactive `#if` regions contribute no declarations and no usings. This is the parser's job; the resolver sees only active syntax.                                                                                                                                                                                                 |
| Stability             | `ResolutionApi.version = 1`. Additive changes keep the version; a breaking change bumps it and the old `resolve` stays callable for one release. All unions are closed and have a `kind` discriminator.                                                                                                                                                                                     |
| Oracle                | The `../../scanners/dotnet/test/fixtures` solution plus a Roslyn harness that dumps every type reference's bound symbol to a golden file. The TypeScript implementation must reproduce the golden file byte for byte.                                                                                                                                                                       |

## 2. What affects type resolution in C#

Every factor below is an explicit input of the function or of the compilation
model it reads. Nothing is read from the environment.

**Lexical position of the name**

- Enclosing type declarations, innermost first, each with its type parameters
  and member types, including member types inherited from base classes.
- Enclosing generic method (or local function) type parameters.
- Enclosing namespace declarations, innermost first. Each namespace
  _declaration body_ (not the namespace) carries its own `using` directives,
  `using static`, `using` aliases and `extern alias` directives. Block-scoped
  and file-scoped namespaces behave the same way.
- The compilation unit, carrying its own directives plus every `global using`
  of the compilation, including those the SDK generates from
  `<ImplicitUsings>` and `<Using>` items.
- Whether the name sits inside a `using` directive of a body (then that body's
  own directives are invisible), inside a base-type list (then the type's
  inherited member types are invisible), or in attribute position (then the
  `Attribute` suffix rule applies).
- Which file the name is in: `file`-local types are visible only there.

**The compilation**

- Every type declared in the project's active source, merged across
  `partial` parts, with arity, accessibility, nesting and base types.
- Every type exported by referenced assemblies that are mapped to the
  `global` alias, including type forwards; types of assemblies referenced
  only under an `extern alias` are reachable through that alias alone.
- `InternalsVisibleTo` grants that make another assembly's `internal` types
  accessible, and the assembly name of the compilation.
- `LangVersion`, which decides which identifiers are keywords (`nint` since
  9, `file` modifier since 11) and which syntax exists.
- Nullable context (`<Nullable>`, `#nullable`): does not change which type is
  found, only the annotation on the result.

**The name itself**

- Simple vs. qualified vs. alias-qualified (`A::B`, `global::B`).
- Generic arity: `List` with one argument and with two are different lookups.
- Predefined keywords (`int`, `string`, `object`, `void`, `nint`, `dynamic`)
  and contextual ones (`var`, `dynamic`, `nint`, `nuint`, `field`) that
  become keywords only when no type of that name is in scope.
- Constructors around the name: `T?`, `T[]`, `T[,]`, `T*`, `(A, B)`,
  `delegate*<...>`, `ref`/`scoped` modifiers, which wrap the identity but do
  not change lookup.

## 3. API

Types live in one module, `type-resolution/api.ts`. Everything is a plain,
immutable, JSON-serialisable value, so compilations can be cached and
results compared in tests.

### 3.1 The function

```ts
export const RESOLUTION_API_VERSION = 1 as const;

/** Binds a type name as written at a source position to its identity. Pure. */
export function resolveTypeName(
  compilation: Compilation,
  site: ResolutionSite,
  syntax: TypeSyntax,
): TypeResolution;
```

`Compilation` is built once per project/TFM with `createCompilation` (section
3.5) and reused for every site in it. The call is cheap: index lookups along
the lexical chain, no file access.

### 3.2 Site: where the name is written

```ts
export interface ResolutionSite {
  /** Path relative to the compilation root; the compilation unit. */
  readonly file: FileId;
  /**
   * Lexical chain from the compilation unit inward. The parser produces it
   * from the declaration nesting at the name's offset.
   */
  readonly scope: LexicalScope;
  /** Grammar position of the name. Changes which rules apply. */
  readonly context: NameContext;
}

export type LexicalScope =
  | { readonly kind: 'compilationUnit' }
  | {
      readonly kind: 'namespaceDeclaration';
      readonly parent: LexicalScope;
      /** Dotted name as declared, e.g. `A.B.C` for `namespace A.B.C`. */
      readonly declaredName: string;
      /** The body's own directives, in source order. */
      readonly directives: readonly UsingDirective[];
    }
  | {
      readonly kind: 'typeDeclaration';
      readonly parent: LexicalScope;
      /** Identity of the type being declared (declared, not constructed). */
      readonly type: TypeDefinitionId;
    }
  | {
      readonly kind: 'method';
      readonly parent: LexicalScope;
      /** Type parameters of the enclosing method or local function. */
      readonly typeParameters: readonly string[];
    };

export type NameContext =
  | { readonly kind: 'typeReference' }
  | { readonly kind: 'attribute' }
  | {
      /** Inside the base list of `type`: its inherited member types are not in scope. */
      readonly kind: 'baseTypeList';
      readonly type: TypeDefinitionId;
    }
  | {
      /** Inside a using directive of the innermost scope: that scope's directives are invisible. */
      readonly kind: 'usingDirective';
    }
  | {
      /** `nameof(List<>)` and `typeof(Dictionary<,>)`: open generic allowed. */
      readonly kind: 'unboundGeneric';
    };
```

`UsingDirective` is the parsed directive, with `global`, `static`, `unsafe`,
alias name and target syntax. Directives are stored unresolved; the resolver
resolves targets lazily with the `usingDirective` context and memoises per
scope. This is what makes "a using cannot see sibling usings" fall out of the
same rules instead of a special case.

### 3.3 Syntax: the name as written

A parser-independent description of a type expression. Tree-sitter, a
hand-written parser or test code can all produce it.

```ts
export type TypeSyntax =
  | { readonly kind: 'predefined'; readonly keyword: PredefinedKeyword }
  | { readonly kind: 'name'; readonly name: NameSyntax }
  | { readonly kind: 'nullable'; readonly inner: TypeSyntax }
  | {
      readonly kind: 'array';
      readonly element: TypeSyntax;
      readonly ranks: readonly number[];
    }
  | { readonly kind: 'pointer'; readonly pointee: TypeSyntax }
  | {
      readonly kind: 'tuple';
      readonly elements: readonly {
        readonly type: TypeSyntax;
        readonly name: string | null;
      }[];
    }
  | {
      readonly kind: 'functionPointer';
      readonly parameters: readonly TypeSyntax[];
      readonly returnType: TypeSyntax;
    }
  | {
      readonly kind: 'ref';
      readonly inner: TypeSyntax;
      readonly readonly: boolean;
    }
  | { readonly kind: 'omittedTypeArgument' };

export type PredefinedKeyword =
  | 'bool'
  | 'byte'
  | 'sbyte'
  | 'char'
  | 'decimal'
  | 'double'
  | 'float'
  | 'int'
  | 'uint'
  | 'long'
  | 'ulong'
  | 'short'
  | 'ushort'
  | 'object'
  | 'string'
  | 'void'
  | 'nint'
  | 'nuint'
  | 'dynamic';

export type NameSyntax =
  | {
      readonly kind: 'simple';
      /** Identifier text with any `@` prefix removed; `verbatim` records that it was there. */
      readonly identifier: string;
      readonly verbatim: boolean;
      readonly typeArguments: readonly TypeSyntax[];
    }
  | {
      readonly kind: 'qualified';
      readonly left: NameSyntax;
      readonly right: NameSyntax & { readonly kind: 'simple' };
    }
  | {
      /** `alias::Name`; `alias` is `global` or an extern/using alias. */
      readonly kind: 'aliasQualified';
      readonly alias: string;
      readonly name: NameSyntax & { readonly kind: 'simple' };
    };
```

Keyword handling is in the parser's hands only for the reserved keywords.
`var`, `dynamic`, `nint`, `nuint` and `field` arrive as `name` and the
resolver decides: a type in scope wins, otherwise the keyword meaning
(`var` → `inferred`, `dynamic` → `System.Object` with `dynamic: true`).

### 3.4 Result

```ts
export type TypeResolution =
  | {
      readonly kind: 'type';
      readonly type: TypeIdentity;
      readonly trace: ResolutionTrace;
    }
  | {
      readonly kind: 'namespace';
      readonly namespace: string;
      readonly trace: ResolutionTrace;
    }
  | {
      readonly kind: 'typeParameter';
      readonly owner: TypeDefinitionId | MethodScopeId;
      readonly ordinal: number;
      readonly name: string;
      readonly trace: ResolutionTrace;
    }
  | { readonly kind: 'inferred'; readonly trace: ResolutionTrace } // `var`
  | {
      /** The compiler would report an error. */
      readonly kind: 'ambiguous';
      readonly candidates: readonly TypeIdentity[];
      readonly trace: ResolutionTrace;
    }
  | {
      /** Nothing matched, with the reason that matters to the caller. */
      readonly kind: 'unresolved';
      readonly reason:
        | 'notFound' // nothing in scope; would be CS0246 in the compiler
        | 'inaccessible' // found but not accessible from the site
        | 'arityMismatch' // only types with another arity exist
        | 'missingCatalog'; // a referenced assembly has no catalog: answer unknowable
      readonly nearest: readonly TypeIdentity[]; // what was skipped, for diagnostics
      readonly trace: ResolutionTrace;
    };
```

`missingCatalog` is the honesty valve. If a `PackageReference` has no catalog
the global namespace is incomplete, so a `notFound` would be a lie; the
resolver returns `missingCatalog` whenever a lookup reached the global
namespace or an imported namespace that an uncatalogued assembly could
contribute to.

```ts
export type TypeIdentity =
  | {
      readonly kind: 'named';
      readonly definition: TypeDefinitionId;
      /** One entry per type parameter of the definition, outermost first; empty for non-generic. */
      readonly typeArguments: readonly TypeIdentity[];
      readonly nullableAnnotation: boolean; // `string?` under nullable reference types
    }
  | {
      readonly kind: 'array';
      readonly element: TypeIdentity;
      readonly rank: number;
      readonly nullableAnnotation: boolean;
    }
  | { readonly kind: 'pointer'; readonly pointee: TypeIdentity }
  | {
      readonly kind: 'functionPointer';
      readonly parameters: readonly TypeIdentity[];
      readonly returnType: TypeIdentity;
    }
  | {
      readonly kind: 'typeParameter';
      readonly owner: TypeDefinitionId | MethodScopeId;
      readonly ordinal: number;
    }
  | { readonly kind: 'dynamic' }
  | { readonly kind: 'unbound'; readonly definition: TypeDefinitionId }; // `typeof(List<>)`

/** Canonical, assembly-independent key of a type definition. */
export type TypeDefinitionId = string & {
  readonly __brand: 'TypeDefinitionId';
};
```

`TypeDefinitionId` grammar (CLR metadata conventions, one spelling per type):

```
definition   := namespace-part? type-part ( '+' type-part )*
namespace-part := identifier ( '.' identifier )* '.'
type-part    := identifier ( '`' arity )?
```

Examples: ``System.Collections.Generic.List`1``,
``CSharpSyntax.Generics.GenericClassWithOneParameter`1+NestedGenericClass`1``,
`CSharpSyntax.Types.OuterClassWithNestedTypes+PublicNestedClass`.
`file`-local types get a suffix `@<file-id>` so two files' `file class Helper`
stay distinct. Nullable value types are ``System.Nullable`1`` constructed;
tuples are ``System.ValueTuple`N`` constructed (element names do not take
part in identity, matching the runtime). `canonicalString(identity)` serialises
any `TypeIdentity` with the same grammar extended by `[...]` for type
arguments, `[]`, `[,]` for arrays, `*` for pointers, `!n`/`!!n` for type
parameters and a trailing `?` for the nullable annotation.

`ResolutionTrace` lists the lookup steps taken (`typeParameter`, `memberType`,
`namespaceMember`, `alias`, `usingNamespace`, `usingStatic`, `attributeSuffix`,
`keywordFallback`) with the scope each step examined. Tests assert on it;
production code ignores it.

### 3.5 Compilation

```ts
export interface Compilation {
  readonly apiVersion: typeof RESOLUTION_API_VERSION;
  readonly id: CompilationId; // `<project path>|<tfm>|<configuration>`
  readonly assemblyName: string;
  readonly langVersion: LangVersion;
  readonly globalDirectives: readonly UsingDirective[]; // every `global using`, source and generated
  /** Compilation units by file id, with their own directives and the declarations they hold. */
  readonly files: ReadonlyMap<FileId, CompilationUnit>;
  /** Every type declaration of the project, partial parts merged. */
  readonly sourceTypes: ReadonlyMap<TypeDefinitionId, TypeDefinition>;
  /** Referenced assemblies, by the alias they are reachable through. */
  readonly references: readonly AssemblyReference[];
  /** Grants from referenced assemblies naming this assembly. */
  readonly internalsVisibleFrom: ReadonlySet<string>;
}

export interface AssemblyReference {
  readonly assemblyName: string;
  readonly aliases: readonly string[]; // `['global']` by default
  readonly catalog: AssemblyCatalog | null; // null ⇒ `missingCatalog` outcomes
}

export interface AssemblyCatalog {
  readonly assemblyName: string;
  readonly types: ReadonlyMap<TypeDefinitionId, TypeDefinition>;
  readonly forwardedTypes: ReadonlyMap<TypeDefinitionId, string>; // to assembly name
  readonly internalsVisibleTo: readonly string[];
}

export interface TypeDefinition {
  readonly id: TypeDefinitionId;
  readonly name: string;
  readonly arity: number;
  readonly typeParameters: readonly string[];
  readonly namespace: string; // '' for global
  readonly containingType: TypeDefinitionId | null;
  readonly accessibility: Accessibility;
  readonly declaredKind:
    | 'class'
    | 'struct'
    | 'interface'
    | 'enum'
    | 'delegate'
    | 'record'
    | 'recordStruct';
  readonly fileLocal: FileId | null;
  /** Base type as syntax plus the site to resolve it in; resolved lazily, cycles guarded. */
  readonly baseType:
    | { readonly syntax: TypeSyntax; readonly site: ResolutionSite }
    | TypeIdentity
    | null;
  readonly memberTypes: readonly TypeDefinitionId[];
}

export function createCompilation(model: CompilationModel): Compilation;
```

`CompilationModel` is what the project-model module produces: file list with
parsed declarations and directives, define constants already applied,
references with catalogs, assembly name, language version. `createCompilation`
validates it (every `containingType` exists, aliases are unique per body,
arity matches type parameter count) and builds the indexes:

- global namespace tree merging source types and every `global`-aliased
  catalog, keyed by `(namespace, name, arity)`;
- per-alias namespace trees for `extern alias` references;
- per-type member-type index with inherited member types computed lazily
  through base-type resolution.

## 4. Resolution algorithm

This is the specification's §7.8 "Namespace and type names" with the
subsequent rules that touch it, in the order the compiler applies them.
Each numbered step is one `ResolutionTrace` entry.

**Wrapper syntax.** `nullable`, `array`, `pointer`, `tuple`, `functionPointer`
and `ref` resolve their parts recursively and wrap the identities. Type
arguments of a `simple` name are resolved first, in the same site, so that
`List<Order>` reports `Order`'s own outcome before `List`'s.

**Predefined keywords** map directly: `int` → `System.Int32`, `string` →
`System.String`, `object` → `System.Object`, `void` → `System.Void`, `nint` →
`System.IntPtr`, `nuint` → `System.UIntPtr`, `dynamic` → `{ kind: 'dynamic' }`.
The identity lives in whichever catalog declares it (`System.Runtime` for
.NET); if no catalog declares `System.Int32` the outcome is `missingCatalog`.

**Simple name `I` with arity `K`** at a site:

1. If `K = 0` and the innermost `method` scopes (walking outward until the
   first `typeDeclaration`) declare a type parameter `I` → `typeParameter`.
2. For each `typeDeclaration` scope `T`, innermost first:
   1. if `K = 0` and `T` declares a type parameter `I` → `typeParameter`;
   2. if `T` has an accessible member type `I` of arity `K` → that type.
      Member types include those inherited from base classes (not
      interfaces), except under `baseTypeList` context for `T` itself, where
      only `T`'s own member types count. Accessibility is evaluated from the
      site (section 5).
3. For each `namespaceDeclaration` scope and finally the `compilationUnit`,
   innermost first, with `N` the namespace the scope declares (`A.B.C`
   expands to three nested lookups `A.B.C`, `A.B`, `A`, each without its own
   directives except the innermost):
   1. if `K = 0` and `N` has a member namespace `I` → `namespace`;
   2. if `N` has an accessible type `I` of arity `K` (source types merged
      with `global`-aliased catalogs; `file`-local types only from the site's
      own file) → that type;
   3. unless `context.kind = 'usingDirective'` and this is the innermost
      scope: if the scope's directives contain a `using` alias or an `extern
      alias` named `I` and `K = 0` → its target (`type` or `namespace`). An
      alias and a namespace member with the same name is `ambiguous`
      (CS0576);
   4. unless excluded as in 3.3: collect accessible types `I` of arity `K`
      from the namespaces imported by `using N;` directives of the scope
      (direct members only, not sub-namespaces) and from the member types
      declared by the types imported by `using static T;` (not the ones `T`
      inherits). Exactly one → that type; more than one → `ambiguous`
      (CS0104); none → continue outward.
      At the `compilationUnit`, the scope's directives are its own plus all
      `globalDirectives`.
4. If `context.kind = 'attribute'` the whole procedure runs twice, for `I`
   and for `I + 'Attribute'`, unless `verbatim` is set. One hit → that type;
   two different hits → `ambiguous` (CS1614).
5. If nothing matched and `I` is a contextual keyword (`var`, `dynamic`,
   `nint`, `nuint`) allowed by `langVersion` → its keyword meaning.
6. Otherwise `unresolved`. The reason is `missingCatalog` if any step 3.2 or
   3.4 lookup touched a namespace that an uncatalogued reference could
   populate; `inaccessible` if the only matches were skipped by
   accessibility; `arityMismatch` if the only matches had another arity;
   else `notFound`.

**Qualified name `L.I<A…>`**: resolve `L` with the same site. `namespace` →
look up `I` with arity `K` among its member namespaces (only for `K = 0`) and
types, applying the same `file`-local and accessibility filters; `type` →
look up `I` among its member types including inherited ones; anything else →
`unresolved`. When both a namespace and a type named `I` exist in `L`, the
compiler's precedence applies: a source declaration beats an imported one
(warnings CS0435/CS0436/CS0437), two imported ones from different assemblies
are `ambiguous` (CS0433/CS0434). The same precedence applies in step 3.2.

**Alias-qualified `A::I`**: `global` → the global namespace; otherwise the
innermost scope (walking outward) whose directives declare an `extern alias
A` or `using A = …` where the target is a namespace. `using` aliases to
types cannot be used with `::`. Then member lookup as above.

**Generic arguments.** After the definition is found, `typeArguments` is
built from the resolved arguments. In `unboundGeneric` context, all
`omittedTypeArgument` yields `{ kind: 'unbound' }`; a mix of omitted and
present arguments is a programmer error of the parser, thrown.

**Base types.** When step 2.2 needs the inherited member types of `T`, the
resolver resolves `T.baseType` with the stored site and `baseTypeList`
context, memoises the result on the compilation, and refuses cycles (`class
A : B {} class B : A {}` → both get `object` as base for lookup purposes,
matching the compiler's error recovery). Base interfaces never contribute
member types.

**Constructed types from catalogs.** A catalog base type is already a
`TypeIdentity`; a source base type is syntax. Both paths meet in the same
member-type index.

## 5. Accessibility

A found type is skipped when it is not accessible from the site. The rules
are the spec's accessibility domains, reduced to what type lookup needs:

| Declared             | Accessible when                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `public`             | always                                                                                           |
| `internal`           | same assembly, or the declaring assembly's `InternalsVisibleTo` names the compilation's assembly |
| `private`            | the site is lexically inside the declaring type (any depth)                                      |
| `protected`          | the site is inside the declaring type or inside a type derived from it                           |
| `protected internal` | `protected` or `internal`                                                                        |
| `private protected`  | `protected` and same assembly                                                                    |
| `file`               | the site's file is the declaring file                                                            |

Containing types narrow the domain: a `public` type nested in an `internal`
type is `internal` for this purpose. "Derived from" uses the same memoised
base-type resolution as section 4. Skipped matches are reported in
`unresolved.nearest` so a scanner can still show "there is a type of that
name, but you cannot see it".

## 6. Building the compilation model

Out of the resolver's scope, but the resolver's accuracy depends on it, so
the contract is fixed here.

**Source.** Every `Compile` item of the project (default glob `**/*.cs`
minus `bin/`, `obj/`, plus the generated `obj/<cfg>/<tfm>/*.g.cs` and
`*.AssemblyInfo.cs` files) parsed with the compilation's define constants.
The parser must evaluate `#if`/`#elif`/`#else`/`#endif` with those constants
so that disabled declarations and directives never reach the model. Define
constants come from `<DefineConstants>` plus the SDK's implicit set (`DEBUG`,
`TRACE`, `NET`, `NET10_0`, `NET10_0_OR_GREATER`, `NETCOREAPP`, …).

**Project.** Two readers, tried in order:

1. `obj/project.assets.json` (restore output): exact target frameworks,
   package and project reference closure with resolved paths, and the
   `.g.cs` files next to it. Covers every real repository that has been
   restored, and is what the compiler itself consumes.
2. A csproj evaluator for repositories without `obj/`: SDK-style projects,
   `Directory.Build.props/targets`, `Import` of local files, properties with
   `$()` references, simple `Condition="'$(X)' == 'Y'"`, `Compile`
   include/remove, `ProjectReference` (with `Aliases`), `PackageReference`,
   `Using`, `ImplicitUsings`, `LangVersion`, `Nullable`, `DefineConstants`,
   `AssemblyName`, `RootNamespace`, `TargetFramework(s)`. Everything else is
   reported as a model diagnostic and the reference becomes
   `catalog: null`, so affected names resolve to `missingCatalog`, never to a
   wrong type.

**Catalogs.** An `AssemblyCatalog` per referenced assembly, from:

- a bundled JSON per framework reference pack (`Microsoft.NETCore.App.Ref`
  for each supported `net*` TFM), generated once by a .NET tool at build
  time of the scanner and shipped with it;
- an ECMA-335 metadata reader in TypeScript for NuGet packages and project
  outputs (`TypeDef`, `NestedClass`, `ExportedType`, `Assembly`,
  `CustomAttribute` for `InternalsVisibleTo`, `TypeRef`/`TypeSpec` enough to
  read base types). This is the only piece of new, non-trivial parsing and
  it is bounded: no IL, no signatures beyond base types.

Project references resolve to the referenced project's _source_ model, not
its built assembly, so the whole solution scans from source and project
reference aliases behave like assembly aliases.

## 7. Boundaries and later layers

- **Expression names.** `Order.Create()` needs simple-name lookup in
  expression context: locals, parameters, members (including inherited and
  extension), then types and namespaces, with the `Color Color` rule. This
  design reserves `lookupSimpleName(compilation, site, identifier, arity)`
  returning the type/namespace candidates in order; the expression binder
  of the next scanner layer combines it with its member tables.
- **Member and method resolution**, overload resolution, extension member
  lookup: not here. The identity scheme gives them a stable key for types.
- **Generic inference, `var` types, lambdas**: `inferred` is reported; the
  expression layer decides.
- **Semantic errors** the compiler would raise beyond lookup (static class
  as base, constraint violations): not checked.

## 8. Verification: the Roslyn oracle

Accuracy is proven, not argued:

1. A small .NET tool (kept in `../../scanners/dotnet/test/fixtures`, run only in CI and
   by whoever updates the fixtures) opens `../../scanners/dotnet/test/fixtures`
   with Roslyn, walks every `TypeSyntax` node of every file, and writes
   `file:line:column`, the written text, and the bound symbol's canonical
   string (or the error code) to `../../scanners/dotnet/test/fixtures`.
2. The TypeScript test parses the same files, builds the compilation model
   from `obj/project.assets.json`, calls `resolveTypeName` at every recorded
   position and compares `canonicalString(result)` with the golden line.
   Any difference fails the build; the trace of the failing site is printed.
3. The fixture solution is the contract: every syntax it contains is a case
   the resolver must handle. New syntax enters the fixtures first, then the
   oracle, then the resolver.

Beyond the fixtures, the same oracle can run against any repository that
builds, which turns every real C# project into a regression test for free.

## 9. Open questions

| Question                                                  | Proposal                                                                                                                                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the module lives                                    | `server/backend/src/adapters/out/scanners/csharp/type-resolution/` next to the present scanner, as a pure library with no I/O, so it can later move to `scanners/dotnet` unchanged.                         |
| Reference-pack JSON size                                  | One file per TFM, ~2 MB gzipped for `net10.0`; loaded lazily per compilation. Acceptable; revisit if several TFMs ship.                                                                                     |
| Source generators                                         | Their output is in `obj/` only after a build, not after restore. Generated types are therefore invisible unless `obj/` holds them; names bound to generator output resolve to `notFound`. Documented limit. |
| `global using` in multiple files with conflicting aliases | The compiler reports CS1537; the model validation rejects the compilation with the same diagnostic rather than resolving against a broken set.                                                              |
