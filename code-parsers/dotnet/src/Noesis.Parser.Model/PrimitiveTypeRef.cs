namespace Noesis.Parser.Model;

/// <summary>A type the language spells with a keyword and treats as built in, written with that keyword.</summary>
public sealed record PrimitiveTypeRef(string Name, bool Nullable) : TypeRef;