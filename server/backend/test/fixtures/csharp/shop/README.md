# C# projection fixture

A small annotated solution the C# scanner's unit tests project onto the
system model (`test/unit/csharp-scanner.spec.ts`). Every type and member is
there to show one rule of `docs/plans/code-model-to-system-model.md`: the
nested `Order.Repository`, the `[Event]` record, the `_lines`/`Lines` pair,
the dictionary property, the overloaded `AddLine`, the chain
`Handle → LogTotal → Total`, the excluded `Shop.Technical` assembly, the
`Internal` namespace `.noesis/settings.json` drops, the unannotated
`SqlOrderRepository` whose calls count for the interface's behaviours.

`code-model/` is the .NET scanner's output over these sources and is
committed, so the server's tests need no .NET. Regenerate it after changing
the sources (from this directory, with the scanner built once by
`dotnet build` in `scanners/dotnet`):

```sh
dotnet build
dotnet ../../../../../scanners/dotnet/src/Noesis.Scanner.Cli/bin/Debug/net10.0/noesis-scan-csharp.dll . \
  --out . --repository-root . --repository shop --revision fixture
```
