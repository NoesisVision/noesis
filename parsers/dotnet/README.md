# Noesis .NET parser

A .NET 10 tool, `noesis-parse-csharp`, that reads a C# solution with Roslyn and
writes the common **code model**: one JSON file per project with every
namespace, type and member, the edges between them (containment, inheritance,
overrides, interface member mapping, invocations, member accesses, body-level
type uses) and stubs for the external symbols it reached. The model and its
ids are described in [`docs/arch/code-model.md`](../../docs/arch/code-model.md)
and its JSON Schema is generated into [`../code-model/`](../code-model/);
this README is about building and running the parser.

The parser never fails because code does not compile: unbound names become
`unresolved` type references, unbound call sites become diagnostics, and a
project that cannot load becomes an empty model with the error.

## Layout

| Path                        | What it is                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/Noesis.Parser.Model/`  | The schema as C# records, the canonical string grammar, the JSON codec and the file layout; language-neutral |
| `src/Noesis.Parser.CSharp/` | Roslyn: solution loading, the declaration pass, the body pass, the external closure                          |
| `src/Noesis.Parser.Cli/`    | The `noesis-parse-csharp` command: arguments, exit codes                                                     |
| `test/Noesis.Parser.Tests/` | xunit tests over the fixture solution, the golden model files under `golden/`, the command line              |
| `test/fixtures/`            | The C# syntax fixture solution the tests parse (see its README)                                              |
| `test/fixtures-broken/`     | A project with a syntax error and a missing reference; must still yield a model                              |

## Installing the tool

The service's `csharp` parser runs `noesis-parse-csharp` from the PATH, so
the tool is installed once, globally, from a package built here. From this
directory:

```sh
dotnet pack src/Noesis.Parser.Cli -c Release
dotnet tool install -g Noesis.Parser --add-source src/Noesis.Parser.Cli/bin/Release
noesis-parse-csharp --help
```

`~/.dotnet/tools` has to be on the PATH of the shell the service starts from
(the .NET SDK installer adds it). After a change to the parser, pack again
and reinstall; the version stays `0.1.0`, so `dotnet tool update` sees
nothing new:

```sh
dotnet pack src/Noesis.Parser.Cli -c Release
dotnet tool uninstall -g Noesis.Parser
dotnet tool install -g Noesis.Parser --add-source src/Noesis.Parser.Cli/bin/Release
```

## Commands

From this directory:

```sh
dotnet build                      # the parser and its tests
dotnet test                       # parses the fixtures once, then runs ~240 assertions and the golden comparison
NOESIS_UPDATE_GOLDEN=1 dotnet test --filter GoldenModelTests   # rewrite golden/ after an intended model change
dotnet run --project src/Noesis.Parser.Cli -- <path> --out <dir> --repository-root <repo>
dotnet pack src/Noesis.Parser.Cli                             # the `dotnet tool` package
```

The fixture solution must be restored once (`dotnet build test/fixtures`);
the tests parse it with `--no-restore`.

## Command line

```text
noesis-parse-csharp <path>...                  directory, solution or project(s)
  --out <dir>                                 output root (default `<repository-root>/.noesis/tmp/parser`)
  --repository <name> --revision <commit>     written into the manifest, supplied by the server
  --repository-root <dir>                     directory file paths are relative to (default: current directory)
  --configuration Debug|Release               MSBuild configuration (default Debug)
  --projects <glob,...>                       only these projects (by project name)
  --exclude-projects <glob,...>               skip these projects
  --tfm <moniker>                             target framework for multi-targeted projects (default: highest)
  --no-restore                                never run dotnet restore
  --cache <dir>                               reuse the model of every project whose inputs did not change (default: no cache)
  --verbosity quiet|normal|detailed
```

Exit code 0 when at least one project produced a model, 2 when none could be
loaded, 1 for invalid arguments. The output is `code-model/csharp/manifest.json`
plus one `<assembly>.code-model.json` per project under `--out`; the manifest
lists the files in dependency order and file paths inside the model are
relative to `--repository-root`.

With `--cache` the parser keys every project by its inputs (sources,
options, references, the keys of referenced projects, the parser build
itself) and copies the cached model instead of compiling when the key is
known; a change in a project reparses it and every project that references
it. The cache holds up to three versions per project under
`<dir>/<assembly>/<key>.code-model.json.gz`, the least recently used
evicted; the server passes `.noesis/cache/parser/csharp`. Delete the
directory to force a full parse.

Without a solution file the parser takes every `*.csproj` under the directory
except `bin/`, `obj/` and `node_modules/`. When a project has no
`obj/project.assets.json` the parser runs `dotnet restore` for it first, the
only step that may touch the network.

## How it maps

[`docs/arch/code-model.md`](../../docs/arch/code-model.md) describes the model;
the points below are how the C# parser fills it where the model leaves a
choice:

- **Locations** of types and members are the whole declaration (every part of
  a partial); a positional record property points at its parameter, a primary
  constructor at its parameter list. Namespace locations are Roslyn's: the
  name token of every level a declaration names, so `namespace A.B.C;` gives
  `A`, `A.B` and `A.B.C` a location each.
- **Compiler-synthesised members** (record members, default and copy
  constructors, delegate `Invoke`/`BeginInvoke`/`EndInvoke`) are emitted with
  `origin: 'generated'` and no locations; the top-level `Program` and
  `<Main>$` are `generated` with the compilation unit as location.
- **Extension blocks** (C# 14): every member is hoisted onto the enclosing
  static class under its own name; the block's type parameters come first in
  the hoisted member's `typeParameters` and are `!!n`, the member's own follow.
  Calls through the block member or through Roslyn's synthesised
  implementation method both target the hoisted id.
- **Delegate invocations** (`d()`, `d.Invoke()`) and user-defined operator
  calls produce no `INVOKES` yet; the
  delegate value itself is still an `ACCESSES`.
- **`IMPLEMENTS_MEMBER`** follows Roslyn's `FindImplementationForInterfaceMember`:
  when a base class member fills the slot, `from` is that base member even if
  a derived class overrides it. `IMPLEMENTS` includes the `IEquatable<T>` the
  compiler adds to records.
- **Readonly structs** carry `csharp.isReadonlyStruct` in the bag; `sealed`
  on an interface member is `final`.
- Function pointer references spell their convention as Roslyn does:
  `delegate* unmanaged[Cdecl]<int,void>`.
- **Dependency kinds** come from the restore output: a reference assembly is
  `platform` when its path runs through the targeting pack of a framework the
  project references (`project.frameworks.*.frameworkReferences` in
  `obj/project.assets.json`, so `packs/Microsoft.NETCore.App.Ref/` and a
  NuGet-downloaded `microsoft.netcore.app.ref/` classify the same); every
  other metadata reference is `library`, with its package when the assets file
  maps the path. Without restore output nothing is `platform`.
- **Workspace failures** carry no project id, so the project file is read off
  the MSBuild message (`...the file '/x/y/Broken.csproj'...`); a failure that
  names a project lands in that project's model, any other in the manifest.
