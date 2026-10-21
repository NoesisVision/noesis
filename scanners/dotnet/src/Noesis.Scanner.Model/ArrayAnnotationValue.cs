namespace Noesis.Scanner.Model;

public sealed record ArrayAnnotationValue(IReadOnlyList<AnnotationValue> Items) : AnnotationValue;