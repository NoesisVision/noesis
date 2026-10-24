# Design: the Java parser for the common code model

Status: done (October 2026), the Gradle plugin of section 5b included, up to
the deferred items of section 7.

The .NET parser (`parsers/dotnet`) reads a C# solution with Roslyn and
writes the common code model described in
[`docs/arch/code-model.md`](../arch/code-model.md).
This document is the Java counterpart: how `parsers/java` reads a Maven
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
2. **Maven first.** The parser ships as a Maven plugin (`noesis:parse`),
   which gets a module's source roots, compile classpath and output directory
   from the build it runs in; that is what Roslyn's `MSBuildWorkspace` gives
   the .NET parser. A Gradle plugin (section 5b) wraps the same engines; the
   service runs it through the command line a repository configures (section
   5a).
3. **The service gets a second Java parser.** The regex-based TypeScript
   parser stayed as `scanner: "java"` (since removed). A repository now
   declares the Noesis Maven or Gradle plugin in its build and runs it
   through `parser: "java"`; the service reads the files and projects
   them with a Java annotation vocabulary.
4. **`vision.noesis.annotations` is unchanged.** The DDD graph the previous
   parser derived (`detect/`, `derive/`, `graph.json`) is gone; its rules are
   the projection's now, with the Java annotations as a second vocabulary
   table. The old design is kept in
   [`prior-art/java-parser-ddd-graph.md`](prior-art/java-parser-ddd-graph.md).
5. **Ids follow the shared spelling.** Constructors are `#.ctor`, static
   initializers `#.cctor`, nesting is `+` (never `$`), generic arity is
   `` `n `` per nesting level, so a consumer never branches on language.
6. **Artifacts.** A parsed module is `A:<artifactId>` (the name references
   bind to, as the model document says for Maven). A library on the classpath
   is `A:<groupId>:<artifactId>[:<classifier>]@<version>` with its package
   coordinates on the dependency, because the artifactId alone (`core`,
   `api`) is not unique. A JDK module is a platform artifact
   `A:<module>@<release>` (`A:java.base@17`), labelled with the release the
   sources were bound against. A release without modules (8) names the module
   that holds the class from 9 on, as `ct.sym` files it (`A:java.sql@8`).
7. **The implicit `super()` call is an edge.** Every constructor without an
   explicit constructor call invokes its superclass constructor; the bytecode
   has the `invokespecial`, so the source engine emits the same `INVOKES`,
   with `receiver: 'base'` and `java.implicitSuperCall: true` on the site. This
   deviates from the C# rule ("no operation, no edge") on purpose: the two
   engines must agree.
8. **No annotation processors.** The source engine runs javac with
   `-proc:none`, as the .NET parser runs no analyzers. Members a processor
   would generate do not exist; calls to them become `NS1002` diagnostics.
   Such projects use the bytecode engine, or the _hybrid_ engine (section
   4a), which keeps the source model and takes the generated members and the
   calls to them from the class files, until a `noesis.processors` switch
   exists.

## 2. How Java maps onto the model

The model document's sections 3.2 to 3.7 define the shapes; this table says
which Java fact fills each field. "javac" is the source engine's input,
"ArchUnit" the bytecode engine's.

### 2.1 Artifact and namespaces

| Model                      | javac / Maven                                                                                                                                                                                                                                                               | ArchUnit                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `ArtifactNode.id`, `name`  | `A:<artifactId>` and the artifactId; when another module of the build has the same artifactId, the id says the group (`A:com.acme.billing:api`; a Gradle project's path, `A:billing:api`) and the name stays short, so two modules never share an id (`JavaIds.moduleName`) | same                                             |
| `version`, `rootDirectory` | the module's version; its base directory, repository-relative                                                                                                                                                                                                               | same                                             |
| `target`                   | `jdk-<release>`, the release the sources are bound against (`maven.compiler.release`, else `maven.compiler.target`, else the running JVM)                                                                                                                                   | same                                             |
| `executable`               | a `mainClass` configured on `maven-jar-plugin` or `spring-boot-maven-plugin`, `${property}` references resolved from the project's properties (an unresolved one, the Spring Boot parent's `${start-class}`, is no main class); the class is `java.mainClass` in the bag    | same                                             |
| `dependencies`             | every compile-scope artifact: a reactor sibling is `source` (`A:<artifactId>`, `package: null`), anything else `library` with `package {id, version}`; the platform modules stubs reached are appended, as the .NET parser appends stub assemblies                          | same                                             |
| `annotations`              | `[]` (no module-level annotations; `module-info` is deferred)                                                                                                                                                                                                               | `[]`                                             |
| `languageSpecific`         | `java.groupId`, `java.packaging`, `java.buildFile` (repository-relative pom), `java.engine` (`source`, `bytecode` or `hybrid`), `java.mainClass`                                                                                                                            | same                                             |
| `NamespaceNode`            | one per dotted level of every package clause, plus the empty root the artifact contains; `locations` are the spans of each prefix of every `package` clause (`package-info.java` included); `annotations` are the `package-info` annotations                                | locations `[]`, annotations from the class files |

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
source). A repeated annotation comes as the container javac synthesizes,
with the repeats in its `value` in source order; the container is not
written, so its `value` is not `positional`, and each repeat is read off its
own spelling. Defaults are not filled in. Values: constants are `literal` through
`Literals`, `X.class` is `type`, an enum constant is `enum`, arrays and nested
annotations nest. Annotations sit on types, methods, fields, parameters, type
parameters and packages; type-use annotations on return types are not split
out.

### 2.7 Body-level edges

Bodies attribute to a member the way the .NET parser attributes them: method
and constructor bodies to the member, static initializer blocks to `.cctor`,
field initializers to the field (a compile-time constant is folded and has no
body), instance initializer blocks to every constructor that does not start
with `this(...)`, lambdas to the enclosing member with `viaClosure: true`, and
the members of local and anonymous classes to themselves.

| Site                                                                                                                                                                         | Edge                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x.m()`, `m()`, `T.m()`, `super.m()`                                                                                                                                         | `INVOKES` to the method declaration, `invocationKind: call`, the receiver classified (section 2.8); `typeArguments` as written, or recovered from the instantiated method type where a type variable binds plainly, else `[]` |
| `arr.clone()`                                                                                                                                                                | `INVOKES` to `M:java.lang.Object#clone()`: an array type declares nothing, and its `clone()` overrides `Object`'s (javac binds it to a member of its synthetic `Array` class, the class file to the array type itself)        |
| `new T(...)`, `this(...)`, `super(...)`                                                                                                                                      | `INVOKES` to `#.ctor`; `typeArguments` are the created type's flattened arguments; receiver `null`, `this` or `base`                                                                                                          |
| the implicit `super()`                                                                                                                                                       | `INVOKES` to the superclass's no-argument constructor (`Enum(String, int)` for an enum), `receiver: base`, `java.implicitSuperCall: true`, located at the constructor's start (decision 7)                                    |
| `new T() { ... }`                                                                                                                                                            | `INVOKES` to the anonymous class's constructor, which is a generated node of the anonymous type                                                                                                                               |
| a field read or write                                                                                                                                                        | `ACCESSES` with `read`, `write` (assignment target) or `readWrite` (compound assignment, `++`, `--`); no edge for a read of a compile-time constant, which javac folds; `arr.length` is no member                             |
| `(T) x`                                                                                                                                                                      | `USES_TYPE cast`                                                                                                                                                                                                              |
| `x instanceof T`, `x instanceof T t`, a type pattern in a `case` label, a record pattern and each type pattern nested in it (`case Box(Circle c)`; not `var` or a primitive) | `USES_TYPE typeTest`                                                                                                                                                                                                          |
| `new T[n]`, `new T[] {...}`                                                                                                                                                  | `USES_TYPE creation` with the array reference                                                                                                                                                                                 |
| `X.class`, `Foo::bar`                                                                                                                                                        | nothing (`typeLiteral` and `REFERENCES_METHOD` are deferred, as in the model document's section 8); a method reference's receiver is walked                                                                                   |
| a site javac could not bind                                                                                                                                                  | no edge and one `NS1002` diagnostic with the text                                                                                                                                                                             |

### 2.8 Receivers

`this` and an unqualified instance member → `this`; `super.` → `base`; an
identifier bound to a parameter → `parameter`, to a local, resource, catch or
binding variable → `local`, to a field or enum constant → `field`; a type
name or an unqualified static member → `type`; a call → `returnValue`;
`new` → `creation`; a literal → `literal`; else `other`. Parentheses and
casts are looked through.

### 2.9 Stubs and diagnostics

Every id built for a symbol that no parsed module declares yields a stub:
the symbol, its containing types, its package chain, and for a type its
`EXTENDS`/`IMPLEMENTS` chain with the bases stubbed in turn up to (excluding)
`java.lang.Object`. The stub's `artifact` is the JDK module
(`A:java.base@17`) or the jar the class file came from, mapped to the build's
dependency. Symbols of sibling modules are never stubbed: their ids resolve
to that module's file.

Compiler diagnostics keep javac's codes (`compiler.err.cant.resolve.location`),
English messages and spans. The parser's own are `NS1001` (a module could
not be parsed; the model is empty), `NS1002` (an unbound site), `NS1003`
(no compiler in this JVM), `NS1004` (an id declared twice), `NS1005` (the
class directory is missing; a warning in the hybrid model, which is then the
source model), `NS1006` (parameter names unavailable), `NS1007`
(a class not fully imported), `NS1008` (the running JDK has no API signatures
for the module's release, so the bytecode engine read its own JDK's classes),
`NS1009` (a warning: the running JDK's javac does not support the module's
release, so the source engine bound the sources against the nearest release it
does, the running JDK's for a newer one), `NS1010` (the source engine failed
on one file: an error when the file's declarations are dropped, a warning
when only its bodies' calls, accesses and type uses are, or when the hybrid
engine took the dropped file's types or bodies from the class files), `NS1011` (a
warning: the hybrid engine's bytecode side failed on the module, so the hybrid
model is the source model). A failure in one
file costs that file: whatever the walk of that file added is rolled back, and
the walk goes on with the next file. Edges from other files into the types of
a dropped file keep their ids, with no node behind them. An engine that fails
on a module outside the walk of a file (javac itself, the closure), an
exception or a `StackOverflowError` included, writes the artifact and the
`NS1001` alone, never a partial model, and the parse goes on with the next
module. The service logs every error and warning a parser wrote, and counts
the compiler's per artifact.

## 3. The source engine

```
sources under the compile source roots, but module-info.java (it would make the sources a named module, which cannot read the classpath)
→ javac: -proc:none --release <release> -implicit:none -Xlint:-options -classpath <compile classpath minus the module's own classes>
  parse() + analyze()
→ declaration pass: every top-level class of every unit, through javax.lang.model, trees for spans and Javadoc
→ body pass: a TreePathScanner per unit; local and anonymous classes are handed back to the declaration pass
→ external closure: every external element an id was built for → stubs and base chains
→ compiler diagnostics → the model, sorted
```

The module's own `target/classes` is removed from the classpath so sources
bind to sources, never to a stale class. Attributed trees survive errors:
an error type is `unresolved`, an unbound call is a diagnostic, and a javac
crash on one module leaves an empty model with `NS1001` while the parse goes
on. The engine runs on a thread of its own with a 512 MB stack, reserved
rather than committed, because javac's attribution and the walks recurse
once per nesting level, and an expression thousands of terms deep overflows
a build thread's default stack. Ids nest (a method id spells its parameter types), so the id cache is
filled get-then-put, never with `computeIfAbsent`.

## 4. The bytecode engine

```
target/classes imported with ArchUnit's ClassFileImporter, a class loader on the context class loader
  (ArchUnit resolves referenced classes through it; a class it knows by name only is imported on demand):
  the JDK of the module's release first, read from the running JDK's lib/ct.sym as javac --release does,
  then the compile classpath; the running JDK's classes only when ct.sym has no such release (NS1008)
→ an ASM pass over the same class files for what ArchUnit does not expose: parameter names, ACC_VARARGS, ConstantValue
→ declarations over the imported classes (synthetic classes and members, bridges and lambda methods skipped)
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
  (boxing, iterators, `close()`, `Integer.TYPE` for `int.class`) are
  present; `INVOKES.typeArguments` is always `[]`; a compound assignment is
  two accesses; a `finally` body is present once per exit path.
- Lines of body edges are javac's line table: a `new` or a field read on a
  continued line of a statement is attributed to the statement's line, the
  calls of a chain to their own lines, where the source engine locates the
  whole expression.
- `strictfp`, `non-sealed`, `positional` on annotation arguments,
  type-parameter annotations and SOURCE-retention annotations are unknown;
  annotations are ordered by type, not as written.
- Implicit record members and default constructors are `declared`;
  `.cctor` exists whenever a static field has an initializer; field
  initializers attribute to the constructors and `.cctor` they compile into;
  a class declared in a field initializer has no `java.enclosingMethod`.
- The compiler's constructor parameters are dropped from ids and
  signatures: the locals a local or anonymous class captures and an enum
  constructor's name and ordinal by the `MethodParameters` attribute's
  `synthetic` flag, an inner class constructor's outer instance by its
  position (`mandated` also marks parameters the source spells, such as a
  compact constructor's). Without the attribute (compiled without
  `-parameters` before JDK 21) only the leading ones are told, by position.
- A nested or local enum, interface, record or annotation is `static`
  whether or not ArchUnit reads the flag (JLS 8.5.1, 14.3); a type variable
  bound on another type variable (`D extends B`) is read as `!0`/`!!0`, not
  dropped as `Object`.
- ArchUnit does not read the type arguments of an inner class's enclosing
  instantiation: `Outer<String>.Inner<Integer>` is ``Inner`1[Integer]``.
- Type variables are resolved by name in the scope the signature was read
  in (the method's type parameters, then the declaring class's, then the
  enclosing classes' and methods'), not through ArchUnit's owner: ArchUnit
  collects the candidates of a nested class and its enclosing classes in a
  hash set, so for `ImmutableList<E>.Builder<E>` it names either `E`
  depending on the run.
- An inherited member may be bound to a different declaring type than javac
  chooses.

The agreement test (`EngineAgreementTest`) parses the fixture with both
engines (compiled with `-parameters -g`) and asserts equality after removing
exactly those gaps; `EngineComparisonReportTest` writes the unfiltered
difference, counted by category beside what each engine holds, to the
committed `core/src/test/resources/golden/engine-comparison.md`, so the size
of every gap is reviewed with the diff. Shrinking the list is the roadmap.

## 4a. The hybrid engine

`noesis.engine=hybrid` runs both engines over the module and merges the two
models by id (`core/hybrid/ModelMerge`): the source model is kept whole, and
the bytecode model contributes only what the sources cannot show. The result
is the source engine's fidelity (receivers, type arguments, casts, Javadoc,
columns, generated-versus-declared) plus what an annotation processor
produced, for the price of both parses and a compiled module.

- A declaration only the class files have, a member or type Lombok or
  another processor generated, is added with `origin: generated` and
  `java.engine: bytecode` in its bag, with its containment, bases,
  overrides, interface member mapping and body edges from bytecode. A type
  of a file whose declarations the source engine dropped (`NS1010`) is added
  the same way but keeps bytecode's origin, `declared`, and its `NS1010`
  becomes a warning that the file's types come from the class files. A
  `.cctor` of a type the source engine declared is not added (the source
  engine attributes static initializers to the fields), unless generated
  static fields of the type (Lombok's logger and `@Synchronized`'s lock) are
  initialized on one line, which does not tell their initializers apart: they
  stay on the `.cctor`, added as generated.
- An implicit member the source engine assumed but the class files lack,
  the default constructor of a class Lombok gave constructors, is dropped
  with its edges. A default constructor the source engine assumed whose
  class file version a processor wrote is taken from bytecode, node and body
  edges, marked `java.engine: bytecode`: javac gives its default constructor
  the class's access and compiles it onto the class declaration, the line of
  the source engine's implicit super call, so one with another access or
  modifiers (`@UtilityClass`'s private constructor that throws) or starting
  on another line (`@NoArgsConstructor` on its own line) is the processor's.
  One written on the class's line with the class's access is not told apart
  and keeps javac's body.
- A declaration in both models keeps the source engine's facts; where the
  class file has a modifier the sources lack, its modifiers are taken whole,
  since one it adds can contradict one the sources imply (`@UtilityClass`
  makes a method `static`, so no longer `virtual`), and so is a visibility it
  changes (`@Value` makes the class final and the fields private); the node
  is marked `java.processorModified: true`. Both engines map the same access
  flags, so the sources hold no modifier the class file cannot express.
- Before the merge (`MergeInputs`), a source method whose signature names a
  type only the processor declares (`void accept(ImmutableX x)`, a Lombok
  builder class), which has an `<unresolved:...>` id in the source model,
  takes the id bytecode has for it, with every edge to and from it; types the
  source engine left unresolved on a field, a return or a parameter take
  bytecode's. And a constructor's or `.cctor`'s bytecode edges on the lines of
  a field of its type become the field's, as the source engine attributes a
  field initializer (taken from one constructor, since every constructor holds
  a copy; the store into the field itself is no access). A generated field
  has no lines, but Lombok puts its initializer on the annotation's line: the
  `.cctor`'s (`@Slf4j`'s `log`) or a constructor's (`@Synchronized`'s
  `$lock`) edges on the line of its store into the field become the field's,
  outside the sources' fields and static blocks and what javac compiles there
  (the assertion switch's `desiredAssertionStatus()`, an older javac's enum
  `$VALUES` array); a line several generated fields store on stays.
- A body edge from a source declaration is taken from bytecode only where it
  targets an added declaration or sits within the lines of an expression the
  source engine reported an `NS1002` for: the call it could not bind and every
  call chained after it, on whatever line (`holder.getName()` then `.stream()`
  on the next line). Within such an expression bytecode's sites are counted
  against the source engine's of the same caller and target, since the two put
  a continued line's sites on different lines. Such a site is marked
  `java.engine: bytecode`; its receiver and type arguments are bytecode's. A
  source call on that line to a member of the same name and arity the class
  file does not make (javac bound `equals` to `Object`'s, not knowing the
  generated override) is replaced by the bytecode call. An `NS1002` whose
  lines gained an edge, or whose statement's first line did within the same
  declaration (javac attributes a continued-line `new` to it), is dropped, as
  is a compiler error at its position, on lines that gained an edge, or naming
  a class the merge added, and javac's "C is not abstract and does not
  override abstract method m(..)" where the merge added a method of that name
  and arity to C (`@Delegate`). A file whose bodies alone the source engine
  dropped (an `NS1010` warning; the walk's partial edges are rolled back)
  takes every body edge of its declarations from bytecode, so marked, and its
  `NS1010` says the bodies come from the class files. A base the source
  engine left `unresolved` is replaced by bytecode's of the same kind, and
  kept where bytecode has none (no class file, a stale one).
- Stubs are the source engine's plus the bytecode engine's for every symbol
  the added declarations and edges reference, with containers and base
  chains; the bytecode engine's module-level diagnostics (classes missing,
  parameter names missing) are kept; its `NS1001` becomes an `NS1011`
  warning, since the model is the source model, and its `NS1005` a warning
  that says so. Without a source model, no compiler
  (`NS1003`) or a source engine that failed on the module (`NS1001`), the
  bytecode model is the whole result, with the source engine's diagnostics;
  a merge that fails writes the `NS1001` alone.

On a module without annotation processors the hybrid model is the source
model byte for byte (`HybridEngineTest`); on `test-fixtures/java-lombok` it
holds every generated member and every call to one, and `engine-comparison.md`
counts what each engine wrote for it beside the syntax fixture. What stays
bytecode's on the added sites is bytecode's gaps: the receiver is `other`,
type arguments are absent, the location is a line.

## 5. The Maven plugin

`noesis:parse`, bound to `process-classes` so the module and the reactor
siblings it depends on are compiled:

| Property                | Default                                                     | Meaning                                                                           |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `noesis.out`            | `${session.executionRootDirectory}/.noesis/tmp/parser`      | the output root; a relative path is taken from the execution root, not the module |
| `noesis.repositoryRoot` | `${session.executionRootDirectory}`                         | paths in the model are relative to it; relative paths as for `noesis.out`         |
| `noesis.repository`     | the root directory's name                                   | `repository.name` in the manifest                                                 |
| `noesis.revision`       | `""`                                                        | `repository.revision`                                                             |
| `noesis.engine`         | `source`                                                    | `source`, `bytecode` or `hybrid`                                                  |
| `noesis.release`        | the compiler plugin's `release` → `target` → `source` → JVM | the release the sources are bound against                                         |
| `noesis.skip`           | `false`                                                     | skip this module                                                                  |

Each of the compiler plugin's `release`, `target` and `source` is read as the
compiler plugin reads it: the `default-compile` execution's configuration, else
the plugin's, else the `maven.compiler.*` property, a command-line `-D` winning
over the POM; `release` wins over `target`, `target` over `source`.

Each module writes `code-model/java/<artifactId>.code-model.json` (`~2` on a
name clash) and rewrites the manifest listing every module parsed so far in
reactor order, through state shared by every module of the build (one per
Maven request, created atomically, so thread-safe for `-T`), so the manifest
is complete after the last module and partial after a stopped build. Nothing
is deleted: a reader reads only the files the manifest lists, and the service
scans into a fresh directory that it removes once it has read the model.
`pom` modules are skipped.

The service invokes the plugin by its full coordinates, so the project's POM
needs no change:

```sh
mvn -B -q -ntp -Dnoesis.out=<.noesis/tmp/<uuid>> -Dnoesis.repositoryRoot=<root> -Dnoesis.repository=<name> \
  process-classes vision.noesis:noesis-parser-maven-plugin:0.1.0-SNAPSHOT:parse
```

The plugin must be in the local repository: `mvn -q install -DskipTests` in
`parsers/java`.

## 5b. The Gradle plugin

`parsers/java/gradle-plugin` is a Gradle build of its own (the Gradle API is
not on Maven Central) that takes `core` from the local repository and
publishes the `vision.noesis.parser` plugin there. Applied to any project of
a build, it registers one `noesisParse` task on the root project, so a build
has one parse whichever project applies it; the task depends on `classes` of
every project with the `java` plugin and hands them all to
`JavaParser.parse(ParseRequest)` in one go, in dependency order (a project
before the projects whose compile classpath has it), so the manifest is
written once and complete, where the Maven plugin rewrites it per module. A
project's inputs are read off the configured project: the main source set's
source roots and classes directory, the resolved `compileClasspath` with each
element's component (a project of this build is a `source` dependency, a
module a `library` by its coordinates, a plain file a library named after
itself), the compile task's `release` else `targetCompatibility`, the
encoding, `war` or `jar`, and the main class from the `application` plugin,
`springBoot.mainClass` or the jar manifest. The settings are those of section
5 in a `noesis { }` block, each overridden by the Gradle property of the same
name (`-Pnoesis.engine=bytecode`); `noesis.skip` has no Gradle counterpart,
the task simply is not run. The task declares its inputs, so it is up to date
while the sources, the classpath and the settings are unchanged, and is not
cacheable because the model holds absolute paths. The functional test runs
the task through Gradle TestKit on `src/test/resources/multi-project`, the
Gradle twin of the Maven integration test's reactor, and asserts the same
facts. `examples/discounts-java` applies the plugin with the hybrid engine
(section 4a), its sources being Lombok's, and its `.noesis/settings.json` runs it
through the `java` parser (section 5a); its shipped system model has
the source lines of every building block and, Lombok's accessors being
`generated`, only the written methods as behaviours.

## 5a. The service adapter

A Java repository declares the Noesis plugin in its build, with what it
needs (the version, the engine) in the plugin's configuration, and names
`"parser": { "language": "java", "command": [...] }` in
`.noesis/settings.json`, the command running it (`{out}`, `{root}` and
`{name}` filled in). The `java` parser shares its shape with the C# adapter
through `command-code-parser.ts`: run a command line into the session
directory, find the `code-model/<language>/manifest.json` of its language, read
it and its files with the zod schema; `SystemModelBuilder` projects them with the vocabulary of the
language the manifest names. The service knows nothing of Maven or Gradle,
and the repository's own build decides how the plugin runs.

A compile error costs no module its parse. For Maven the command passes
`-Dmaven.compiler.failOnError=false`, which belongs to the compiler plugin
and so cannot sit in the Noesis plugin's configuration. The Gradle plugin
turns `failOnError` off on every `JavaCompile` task itself when `noesisParse`
is among the requested tasks. Either way the engines read the sources and
the compiler's errors land in the model. A Maven repository:

```json
{
  "parser": {
    "language": "java",
    "command": [
      "./mvnw",
      "-B",
      "-q",
      "-ntp",
      "-Dnoesis.out={out}",
      "-Dnoesis.repository={name}",
      "-Dmaven.compiler.failOnError=false",
      "process-classes",
      "noesis:parse"
    ]
  }
}
```

A Gradle one:

```json
{
  "parser": {
    "language": "java",
    "command": [
      "./gradlew",
      "-q",
      "noesisParse",
      "-Pnoesis.out={out}",
      "-Pnoesis.repositoryRoot={root}",
      "-Pnoesis.repository={name}"
    ]
  }
}
```

Both plugins write the same files, so the two presets differ only in the
command line; a build tool the plugins do not cover yet is a new `command`,
not a change to the service. The Java
vocabulary is `app/scanner/code-model/system-model-builder/java.vocabulary.ts`; it needed two
small projection rules the C# one did not: a `behaviour` role may fix the
behaviour type itself (R9.4, for the argument-less handler annotations) and a
record component's private field is a property while its accessor is not a
behaviour (R5.7). The regex-based `java` parser, kept for Gradle builds
until the Gradle plugin covered them, has since been removed.

## 6. Testing

- **Golden model**: the two fixture modules under `parsers/java/test-fixtures`
  (`java-syntax`, one file per topic, and `java-syntax-other`, the types it
  reaches across a module boundary) parsed to a checked-in model file per
  module plus the manifest, under `core/src/test/resources/golden/<engine>/`;
  `java-lombok`, parsed as a request of its own, has a model file per engine
  there too. `NOESIS_UPDATE_GOLDEN=1 mvn test` rewrites them. The three
  `typeusage/*TypeUsage` classes use a type from the own module, the other
  module and a library in the same positions, so they differ only in the ids
  referenced and in which of those are declared or stubbed.
- **Schema**: the golden files are parsed by the strict zod schema in
  `server/backend` (`test/unit/code-model-schema.spec.ts`),
  so a field added on one side fails the other.
- **Facts**: `ModelFactsTest` pins the facts the golden file is too large to
  review by eye: ids of nested and anonymous types, flattened ordinals,
  generated members, visibility and modifiers, constants, constructor chains,
  interface slots, receivers, closures, stubs.
- **Broken fixture**: a syntax error and a missing import still yield a model
  with the declarations, an `unresolved` reference, the compiler's errors and
  an `NS1002`.
- **Agreement**: `EngineAgreementTest` parses the syntax fixture with the
  source and the bytecode engine and asserts equality up to the exclusions
  `AgreementRules` names (section 4); `EngineComparisonReportTest` keeps the
  unfiltered, counted difference of every engine from the source engine, over
  the syntax fixture and the Lombok fixture, in `golden/engine-comparison.md`.
- **Hybrid**: `HybridEngineTest` asserts that the hybrid model of the syntax
  fixture is the source model, and on the Lombok fixture that the generated
  members, their edges, the calls to them, the dropped default constructors,
  the processor-added modifiers, the rebound `equals` calls, the stub closure
  and the dropped diagnostics are what section 4a says.
- **Facts per engine**: the `*FactsTest` classes (types, members,
  inheritance, interfaces, generics, invocations, bodies, namespaces, the
  other module, the manifest) mirror the .NET parser's test classes over
  the mirrored fixtures; a fact every engine holds runs as a
  `@ParameterizedTest` over `EngineKind` (the hybrid engine takes the
  source engine's branch), a fact in section 4's list runs on the source
  engine alone. `TypeUsageMirrorTest` checks that the three
  `typeusage` classes declare the same members, as the .NET
  `TypeUsageMirrorTests` does.
- **Service**: `test/fixtures/java/shop` is a two-module Maven build with the
  rules of the C# `shop` fixture in Java and its committed `code-model/`;
  its POM declares the plugin and its `.noesis/settings.json` runs it;
  `test/unit/java-code-parser.spec.ts` runs the `java` parser over a fake
  build that copies the committed model and pins the projected model,
  `test/e2e-toolchain/java-parser.e2e.spec.ts` installs the plugin and scans
  the fixture for real with the fixture's own settings, asserting the same
  model as the committed files project to.
- **Plugin**: `maven-plugin/src/it/multi-module` is a two-module reactor
  project (b depends on a, a uses Guava) that `maven-invoker-plugin` builds
  with the exact invocation the service makes (`process-classes` plus the
  goal's full coordinates); a Groovy script asserts the manifest's reactor
  order, b's `source` dependency on a, a's library and platform dependencies,
  the main class, the ids and an invocation across the modules.

## 7. Deferred

Running the Gradle plugin on a build that does not apply it (an init script
the `java` command passes); a `wildcard` type reference kind; `@Nullable` → `nullable`; the
`hiding` modifier; `module-info` as a node (its file is left out of the
compilation, section 3); `typeLiteral` (`X.class`) and
`REFERENCES_METHOD`; parameter names without `-parameters`; running
annotation processors (Lombok) in the source engine, which would give the
sites the hybrid engine takes from bytecode their receivers and type
arguments; library models; a `noesis.processors` switch; the receiver of a
site the source engine could not bind, which the source engine knows and
could hand the merge.
