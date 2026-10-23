namespace Noesis.Parser.Model;

/// <summary>Always named by the parameter or element, so positional and named spellings read the same.</summary>
public sealed record AnnotationArgument(string Name, bool Positional, AnnotationValue Value);