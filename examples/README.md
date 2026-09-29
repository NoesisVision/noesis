# Examples

Two sample repositories with their code annotated for the Noesis scanners and a
knowledge graph under `.noesis/`, the material the loop tests of 2026 ran on.
They are plain copies, not git submodules; nothing in them builds as part of
this monorepo.

| Directory           | What it is                                                                                                                                                                                                                                                                                                                                                   | Knowledge graph                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `discounts-java/`   | Gradle, Java 25. Domain types carry `vision.noesis.annotations` stereotypes (`@ValueObject`, `@DomainService`, `@Port`, `@Adapter`).                                                                                                                                                                                                                         | One change, `weather-based-discount`, with its sealed design document, the spec and the handover notes of the loop test. |
| `discounts-dotnet/` | .NET 8, one solution. The `Sales` domain of the [itlibrium DDD starter](https://github.com/itlibrium/DDD-starter-dotnet), annotated with `NoesisVision.Annotations` attributes: orders, pricing, discounts, offers, products, clients, plus its unit tests and the one `TechnicalStuff` project it compiles against. No adapters, persistence or migrations. | One change, `threshold-activated-discount`: its design document, the sales spec and the review meeting notes.            |

Only the knowledge graph is read today. Scanning the code comes back once the
code model is finished; the annotations are already in place for it.

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

To drive the same example through the plugin, run Claude Code inside it with
the service from this checkout:

```sh
bun run build:plugin
cd examples/discounts-dotnet
NOESIS_SERVICE_COMMAND=bun \
NOESIS_SERVICE_ENTRY=$PWD/../../server/backend/src/main.ts \
claude --plugin-dir $PWD/../../plugins/claude-code
```

`bun run test:e2e` covers both examples: every change, design document and
document in them must be served.

## Building the examples themselves

Neither is needed for the app, only for working on the sample code. Each is
its sources, its build files and its scanner config (`noesis-config.json`),
nothing else: no CI, build scripts, IDE settings or notes from the runs.

- `discounts-java` depends on `vision.noesis:noesis-annotations:0.1.0-SNAPSHOT`
  from `mavenLocal()`: run `mvn install` in `scanners/java` first, then
  `./gradlew build` in the example.
- `discounts-dotnet` takes `NoesisVision.Annotations` from the private NuGet
  feed in its `nuget.config`; `dotnet build MyCompany.ECommerce.sln` builds it
  (net8.0). It is a library and its tests, nothing runs.
