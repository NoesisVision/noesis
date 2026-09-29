# Examples

Two sample repositories with their code annotated for the Noesis scanners and a
knowledge graph under `.noesis/`, the material the loop tests of 2026 ran on.
They are plain copies, not git submodules; nothing in them builds as part of
this monorepo.

| Directory             | What it is                                                                                                                                                                                                                                                                                                            | Knowledge graph                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `discounts-java/`     | Gradle, Java 25. Domain types carry `vision.noesis.annotations` stereotypes (`@ValueObject`, `@DomainService`, `@Port`, `@Adapter`).                                                                                                                                                                                  | One change, `weather-based-discount`, with its sealed design document, the spec and the handover notes of the loop test. |
| `ddd-starter-dotnet/` | The domain of the itlibrium DDD starter, annotated with `NoesisVision.Annotations` attributes: the deep and process models of Sales, Contacts, Payments, RiskManagement and ProductsDelivery, their unit tests, and the five `TechnicalStuff` projects they compile against. No adapters, startups or infrastructure. | One change, `threshold-activated-discount`: its design document, the sales spec and the review meeting notes.            |

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
log line). Swap in `ddd-starter-dotnet` for the other example. Ctrl-C ends it.

To work on the app with reloading, run the dev servers against an example
instead. The backend (port 3001, watch mode, browser kept closed) and Vite both
inherit `NOESIS_ROOT`; open the URL Vite prints:

```sh
NOESIS_ROOT=$PWD/examples/discounts-java bun run dev
```

Both commands need a terminal on stdin. Without one (a background job, a CI
step, an agent's shell) the service takes stdin for MCP and quits when it
closes; give it a pseudo-terminal that stays open:

```sh
tail -f /dev/null | NOESIS_ROOT=$PWD/examples/discounts-java script -q /dev/null bun run dev
```

That is the macOS `script`; on Linux it is
`script -qc 'bun run dev' /dev/null`.

To drive the same example through the plugin, run Claude Code inside it with
the service from this checkout:

```sh
bun run build:plugin
cd examples/ddd-starter-dotnet
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
- `ddd-starter-dotnet` takes `NoesisVision.Annotations` from the private NuGet
  feed in its `nuget.config`; `dotnet build MyCompany.ECommerce.sln` builds it
  (net8.0). It compiles but does not run: the startups went with the
  adapters.
