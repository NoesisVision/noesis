# Examples

Three sample repositories, each with a knowledge graph under `.noesis/`. The
two `discounts-*` ones have their code annotated for the Noesis scanners, the
material the loop tests of 2026 ran on; `qdoc-java` has no code yet, only the
requirements its design starts from. They are plain copies, not git
submodules; nothing in them builds as part of this monorepo.

| Directory           | What it is                                                                                                                                                                                                                                                                                                                                                   | Knowledge graph                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discounts-java/`   | Gradle, Java 25. Domain types carry `vision.noesis.annotations` stereotypes (`@ValueObject`, `@DomainService`, `@Port`, `@Adapter`).                                                                                                                                                                                                                         | One change, `weather-based-discount`, with its sealed design document, the spec and the handover notes of the loop test; one scanned system model.   |
| `discounts-dotnet/` | .NET 8, one solution. The `Sales` domain of the [itlibrium DDD starter](https://github.com/itlibrium/DDD-starter-dotnet), annotated with `NoesisVision.Annotations` attributes: orders, pricing, discounts, offers, products, clients, plus its unit tests and the one `TechnicalStuff` project it compiles against. No adapters, persistence or migrations. | One change, `threshold-activated-discount`: its design document, the sales spec and the review meeting notes.                                        |
| `qdoc-java/`        | No code yet: the business requirements for drafting quality documents (QDocs), from a domain discovery session.                                                                                                                                                                                                                                              | One change, `qdoc-preparation`: the requirements document and two alternative design documents, small aggregates linked by id or one QDoc aggregate. |

The Java example also carries the system model the `java` scanner found in
its code (`.noesis/graph/system-models/`); `test/integration/java-scanner-discounts.spec.ts`
keeps the scanner finding exactly that model. The .NET example is read for
its knowledge graph only until a C# scanner exists.

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

To drive the same example through the plugin, build it once, then start
Claude Code inside the example with the plugin from this checkout:

```sh
bun run build:plugin
cd examples/discounts-dotnet
claude --plugin-dir ../../plugins/claude-code
```

Each example's `.claude/settings.json` sets `NOESIS_SERVICE_COMMAND` and
`NOESIS_SERVICE_ENTRY`, so the plugin runs the service from this checkout;
`discounts-java` also sets `NOESIS_SCANNER=java`, so `scan_system_model` there
reads the code rather than replaying design documents.

`bun run test:e2e` covers the two `discounts-*` examples: every change,
design document and document in them must be served.

## Building the examples themselves

Only the two `discounts-*` examples have code to build, and neither build is
needed for the app, only for working on the sample code. Each is its sources,
its build files, its scanner config (`noesis-config.json`) and the
`.claude/settings.json` that points the plugin at this checkout's service,
nothing else: no CI, build scripts, IDE settings or notes from the runs.

- `discounts-java` depends on `vision.noesis:noesis-annotations:0.1.0-SNAPSHOT`
  from `mavenLocal()`: run `mvn install` in `scanners/java` first, then
  `./gradlew build` in the example.
- `discounts-dotnet` takes `NoesisVision.Annotations` from the private NuGet
  feed in its `nuget.config`; `dotnet build MyCompany.ECommerce.sln` builds it
  (net8.0). It is a library and its tests, nothing runs.
