namespace Noesis.Parser.Model;

public sealed record PointerTypeRef(TypeRef Pointee) : TypeRef;