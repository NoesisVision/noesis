namespace Noesis.Parser.Model;

public sealed record StructuralTypeRef(IReadOnlyList<StructuralMember> Members) : TypeRef;