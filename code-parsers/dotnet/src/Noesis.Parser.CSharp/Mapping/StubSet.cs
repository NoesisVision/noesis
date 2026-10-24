using Noesis.Parser.Model;

namespace Noesis.Parser.CSharp.Mapping;

internal sealed record StubSet(IReadOnlyList<StubNode> Stubs, IReadOnlyList<Edge> Edges);