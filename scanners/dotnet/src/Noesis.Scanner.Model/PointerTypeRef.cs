namespace Noesis.Scanner.Model;

public sealed record PointerTypeRef(TypeRef Pointee) : TypeRef;