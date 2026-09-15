# Noesis .NET scanner

**Placeholder. Nothing is implemented here yet**: this directory holds only
this file.

The intent is a .NET counterpart of the Java scanner in
[`scanners/java`](../java/README.md): a build-tool plugin that reads
compiled assemblies, detects DDD stereotypes through annotations (a
`Noesis.Annotations` package would mirror `noesis-annotations`), and
writes the same typed building-block graph, decision 20's node and edge
vocabulary. The vocabulary is language-neutral by design, so the two
scanners would share one contract.

Constraints already settled that apply here when work starts:

- **Layout**: a self-contained subtree with its own toolchain, outside the
  bun workspace, like `scanners/java` with its `pom.xml` (decision 21).
  CI would get its own gated job the way `java-scanner` has one.
- **Integration**: not with this migration. The service runs the
  primitive in-process scanners (TypeScript, Java; decision 76), and a
  primitive C# one written in TypeScript is the planned next; how an
  external scanner's output feeds `.noesis/system-model/` is a later
  decision, once that file format settles (decision 68, resolved point 10).
  Until then a .NET scanner here would be standalone, writing a graph file
  as the Java one does.
- **Engine and enrichment**: open. Decision 19's split (a bytecode-level
  importer for structure, a source-level pass for positions and comments)
  is the pattern to weigh, not a given.

The work starts as a task doc under `docs/work/features/` (decision 43).
