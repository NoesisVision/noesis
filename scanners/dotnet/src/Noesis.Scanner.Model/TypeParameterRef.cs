namespace Noesis.Scanner.Model;

/// <param name="Ordinal">CLR-flattened: containing types' parameters count first.</param>
public sealed record TypeParameterRef(NodeId Owner, int Ordinal, bool Nullable) : TypeRef;