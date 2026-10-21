namespace Noesis.Scanner.Model;

public sealed record UnionTypeRef(IReadOnlyList<TypeRef> Members) : TypeRef;