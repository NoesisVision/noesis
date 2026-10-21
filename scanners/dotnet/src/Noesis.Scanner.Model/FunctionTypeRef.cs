namespace Noesis.Scanner.Model;

public sealed record FunctionTypeRef(Signature Signature, string? CallingConvention) : TypeRef;