namespace Noesis.Parser.Model;

public sealed record TupleTypeRef(IReadOnlyList<TupleElement> Elements) : TypeRef;