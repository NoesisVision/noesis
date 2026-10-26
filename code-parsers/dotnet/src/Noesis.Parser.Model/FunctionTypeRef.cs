namespace Noesis.Parser.Model;

public sealed record FunctionTypeRef(Signature Signature, string? CallingConvention) : TypeRef;