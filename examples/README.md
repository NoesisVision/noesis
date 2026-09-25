# Examples

Two sample repositories with their code annotated for the Noesis scanners and a
knowledge graph under `.noesis/`, the material the loop tests of 2026 ran on.
They are plain copies, not git submodules; nothing in them builds as part of
this monorepo.

| Directory             | What it is                                                                                                                           | Knowledge graph                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discounts-java/`     | Gradle, Java 25. Domain types carry `vision.noesis.annotations` stereotypes (`@ValueObject`, `@DomainService`, `@Port`, `@Adapter`). | One change, `weather-based-discount`, with its sealed design document, the spec and the handover notes of the loop test.                                                |
| `ddd-starter-dotnet/` | The itlibrium DDD starter, annotated with `NoesisVision.Annotations` attributes.                                                     | Two changes: `order-persistence-and-risk-integration` (design and the review transcript it came from) and `threshold-activated-discount` (design, spec, meeting notes). |

Only the knowledge graph is read today. Scanning the code comes back once the
code model is finished; the annotations are already in place for it.

## Trying the app on an example

From the repository root, after `bun install`:

```sh
NOESIS_ROOT=$PWD/examples/discounts-java bun server/backend/src/main.ts
```

A terminal on stdin starts the page at once and opens the browser on it
(`NOESIS_OPEN_BROWSER=0` keeps it closed; the URL is in the "listening on"
log line). Swap in `ddd-starter-dotnet` for the other example. Ctrl-C ends it.

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

Neither is needed for the app, only for working on the sample code.

- `discounts-java` depends on `vision.noesis:noesis-annotations:0.1.0-SNAPSHOT`
  from `mavenLocal()`: run `mvn install` in `scanners/java` first, then
  `./gradlew build` in the example.
- `ddd-starter-dotnet` takes `NoesisVision.Annotations` from the private NuGet
  feed in its `nuget.config`. Its `Build/` scripts are committed; the dev
  certificates under `Build/Nuke/Certs` are not (the root ignores `*.pem`).

## Provenance

- `discounts-java`: branch `impl-opus` of `szjanikowski/discounts-java` (commit
  `8b5f543`), the annotated baseline plus the Opus implementation of the
  weather discount. `noesis-work/` keeps the scans and notes of that run.
- `ddd-starter-dotnet`: `NoesisVision/DDD-starter-dotnet` at `36263d0`, with
  the uncommitted design documents of the working tree. The order persistence
  design was generated six times on 2026-05-05 while the design-doc skill was
  being tuned on the architecture review of 2026-02-18; only the last run is
  kept, under a readable name, with the review transcript beside it.

The design documents were written by the SDLC-era plugin as nested bounded
contexts with `*_locked` flags and migrated to the change-set model keyed by
element ids (`module|`, `building_block|`, `behavior|`). A bounded context
became the root module, a `*_locked` flag became `reviewedByHuman`, and
building-block references were resolved against the document first and the
code second (`Money` and `Percentage` sit in `Sales.Commons`, `ClientId` in
`Sales.Clients`). Quality attributes, actors and the document date have no
counterpart in the new model and were dropped; four scenario names had a `.`
replaced by `/`, which the element-name rule forbids.
