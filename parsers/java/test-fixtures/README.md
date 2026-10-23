# Java syntax fixtures

Three Maven modules for the tests of the Java parser. Two exercise Java
syntax, mirroring the .NET parser's `CSharpSyntax` solution
(`parsers/dotnet/test/fixtures`): the same topics, the same member names in
camelCase, so a test of either parser can look for `derivedFromClosedGenericBase`
or `instanceMethodWithArguments` by name. It is not a business domain: every
type, member and local is named after the construct it demonstrates. C#
constructs with no Java equivalent (properties, events, operators, structs,
`ref`/`out`, extension members, aliases, ...) have no counterpart; Java-only
constructs (local records and enums, `import static`, intersection casts,
multi-catch, labeled loops, `finally` duplication) are added where they fit.

The third, `java-lombok`, is the one module compiled with an annotation
processor: classes whose members Lombok generates and the callers that use
them, which the source engine cannot bind, the bytecode engine sees without
their source facts, and the hybrid engine merges.

Built by the reactor (`mvn -B verify` in `parsers/java`) with
`-parameters -g` against `--release 17`; the modules are never installed.

## Layout

| Path                                            | What it covers                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `java-syntax/.../syntax/types`                  | class, interface, enum, record, annotation and functional-interface kinds; nested, local, anonymous, package-private top-level and sealed types; built-in, boxed, array, wildcard and nested generic types as fields                                                       |
| `java-syntax/.../syntax/inheritance`            | class, generic, abstract and interface inheritance: overrides, covariant returns, `super` calls, constructor chaining, field hiding, framework and other-module bases, self-bounded generics                                                                               |
| `java-syntax/.../syntax/interfaces`             | implicit, inherited, abstract and re-implemented interface members; multiple, conflicting, generic (open, closed, partially closed), other-module and framework interfaces; `X.super.m()`                                                                                  |
| `java-syntax/.../syntax/members`                | field and method declarations: every modifier, constants, initializers, static and instance blocks, overloads, varargs, return and parameter types, `Object` method overrides, local classes and every lambda form                                                         |
| `java-syntax/.../syntax/generics`               | generic types and methods with one and two parameters, every bound kind, dependent and shadowing parameters, inner classes of constructed types, explicit and inferred type arguments                                                                                      |
| `java-syntax/.../syntax/localvariables`         | every declaration and assignment form: `var`, literals, creation, patterns, switch statements and expressions, try-with-resources, loops, catch, `synchronized`, labels, streams, captured locals, async                                                                   |
| `java-syntax/.../syntax/imports`                | single-type, on-demand and static imports, nested-type and other-module imports, fully qualified names, a sub-package importing its parent, a class named like a sibling package, a deeply nested package                                                                  |
| `java-syntax/.../syntax/invocations`            | every receiver kind, argument form, statement context, stream pipeline, functional-interface call, reflection, local class, constructor form, async call and array member; `InvocationTarget` is the class they target                                                     |
| `java-syntax/.../syntax/typeusage`              | a custom type in every position a type can occupy, three times with the same member names: from this module (`OwnModuleTypeUsage`), from the other module (`OtherModuleTypeUsage`) and from Guava (`LibraryTypeUsage`)                                                     |
| `java-syntax/.../syntax/annotations`, `javadoc` | annotation value kinds and targets; Javadoc on every declaration kind                                                                                                                                                                                                      |
| `java-syntax/.../syntax/Program.java`           | the main class                                                                                                                                                                                                                                                             |
| `java-syntax-other`                             | the types `java-syntax` reaches across a module boundary: a class with a nested class, an abstract class, a generic class, constants, interfaces, a functional interface, an enum, a record, an exception, a closeable, an annotation, a nested package                    |
| `java-lombok/.../lombok/GeneratedMembers`       | one nested class per Lombok feature: `@Getter`/`@Setter`, `@Data`, `@Value`, `@Builder(toBuilder)`, the three constructor annotations, `@With`, fluent chaining accessors, `@EqualsAndHashCode`/`@ToString`, `@Delegate` on a class implementing `List`, and a plain class |
| `java-lombok/.../lombok/GeneratedMemberCallers` | a call to every generated member, including a call chained after a generated getter, a builder chain, generated `equals` on a receiver javac binds to `Object`, and a generated getter as a method reference                                                               |

`java-syntax` depends on `java-syntax-other`, `noesis-annotations` and Guava;
only those three are on the parse classpath, so a new fixture may use Guava's
own types but none of its transitive dependencies.
