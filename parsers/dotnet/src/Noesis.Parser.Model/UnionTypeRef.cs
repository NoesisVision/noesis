namespace Noesis.Parser.Model;

public sealed record UnionTypeRef(IReadOnlyList<TypeRef> Members) : TypeRef;