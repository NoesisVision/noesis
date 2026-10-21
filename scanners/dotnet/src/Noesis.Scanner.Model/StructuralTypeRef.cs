namespace Noesis.Scanner.Model;

public sealed record StructuralTypeRef(IReadOnlyList<StructuralMember> Members) : TypeRef;