namespace Noesis.Parser.Model;

public sealed record ArrayTypeRef(TypeRef Element, int Rank, bool Nullable) : TypeRef;