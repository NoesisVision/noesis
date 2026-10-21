namespace Noesis.Scanner.Model;

public sealed record IntersectionTypeRef(IReadOnlyList<TypeRef> Members) : TypeRef;