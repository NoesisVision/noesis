# C# syntax fixtures

A .NET 10 / C# 14 solution that exercises C# syntax for tests of the .NET
scanner. It is not a business domain: every type, member and variable is named
after the syntax it demonstrates, so a test can look for
`DerivedFromClosedGenericBase` or `ExtensionMemberStaticProperty` by name.

Build it from this directory:

```sh
dotnet build
```

The build must stay warning-free. `Directory.Build.props` silences only the
warnings that fixture code triggers by design (unused fields, unused locals,
hiding without `new`, ...).

## Layout

| Path | What it covers |
| --- | --- |
| `CSharpSyntax/Types` | class, struct, record, interface, enum, delegate kinds; nested, file-local, partial, primary-constructor and attribute types; built-in, nullable, array, tuple, pointer and function-pointer types |
| `CSharpSyntax/Inheritance` | class, generic, abstract, record and interface inheritance: `virtual`/`override`/`sealed`/`new`, `base`, covariant returns, constructor chaining, deriving from aliases, framework types and the other project |
| `CSharpSyntax/Interfaces` | implicit, explicit and mixed implementation; multiple, generic (also twice), default, static abstract, variance; struct, record, ref struct and partial implementations; re-implementation; implementation via base class or alias |
| `CSharpSyntax/FieldsAndProperties` | all field modifiers and initializers, `ref` fields, fixed buffers, events; auto, expression-bodied, block-bodied, `field` keyword, `init`, `required`, partial, ref-returning and indexer properties |
| `CSharpSyntax/Methods` | modifiers, return types, parameter kinds (`ref`/`out`/`in`/`ref readonly`/`params`/optional/`scoped`), async and iterator methods, partial members, constructors, finalizer, operators, local functions, lambdas |
| `CSharpSyntax/Generics` | generic types and methods with one and two parameters, every constraint kind, variance, nested generics, open generic `typeof`/`nameof`, generic extension members |
| `CSharpSyntax/LocalVariables` | every declaration and assignment form: `var`, `const`, `ref`, `scoped`, deconstruction, `out var`, patterns, `using`, `foreach`, `fixed`, `stackalloc`, literals, collection expressions, initializers, query variables |
| `CSharpSyntax/Usings` | `using`, `global using`, `using static`, aliases (type, namespace, tuple, array, pointer, nullable), `extern alias`, project-file `<Using>` items, implicit usings, namespace-scoped usings, block, file-scoped and nested namespaces, one namespace declared in both projects, fully qualified and `global::` names, `InternalsVisibleTo` |
| `CSharpSyntax/Invocations` | static, instance, `this`, `base`, local function, field, property, local, parameter, returned value, indexer, cast, interface, dynamic, delegate, event, function pointer, reflection, classic extension and C# 14 extension member invocations, argument forms |
| `CSharpSyntax/TypeUsage` | a custom type in every position a type can occupy: field, property, indexer, event, parameter of every passing kind, return, generic argument, constraint, tuple element, delegate signature, operator operand, conversion, attribute and attribute argument, base type, interface, extension receiver and every body-level form; the same positions and member names three times, with types from this project (`OwnProjectTypeUsage`), from the referenced project (`OtherProjectTypeUsage`) and from NuGet packages (`NuGetPackageTypeUsage`) |
| `CSharpSyntax/Program.cs` | top-level statements |
| `CSharpSyntax.OtherProject` | types consumed through a `ProjectReference` (with an extra alias for `extern alias`) |

`CSharpSyntax` references two NuGet packages: `JetBrains.Annotations` for
attribute types and `NodaTime` for structs, classes, interfaces, an enum,
operators, an indexer and exceptions declared outside the solution.
