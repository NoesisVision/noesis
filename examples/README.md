# Examples

Three sample repositories, each with a knowledge graph under `.noesis/`. The
two `discounts-*` ones have their code annotated for the Noesis scanners, the
material the loop tests of 2026 ran on; `qdoc-java` has no code yet, only the
requirements its design starts from. They are plain copies, not git
submodules; nothing in them builds as part of this monorepo.

| Directory           | What it is                                                                                                                                                                                                                                                                                                                                                   | Knowledge graph                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discounts-java/`   | Gradle, Java 25. Domain types carry `vision.noesis.annotations` stereotypes (`@ValueObject`, `@DomainService`, `@Repository`, `@Adapter`).                                                                                                                                                                                                                   | `discounts-as-built`, the code as it stands in a sealed design document, then `weather-based-discount`, the next increment: its design document, the spec and the handover notes of the loop test. One scanned system model. |
| `discounts-dotnet/` | .NET 8, one solution. The `Sales` domain of the [itlibrium DDD starter](https://github.com/itlibrium/DDD-starter-dotnet), annotated with `NoesisVision.Annotations` attributes: orders, pricing, discounts, offers, products, clients, plus its unit tests and the one `TechnicalStuff` project it compiles against. No adapters, persistence or migrations. | `sales-as-built`, the code as it stands in a sealed design document, then `threshold-activated-discount`, the next increment: its design document, the sales spec and the review meeting notes.                              |
| `qdoc-java/`        | No code yet: the business requirements for drafting quality documents (QDocs), from a domain discovery session.                                                                                                                                                                                                                                              | No changes yet, only a system model: the requirements are plain Markdown files beside it, to be added to a change through the plugin.                                                                                        |

## Trying the app on an example

From the repository root, after `bun install`, build the page once, then
point the service at an example:

```sh
bun run --cwd server/frontend build:spa
NOESIS_ROOT=$PWD/examples/discounts-java bun server/backend/src/main.ts
```

A terminal on stdin starts the page at once and opens the browser on it
(`NOESIS_OPEN_BROWSER=0` keeps it closed; the URL is in the "listening on"
log line). Swap in `discounts-dotnet` for the other example. Ctrl-C ends it.

To work on the app with reloading, run the dev servers against an example
instead. The backend (port 3001, watch mode, browser kept closed) and Vite both
inherit `NOESIS_ROOT`; open the URL Vite prints:

```sh
bun run dev:discounts-java      # or dev:discounts-dotnet, dev:qdoc-java
```

Each is `bun run dev` with `NOESIS_ROOT` set to that example.

Scanning `discounts-dotnet` (the Scan button, or `scan_system_model`) runs the
`noesis-scan-csharp` tool from the PATH. Install it once from this checkout
(see [`scanners/dotnet/README.md`](../scanners/dotnet/README.md)):

```sh
cd scanners/dotnet
dotnet pack src/Noesis.Scanner.Cli -c Release
dotnet tool install -g Noesis.Scanner --add-source src/Noesis.Scanner.Cli/bin/Release
```

Without it a scan fails with `Cannot run noesis-scan-csharp`. The first scan
restores the example's packages and loads MSBuild, so it takes a while; later
ones take a few seconds. Scanning `discounts-java` runs `./gradlew noesisScan`
in the example, which needs the `vision.noesis.scanner` Gradle plugin in the
local Maven repository (see below) and a JDK.

Both commands need a terminal on stdin. Without one (a background job, a CI
step, an agent's shell) the service takes stdin for MCP and quits when it
closes; give it a pseudo-terminal that stays open:

```sh
tail -f /dev/null | NOESIS_ROOT=$PWD/examples/discounts-java script -q /dev/null bun run dev
```

That is the macOS `script`; on Linux it is
`script -qc 'bun run dev' /dev/null`.

To drive the same example through the plugin, build it once, then start
Claude Code inside the example with the plugin from this checkout:

```sh
bun run build:plugin
cd examples/discounts-dotnet
claude --plugin-dir ../../plugins/claude-code
```

Each example's `.claude/settings.json` sets `NOESIS_SERVICE_COMMAND` and
`NOESIS_SERVICE_ENTRY`, so the plugin runs the service from this checkout.
Each `discounts-*` example names its scanner in `.noesis/settings.json`, which a
scan reads every time: `discounts-dotnet` says `"csharp"`, `discounts-java`
says `"code-model"` with the `./gradlew noesisScan` command line to run in its
`codeModel` block, `qdoc-java` says `"java-maven"`, which runs the Maven
plugin through its `mvnw`. `qdoc-java` has no domain code yet, so its scan finds an empty
model. Nothing but that file picks the scanner; no environment variable does.

`bun run test:e2e` covers the two `discounts-*` examples: every change,
design document and document in them must be served.

## Building the examples themselves

Only the two `discounts-*` examples have code to build, and neither build is
needed for the app, only for working on the sample code. Each is its sources,
its build files, its scanner config (`.noesis/settings.json`) and the
`.claude/settings.json` that points the plugin at this checkout's service,
nothing else: no CI, build scripts, IDE settings or notes from the runs.

- `discounts-java` depends on `vision.noesis:noesis-annotations:0.1.0-SNAPSHOT`
  and applies the `vision.noesis.scanner` Gradle plugin, both from
  `mavenLocal()`: run `mvn install` in `scanners/java` and
  `./gradlew publishToMavenLocal` in `scanners/java/gradle-plugin` first, then
  `./gradlew build` in the example. `./gradlew noesisScan` there scans the
  example into the code model under `.noesis/sessions/scanner/code-model/java/`
  with the hybrid engine (its sources use Lombok); a scan from the service
  runs the same command through its `.noesis/settings.json`.
- `qdoc-java` is a Spring Boot Maven project that depends on
  `vision.noesis:noesis-annotations:0.1.0-SNAPSHOT` and declares the
  `noesis-scanner-maven-plugin`, both from the local repository: run
  `mvn install` in `scanners/java` first, then `./mvnw process-classes noesis:scan`
  in the example writes the code model under
  `.noesis/sessions/scanner/code-model/java/`; a scan from the service runs the
  plugin the same way through its `.noesis/settings.json`.
- `discounts-dotnet` takes `NoesisVision.Annotations` from the private NuGet
  feed in its `nuget.config`; `dotnet build MyCompany.ECommerce.sln` builds it
  (net8.0). It is a library and its tests, nothing runs.
