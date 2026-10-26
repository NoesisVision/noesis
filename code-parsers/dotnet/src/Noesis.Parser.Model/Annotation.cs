namespace Noesis.Parser.Model;

public sealed record Annotation(TypeRef Type, IReadOnlyList<AnnotationArgument> Arguments);