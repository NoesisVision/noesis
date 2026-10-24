namespace Noesis.Parser.Model;

public sealed record IntersectionTypeRef(IReadOnlyList<TypeRef> Members) : TypeRef;