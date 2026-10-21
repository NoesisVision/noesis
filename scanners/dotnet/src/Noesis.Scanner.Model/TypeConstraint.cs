namespace Noesis.Scanner.Model;

public sealed record TypeConstraint(TypeRef Type) : TypeParameterConstraint;