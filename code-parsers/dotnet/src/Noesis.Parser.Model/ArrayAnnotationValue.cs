namespace Noesis.Parser.Model;

public sealed record ArrayAnnotationValue(IReadOnlyList<AnnotationValue> Items) : AnnotationValue;