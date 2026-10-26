namespace Noesis.Parser.Model;

public sealed record TypeConstraint(TypeRef Type) : TypeParameterConstraint;