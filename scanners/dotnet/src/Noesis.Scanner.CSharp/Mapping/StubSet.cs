using Noesis.Scanner.Model;

namespace Noesis.Scanner.CSharp.Mapping;

internal sealed record StubSet(IReadOnlyList<StubNode> Stubs, IReadOnlyList<Edge> Edges);