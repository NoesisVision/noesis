---
name: setup-dotnet-scanner
description: Set up Noesis scanning for a C# / .NET repository — install the noesis-parse-csharp tool the service runs, add the NoesisVision.Annotations package its domain code is annotated with, and write the "parser" of .noesis/settings.json — then prove it with a scan. Use when the user asks to set up, configure, enable or fix Noesis scanning for a .NET, C#, ASP.NET or solution-based project, when `scan_system_model` fails because .noesis/settings.json is missing or names no parser, or because `noesis-parse-csharp` cannot be run, or when the session start notice offers it.
argument-hint: [path-to-noesis-checkout]
---

# Set up Noesis scanning for a .NET repository

The Noesis service scans a C# repository with `noesis-parse-csharp`, a
.NET global tool it runs from the PATH: the tool loads the solution with
Roslyn and writes the code model the service builds the system model from.
The domain code carries the `NoesisVision.Annotations` attributes the
scanner reads (`[DddAggregate]`, `[DddValueObject]`, …). You install the
tool, add the package, write `{ "language": "csharp" }` as the `parser` of
`.noesis/settings.json` and prove it with a scan.

Ask before editing any project file, and show the user what you changed.

## Where things come from

| What                       | Where                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `NoesisVision.Annotations` | nuget.org                                                                                                                 |
| `noesis-parse-csharp` tool | not on nuget.org yet: packed from `code-parsers/dotnet` in the Noesis repository and installed globally from that package |

The Noesis repository is `https://github.com/NoesisVision/noesis`.

## Steps

1. **Read the settings.** If `.noesis/settings.json` exists, read it. When it
   already names a `parser`, tell the user and ask whether to replace it
   before going on. Keep its `namespacePartsToSkip` and `namespacesToExclude`.
   The file is strict: those two keys and `parser` are the only ones allowed.
2. **Find the code.** Look for `*.sln` or `*.slnx` at the repository root,
   else `*.csproj` files below it. The tool scans the repository root: with
   a solution there it loads that, without one every `*.csproj` outside
   `bin/`, `obj/` and `node_modules/`. With several solutions at the root it
   loads the first by name, and no setting picks another: tell the user
   which one that is. Note which projects hold domain code and which are
   tests or infrastructure.
3. **Check the SDK.** Run `dotnet --list-sdks`. The tool targets .NET 10, so
   it needs a .NET 10 SDK; the repository's own projects may target older
   frameworks. Tell the user if it is missing; do not install an SDK
   yourself.
4. **Install the tool.** Run `noesis-parse-csharp --help`. When it runs, go
   on. When it is not found, check `dotnet tool list -g` for `noesis.parser`:
   - Listed: the tool is installed but `~/.dotnet/tools` is not on the
     PATH the service inherits. Tell the user to add it to their shell
     profile and restart Claude Code, then stop here.
   - Not listed: ask the user for the path of a Noesis checkout (the
     argument, if given), or whether to clone
     `https://github.com/NoesisVision/noesis` into a directory they choose
     outside this repository. Then, with their agreement:

     ```sh
     cd <noesis>/code-parsers/dotnet
     dotnet pack src/Noesis.Parser.Cli -c Release
     dotnet tool install -g Noesis.Parser --add-source src/Noesis.Parser.Cli/bin/Release
     noesis-parse-csharp --help
     ```

     The version stays `0.1.0` across parser changes, so reinstalling means
     `dotnet tool uninstall -g Noesis.Parser` before the install line.

   The service started with this session's PATH: a tool that was not on it
   then is not found by a scan until Claude Code restarts. Say so when you
   had to install it or change the PATH.

5. **Add the package.** For every project that holds domain code, with the
   user's agreement:

   ```sh
   dotnet add <path/to/Project.csproj> package NoesisVision.Annotations
   ```

   It takes the latest version from nuget.org and respects central package
   management (`Directory.Packages.props`). When the repository restores
   only from feeds that do not mirror nuget.org (`<clear />` in a
   `nuget.config`), tell the user: the restore fails, and the scanner sees
   no attributes.

6. **Write `.noesis/settings.json`.** Create `.noesis/` if needed:

   ```json
   {
     "parser": { "language": "csharp" },
     "namespacePartsToSkip": ["MyCompany.ECommerce"],
     "namespacesToExclude": ["*.Tests.*"]
   }
   ```

   - `namespacePartsToSkip`: the namespace prefix every module shares and
     that says nothing about the domain, usually the company and product
     (`MyCompany.ECommerce` for `MyCompany.ECommerce.Sales.Pricing`).
     Propose it from the root namespaces of the projects and confirm with
     the user.
   - `namespacesToExclude`: patterns of namespaces to leave out of the
     model, where `*` stands for any number of parts. Propose the test
     projects (`*.Tests.*`) and purely technical ones the user names.

7. **Prove it.** Call `scan_system_model`. The first scan restores the
   projects' packages and loads MSBuild, so it takes a while; later ones
   reuse a cache under `.noesis/cache/`. On success, report what the model
   holds: its modules and how many building blocks it found. Before
   anything is annotated, the model has modules but no building blocks;
   say so, so an empty model does not look like a failure. On failure:
   `Cannot run noesis-parse-csharp` is step 4; anything else carries the
   end of the tool's output, so fix what it names and scan again.
8. **Tell the user what is next.** The scanner turns attributed types into
   building blocks: list the [attributes](#attributes) and offer to
   annotate the existing domain code. Do not annotate it as part of this
   setup.

## Attributes

From the `NoesisVision.Annotations` package. On a type:

| Attribute                                        | Namespace                             | Building block       |
| ------------------------------------------------ | ------------------------------------- | -------------------- |
| `[DddAggregate]`                                 | `NoesisVision.Annotations.Domain.DDD` | aggregate            |
| `[DddEntity]`                                    | `NoesisVision.Annotations.Domain.DDD` | entity               |
| `[DddValueObject]`                               | `NoesisVision.Annotations.Domain.DDD` | value object         |
| `[DddDomainService]`                             | `NoesisVision.Annotations.Domain.DDD` | domain service       |
| `[DddApplicationService]`                        | `NoesisVision.Annotations.Domain.DDD` | application service  |
| `[DddRepository]`                                | `NoesisVision.Annotations.Domain.DDD` | repository           |
| `[DddFactory]`                                   | `NoesisVision.Annotations.Domain.DDD` | factory              |
| `[DddDomainEvent]`                               | `NoesisVision.Annotations.Domain.DDD` | value object (event) |
| `[ExternalSystemIntegration]`                    | `NoesisVision.Annotations.Domain`     | external integration |
| `[Command]`, `[Query]`, `[Event]`, `[ReadModel]` | `NoesisVision.Annotations.Domain`     | value object         |

On a member: `[DomainBehavior]` and `[EntryPoint]` (`NoesisVision.Annotations.Domain`)
mark behaviors, `[Scenario]` a scenario. `[ShortDescription("…")]` and
`[ExcludeFromDocs]` (`NoesisVision.Annotations`) describe or hide an element,
and `[Actor]` (`NoesisVision.Annotations.People`) names an actor.
