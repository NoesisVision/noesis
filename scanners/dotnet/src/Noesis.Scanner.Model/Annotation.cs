namespace Noesis.Scanner.Model;

public sealed record Annotation(TypeRef Type, IReadOnlyList<AnnotationArgument> Arguments);