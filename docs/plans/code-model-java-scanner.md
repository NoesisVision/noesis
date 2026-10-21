# Design: the Java scanner for the common code model

Status: done (October 2026) up to Gradle support and the deferred items of
section 7.

The .NET scanner (`scanners/dotnet`) reads a C# solution with Roslyn and
writes the common code model designed in
[`code-model-and-roslyn-csharp-scanner.md`](code-model-and-roslyn-csharp-scanner.md).
This document is the Java counterpart: how `scanners/java` reads a Maven
build into the same model, with the same ids and the same edges, so the
service projects both through one set of rules
([`code-model-to-system-model.md`](code-model-to-system-model.md)). It pins
down what the model document leaves to the language, and nothing else; the
model document stays the contract.

## 1. Decisions

1. **Two engines, one model.** A _source_ engine on the JDK compiler API
   (`JavacTask`, `com.sun.source.*`, `javax.lang.model`) and a _bytecode_
   engine on ArchUnit's `ClassFileImporter`. The source engine is the
   reference: full symbol resolution, source spans, parameter names, Javadoc,
   and it works on code that does not compile. The bytecode engine exists for
   projects whose sources javac cannot attribute without their annotation
   processors (Lombok), and degrades honestly (section 4). Everything that
   does not depend on the front end lives once: the id grammar, canonical
   strings, modifier and visibility mapping, constant formatting, the stub
   closure, edge ordering, the JSON codec and the writer.
2. **Maven first.** The scanner ships as a Maven plugin (`noesis:scan`),
   which gets a module's source roots, compile classpath and output directory
   from the build it runs in; that is what Roslyn's `MSBuildWorkspace` gives
   the .NET scanner. Gradle comes later with the same engines.
3. **The service gets a second Java scanner.** The regex-based TypeScript
   scanner stays as `scanner: "java"`; the code-model path is
   `scanner: "java-maven"`, an adapter beside `csharp` that runs Maven, reads
   the files and projects them with a Java annotation vocabulary.
4. **`vision.noesis.annotations` is unchanged.** The DDD graph the previous
   scanner derived (`detect/`, `derive/`, `graph.json`) is gone; its rules are
   the projection's now, with the Java annotations as a second vocabulary
   table. The old design is kept in
   [`prior-art/java-scanner-ddd-graph.md`](prior-art/java-scanner-ddd-graph.md).
5. **Ids follow the shared spelling.** Constructors are `#.ctor`, static
   initializers `#.cctor`, nesting is `+` (never `$`), generic arity is
   `` `n `` per nesting level, so a consumer never branches on language.
6. **Artifacts.** A scanned module is `A:<artifactId>` (the name references
   bind to, as the model document says for Maven). A library on the classpath
   is `A:<groupId>:<artifactId>[:<classifier>]@<version>` with its package
   coordinates on the dependency, because the artifactId alone (`core`,
   `api`) is not unique. A JDK module is a platform artifact
   `A:<module>@<release>` (`A:java.base@17`), labelled with the release the
   sources were bound against.
7. **The implicit `super()` call is an edge.** Every constructor without an
   explicit constructor call invokes its superclass constructor; the bytecode
   has the `invokespecial`, so the source engine emits the same `INVOKES`,
   with `receiver: 'base'` and `java.implicitSuperCall: true` on the site. This
   deviates from the C# rule ("no operation, no edge") on purpose: the two
   engines must agree.
8. **No annotation processors.** The source engine runs javac with
   `-proc:none`, as the .NET scanner runs no analyzers. Members a processor
   would generate do not exist; calls to them become `NS1002` diagnostics.
   Such projects use the bytecode engine until a `noesis.processors` switch
   exists.

## 2. How Java maps onto the model

The model document's sections 3.2 to 3.7 define the shapes; this table says
which Java fact fills each field. "javac" is the source engine's input,
"ArchUnit" the bytecode engine's.

### 2.1 Artifact and namespaces

| Model                      | javac / Maven                                                                                                                                                                                                                                       | ArchUnit                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `ArtifactNode.id`, `name`  | `A:<artifactId>`, the Maven artifactId                                                                                                                                                                                                              | same                                             |
| `version`, `rootDirectory` | the module's version; its base directory, repository-relative                                                                                                                                                                                       | same                                             |
| `target`                   | `jdk-<release>`, the release the sources are bound against (`maven.compiler.release`, else `maven.compiler.target`, else the running JVM)                                                                                                           | same                                             |
| `executable`               | a `mainClass` configured on `maven-jar-plugin` or `spring-boot-maven-plugin`; the class is `java.mainClass` in the bag                                                                                                                              | same                                             |
| `dependencies`             | every compile-scope artifact: a reactor sibling is `source` (`A:<artifactId>`, `package: null`), anything else `library` with `package {id, version}`; the platform modules stubs reached are appended, as the .NET scanner appends stub assemblies | same                                             |
| `annotations`              | `[]` (no module-level annotations; `module-info` is deferred)                                                                                                                                                                                       | `[]`                                             |
| `languageSpecific`         | `java.groupId`, `java.packaging`, `java.buildFile` (repository-relative pom), `java.engine` (`source` or `bytecode`), `java.mainClass`                                                                                                              | same                                             |
| `NamespaceNode`            | one per dotted level of every package clause, plus the empty root the artifact contains; `locations` are the spans of each prefix of every `package` clause (`package-info.java` included); `annotations` are the `package-info` annotations        | locations `[]`, annotations from the class files |

### 2.2 Types

| Model            | javac                                                                                                                                                                                                                           | ArchUnit                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| id               | the binary name, `$` → `+`, each level's own arity: `T:com.acme.Outer`1+Inner`1`; anonymous `Outer$1` → `+1`, local `Outer$1Local` → `+1Local`                                                                                  | the same binary name, so ids agree                    |
| `name`           | the simple name; the binary segment (`1`) for an anonymous class                                                                                                                                                                | same                                                  |
| `typeKind`       | class and record → `class`, interface and `@interface` → `interface` (plus `java.isAnnotation`), enum → `enum`                                                                                                                  | same                                                  |
| `visibility`     | `public` → `public`, `protected` → `protectedOrNamespace`, `private` → `private`, none → `namespace`; local and anonymous classes → `private`                                                                                   | same                                                  |
| `modifiers`      | `static`, `abstract` (not on interfaces), `final` (javac's flag, so implicit on enums and records), `record`                                                                                                                    | same                                                  |
| `typeParameters` | own parameters; bounds as `type` constraints (an intersection bound is several); `ordinal` is CLR-flattened: the parameters of the enclosing types an **inner** class belongs to count first, a static nested class starts at 0 | same                                                  |
| `EXTENDS`        | the superclass unless `java.lang.Object` (enum → ``java.lang.Enum`1[self]``, record → `java.lang.Record`); an interface's superinterfaces                                                                                       | same                                                  |
| `IMPLEMENTS`     | the interfaces of a class, enum or record                                                                                                                                                                                       | same                                                  |
| sealed           | `java.permits: string[]` (canonical strings of the permitted types), `java.nonSealed: true`                                                                                                                                     | `java.permits`; `non-sealed` is not in the class file |
| nesting          | `CONTAINS` from the enclosing type for member, local and anonymous classes; local and anonymous add `java.enclosingMethod` (the member's id), `java.isLocal` or `java.isAnonymous`                                              | same, through `InnerClasses` and `EnclosingMethod`    |
| `documentation`  | the Javadoc body as text: inline tags unwrapped, HTML tags dropped, whitespace collapsed; null without a comment                                                                                                                | null                                                  |
| `locations`      | the whole declaration, annotations included                                                                                                                                                                                     | the source file from `SourceFile`, line 0             |
| `origin`         | `declared`; a file under the build directory (`target/generated-sources/`) → `generated`                                                                                                                                        | `declared`                                            |

### 2.3 Methods

| Model               | javac                                                                                                                                                                                                                                                                        | ArchUnit                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| id                  | `M:<type path>#<name>`<arity>(<parameter canonical strings>)`; constructors `#.ctor(...)`, the static initializer `#.cctor()`; a varargs parameter is its array type, so `m(String...)`and`m(String[])` share an id, as they do in Java                                      | same                                                                                          |
| `methodKind`        | `constructor`, `staticInitializer`, else `method` (`finalize()` is an ordinary method)                                                                                                                                                                                       | same                                                                                          |
| `visibility`        | as types; interface members carry javac's implicit `public`                                                                                                                                                                                                                  | the class file's flags                                                                        |
| `modifiers`         | `static`, `abstract`, `final`, `external` (native), and `virtual` for every instance method that is not private, static, final or abstract                                                                                                                                   | same                                                                                          |
| `bodiless`          | abstract or native; a `default` interface method is `bodiless: false`                                                                                                                                                                                                        | same                                                                                          |
| parameters          | name, type, `variadic` on the last parameter of a varargs method; `optional: false`, `defaultValue: null`                                                                                                                                                                    | names only with `-parameters` (else `arg<i>` and one `NS1006`), `variadic` from `ACC_VARARGS` |
| `typeParameters`    | own parameters, `!!n`                                                                                                                                                                                                                                                        | same                                                                                          |
| `OVERRIDES`         | the nearest method up the **superclass** chain that `Elements.overrides` says it overrides; interface methods are `IMPLEMENTS_MEMBER`'s business; `@Override` is never read                                                                                                  | signature match over the superclass chain                                                     |
| `IMPLEMENTS_MEMBER` | for every interface in the transitive supertype closure and every non-static, non-private method of it: the method of the type or its superclasses that overrides it (never a default filling its own slot); `interface` is the constructed interface, `declaredOn` the type | same, with bridge methods telling the generic slot                                            |
| implicit members    | `origin: generated`, `locations: []`: default constructors, enum `values()`/`valueOf`, implicit record constructors, accessors, `equals`/`hashCode`/`toString` (javac reports MANDATED only for some, so a member of a source type without a tree counts)                    | `values()`/`valueOf` by rule; implicit record members are indistinguishable → `declared`      |
| record components   | the accessor method and the private final field carry `java.isRecordComponent: true`                                                                                                                                                                                         | same by name and type                                                                         |
| bag                 | `java.throws: string[]` (canonical strings), `java.synchronized`, `java.strictfp`, `java.defaultValue` on annotation elements                                                                                                                                                | same except `strictfp`                                                                        |
| `.cctor`            | one node per type with static initializer blocks, located at each block                                                                                                                                                                                                      | one node per type with a `<clinit>`, which field initializers also produce                    |

### 2.4 Fields

| Model           | javac                                                                                                                                    | ArchUnit                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| id              | `F:<type path>.<name>`                                                                                                                   | same                          |
| `fieldKind`     | `enumMember` for enum constants, which are `static`, `readonly` and have no `constantValue`                                              | same                          |
| `modifiers`     | `static`, `readonly` (final), `volatile`; `transient` → `java.transient`                                                                 | same                          |
| `constantValue` | the JLS constant variable's value, formatted by `Literals` (`"text"`, `'c'`, `1L`, `2.5f`), never the source text, so both engines agree | the `ConstantValue` attribute |
| properties      | none: a Java bean property is not derived (model document, section 2)                                                                    |                               |

### 2.5 Type references

| Java                                       | `TypeRef`                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| the eight keyword types                    | `primitive` with the keyword; `Integer` is `named T:java.lang.Integer`                                                      |
| `void`                                     | `void`                                                                                                                      |
| a class, interface, enum, record           | `named` with the arguments of the inner-class chain first, then the type's own                                              |
| a raw type `List`                          | `named` with no arguments and `unbound: true` (``List`1<>``)                                                                |
| `T[]`, `int[][]`                           | `array` of rank 1, nested for every dimension: Java arrays are jagged                                                       |
| a type variable                            | `typeParameter` with the declaring type or method as owner and the flattened ordinal; `!n`/`!!n` with no owner inside an id |
| a wildcard `?`, `? extends X`, `? super X` | `other` with that text; a `wildcard` kind is a candidate for a later schema version                                         |
| an intersection in a cast                  | `intersection`                                                                                                              |
| a multi-catch union                        | `union`                                                                                                                     |
| a name javac could not bind                | `unresolved` with the source text                                                                                           |
| `nullable`                                 | always `false`: `@Nullable` is an annotation, not a type                                                                    |

### 2.6 Annotations

The annotation type, and one argument per element value written: named by
the element, `positional` when the source spells no name (javac's parser
rewrites `@A("x")` into `value = "x"`, so the spelling is read off the
source). Defaults are not filled in. Values: constants are `literal` through
`Literals`, `X.class` is `type`, an enum constant is `enum`, arrays and nested
annotations nest. Annotations sit on types, methods, fields, parameters, type
parameters and packages; type-use annotations on return types are not split
out.

### 2.7 Body-level edges

Bodies attribute to a member the way the .NET scanner attributes them: method
and constructor bodies to the member, static initializer blocks to `.cctor`,
field initializers to the field (a compile-time constant is folded and has no
body), instance initializer blocks to every constructor that does not start
with `this(...)`, lambdas to the enclosing member with `viaClosure: true`, and
the members of local and anonymous classes to themselves.

| Site                                    | Edge                                                                                                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x.m()`, `m()`, `T.m()`, `super.m()`    | `INVOKES` to the method declaration, `invocationKind: call`, the receiver classified (section 2.8); `typeArguments` as written, or recovered from the instantiated method type where a type variable binds plainly, else `[]` |
| `new T(...)`, `this(...)`, `super(...)` | `INVOKES` to `#.ctor`; `typeArguments` are the created type's flattened arguments; receiver `null`, `this` or `base`                                                                                                          |
| the implicit `super()`                  | `INVOKES` to the superclass's no-argument constructor (`Enum(String, int)` for an enum), `receiver: base`, `java.implicitSuperCall: true`, located at the constructor's start (decision 7)                                    |
| `new T() { ... }`                       | `INVOKES` to the anonymous class's constructor, which is a generated node of the anonymous type                                                                                                                               |
| a field read or write                   | `ACCESSES` with `read`, `write` (assignment target) or `readWrite` (compound assignment, `++`, `--`); no edge for a read of a compile-time constant, which javac folds; `arr.length` is no member                             |
| `(T) x`                                 | `USES_TYPE cast`                                                                                                                                                                                                              |
| `x instanceof T`, `x instanceof T t`    | `USES_TYPE typeTest`                                                                                                                                                                                                          |
| `new T[n]`, `new T[] {...}`             | `USES_TYPE creation` with the array reference                                                                                                                                                                                 |
| `X.class`, `Foo::bar`                   | nothing (`typeLiteral` and `REFERENCES_METHOD` are deferred, as in the model document's section 8); a method reference's receiver is walked                                                                                   |
| a site javac could not bind             | no edge and one `NS1002` diagnostic with the text                                                                                                                                                                             |

### 2.8 Receivers

`this` and an unqualified instance member → `this`; `super.` → `base`; an
identifier bound to a parameter → `parameter`, to a local, resource, catch or
binding variable → `local`, to a field or enum constant → `field`; a type
name or an unqualified static member → `type`; a call → `returnValue`;
`new` → `creation`; a literal → `literal`; else `other`. Parentheses and
casts are looked through.

### 2.9 Stubs and diagnostics

Every id built for a symbol that no scanned module declares yields a stub:
the symbol, its containing types, its package chain, and for a type its
`EXTENDS`/`IMPLEMENTS` chain with the bases stubbed in turn up to (excluding)
`java.lang.Object`. The stub's `artifact` is the JDK module
(`A:java.base@17`) or the jar the class file came from, mapped to the build's
dependency. Symbols of sibling modules are never stubbed: their ids resolve
to that module's file.

Compiler diagnostics keep javac's codes (`compiler.err.cant.resolve.location`),
English messages and spans. The scanner's own are `NS1001` (a module could
not be scanned; the model is empty), `NS1002` (an unbound site), `NS1003`
(no compiler in this JVM), `NS1004` (an id declared twice), `NS1005` (the
class directory is missing), `NS1006` (parameter names unavailable), `NS1007`
(a class not fully imported).

## 3. The source engine

```
sources under the compile source roots
→ javac: -proc:none --release <release> -implicit:none -classpath <compile classpath minus the module's own classes>
  parse() + analyze()
→ declaration pass: every top-level class of every unit, through javax.lang.model, trees for spans and Javadoc
→ body pass: a TreePathScanner per unit; local and anonymous classes are handed back to the declaration pass
→ external closure: every external element an id was built for → stubs and base chains
→ compiler diagnostics → the model, sorted
```

The module's own `target/classes` is removed from the classpath so sources
bind to sources, never to a stale class. Attributed trees survive errors:
an error type is `unresolved`, an unbound call is a diagnostic, and a javac
crash on one module leaves an empty model with `NS1001` while the scan goes
on. Ids nest (a method id spells its parameter types), so the id cache is
filled get-then-put, never with `computeIfAbsent`.

## 4. The bytecode engine

```
target/classes imported with ArchUnit's ClassFileImporter, the compile classpath on the context class loader
  (ArchUnit resolves referenced classes through it; a class it knows by name only is imported on demand)
→ an ASM pass over the same class files for what ArchUnit does not expose: parameter names, ACC_VARARGS, ConstantValue
→ declarations over the scanned classes (synthetic classes and members, bridges and lambda methods skipped)
→ accesses per code unit: calls, field accesses, instanceof checks, lambda bodies flagged by ArchUnit
→ external closure → the model, sorted
```

What the class file does not hold, and the model therefore lacks or
approximates with this engine (the agreement test's exclusion list,
`AgreementRules`, is the authoritative version):

- Locations are the source file with line 0 for types and fields and the
  first instruction's line for methods; no Javadoc.
- Parameter names only with `-parameters`, else `arg<i>` and one `NS1006`.
- Receivers are `type` for static targets and `other` otherwise; no casts,
  array creations or switch-label enum reads; compiler-inserted calls
  (boxing, iterators, `close()`) are present; `INVOKES.typeArguments` is
  always `[]`; a compound assignment is two accesses.
- `strictfp`, `non-sealed`, `positional` on annotation arguments,
  type-parameter annotations and SOURCE-retention annotations are unknown;
  annotations are ordered by type, not as written.
- Implicit record members and default constructors are `declared`;
  `.cctor` exists whenever a static field has an initializer; field
  initializers attribute to the constructors and `.cctor` they compile into;
  a class declared in a field initializer has no `java.enclosingMethod`.
- An enum constructor's name and ordinal and an inner class constructor's
  outer instance are dropped from ids and signatures; captured locals of a
  local class's constructor are not.
- ArchUnit does not read the type arguments of an inner class's enclosing
  instantiation: `Outer<String>.Inner<Integer>` is ``Inner`1[Integer]``.
- Bytecode binds the JDK classes of the JVM that runs the scan, where the
  source engine binds `--release`; members a later JDK added to a base class
  or interface a scanned type inherits show up only in bytecode.
- An inherited member may be bound to a different declaring type than javac
  chooses.

The agreement test (`EngineAgreementTest`) scans the fixture with both
engines (compiled with `-parameters -g`) and asserts equality after removing
exactly those gaps. Shrinking the list is the roadmap.

## 5. The Maven plugin

`noesis:scan`, bound to `process-classes` so the module and the reactor
siblings it depends on are compiled:

| Property                | Default                                                      | Meaning                                                                           |
| ----------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `noesis.out`            | `${session.executionRootDirectory}/.noesis/sessions/scanner` | the output root; a relative path is taken from the execution root, not the module |
| `noesis.repositoryRoot` | `${session.executionRootDirectory}`                          | paths in the model are relative to it; relative paths as for `noesis.out`         |
| `noesis.repository`     | the root directory's name                                    | `repository.name` in the manifest                                                 |
| `noesis.revision`       | `""`                                                         | `repository.revision`                                                             |
| `noesis.engine`         | `source`                                                     | `source` or `bytecode`                                                            |
| `noesis.release`        | `maven.compiler.release` → `maven.compiler.target` → JVM     | the release the sources are bound against                                         |
| `noesis.skip`           | `false`                                                      | skip this module                                                                  |

Each module writes `code-model/java/<artifactId>.code-model.json` (`~2` on a
name clash) and rewrites the manifest listing every module scanned so far in
reactor order, through state shared in the plugin context of the top-level
project (thread-safe for `-T`), so the manifest is complete after the last
module and partial after a stopped build. The first module to run clears the
previous scan's files. `pom` modules are skipped.

The service invokes the plugin by its full coordinates, so the project's POM
needs no change:

```sh
mvn -B -q -ntp -Dnoesis.out=<sessions/scanner> -Dnoesis.repositoryRoot=<root> -Dnoesis.repository=<name> \
  process-classes vision.noesis:noesis-scanner-maven-plugin:0.1.0-SNAPSHOT:scan
```

The plugin must be in the local repository: `mvn -q install -DskipTests` in
`scanners/java`.

## 5a. The service adapter

`scanner: "java-maven"` in `noesis-config.json` selects
`JavaMavenSourceCodeScanner` (`server/backend/src/adapters/out/scanners/java-maven/`),
which shares its two-stage shape with the C# adapter through
`code-model-scanner.ts`: run the tool into the session directory, read the
manifest and its files with the zod schema, project with the language's
vocabulary. It runs Maven with the invocation of section 5 (the repository's
own `mvnw` when it has one), pins the plugin version it was built with, and
tells someone without Maven or the plugin what to install. The Java
vocabulary is `app/code-model/projection/java.vocabulary.ts`; it needed two
small projection rules the C# one did not: a `behaviour` role may fix the
behaviour type itself (R9.4, for the argument-less handler annotations) and a
record component's private field is a property while its accessor is not a
behaviour (R5.7). The regex-based `java` scanner stays for Gradle builds.

## 6. Testing

- **Golden model**: the two fixture modules under `scanners/java/test-fixtures`
  (`java-syntax`, one file per topic, and `java-syntax-other`, the types it
  reaches across a module boundary) scanned to a checked-in model file per
  module plus the manifest, under `core/src/test/resources/golden/<engine>/`.
  `NOESIS_UPDATE_GOLDEN=1 mvn test` rewrites them. The three
  `typeusage/*TypeUsage` classes use a type from the own module, the other
  module and a library in the same positions, so they differ only in the ids
  referenced and in which of those are declared or stubbed.
- **Schema**: the golden files are validated against the JSON Schema in
  `scanners/code-model/` from Java (`SchemaValidationTest`) and parsed by the
  strict zod schema in `server/backend` (`test/unit/code-model-schema.spec.ts`),
  so a field added on one side fails the other.
- **Facts**: `ModelFactsTest` pins the facts the golden file is too large to
  review by eye: ids of nested and anonymous types, flattened ordinals,
  generated members, visibility and modifiers, constants, constructor chains,
  interface slots, receivers, closures, stubs.
- **Broken fixture**: a syntax error and a missing import still yield a model
  with the declarations, an `unresolved` reference, the compiler's errors and
  an `NS1002`.
- **Agreement**: `EngineAgreementTest` scans the fixture with both engines
  and asserts equality up to the exclusions `AgreementRules` names (section 4).
- **Service**: `test/fixtures/java/shop` is a two-module Maven build with the
  rules of the C# `shop` fixture in Java and its committed `code-model/`;
  `test/unit/java-maven-scanner.spec.ts` runs the adapter over a fake tool that
  copies it and pins the projected model, `test/e2e/java-maven-scanner.e2e.spec.ts`
  installs the plugin and scans the fixture for real, asserting the same
  model as the committed files project to.
- **Plugin**: `maven-plugin/src/it/multi-module` is a two-module reactor
  project (b depends on a, a uses Guava) that `maven-invoker-plugin` builds
  with the exact invocation the service makes (`process-classes` plus the
  goal's full coordinates); a Groovy script asserts the manifest's reactor
  order, b's `source` dependency on a, a's library and platform dependencies,
  the main class, the ids and an invocation across the modules.

## 7. Deferred

Gradle; a `wildcard` type reference kind; `@Nullable` → `nullable`; the
`hiding` modifier; `module-info`; `typeLiteral` (`X.class`) and
`REFERENCES_METHOD`; parameter names without `-parameters`; running
annotation processors (Lombok); library models; a `noesis.processors`
switch.
