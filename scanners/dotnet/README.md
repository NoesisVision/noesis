# Noesis .NET scanner

**Placeholder. Nothing is implemented here yet**: this directory holds only
this file.

Meanwhile the service has a text-level C# scanner of its own, in
`server/backend/src/adapters/out/scanners/csharp/` (`NOESIS_SCANNER=csharp`).
It reads `.cs` files without compiling them: namespaces become modules
(mapped by `noesis-config.json`), types marked with a `Ddd*` attribute become
building blocks and their public methods behaviours. It finds no properties,
parameters or relations; that is what a compiler-backed scanner here would add.

The intent is a .NET counterpart of the Java scanner in
[`scanners/java`](../java/README.md): a build-tool plugin that reads
compiled assemblies, detects DDD stereotypes through annotations (a
`Noesis.Annotations` package would mirror `noesis-annotations`), and
writes the same typed building-block graph, the Java scanner's node and edge
vocabulary. The vocabulary is language-neutral by design, so the two
scanners would share one contract.

Constraints already settled that apply here when work starts:

- **Layout**: a self-contained subtree with its own toolchain, outside the
  bun workspace, like `scanners/java` with its `pom.xml`.
  CI would get its own gated job the way `java-scanner` has one.
- **Integration**: not with this migration. The service runs only the
  TypeScript scanner in `server/backend`; how an external scanner's output
  feeds `.noesis/graph/system-models/` is a later decision, once that file format
  settles. Until then a .NET scanner would
  be standalone, writing a graph file as the Java one does.
- **Engine and enrichment**: open. The Java scanner's split (a bytecode-level
  importer for structure, a source-level pass for positions and comments)
  is the pattern to weigh, not a given.
