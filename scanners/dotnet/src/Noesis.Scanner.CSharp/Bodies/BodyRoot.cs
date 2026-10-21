using Microsoft.CodeAnalysis;

namespace Noesis.Scanner.CSharp.Bodies;

/// <summary>One member body or initializer to walk: the symbol it belongs to and the root operation.</summary>
internal sealed record BodyRoot(ISymbol Owner, IOperation Operation);