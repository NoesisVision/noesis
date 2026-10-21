namespace Noesis.Scanner.Model;

/// <summary>A name the front end could not bind: the source text.</summary>
public sealed record UnresolvedTypeRef(string Text) : TypeRef;