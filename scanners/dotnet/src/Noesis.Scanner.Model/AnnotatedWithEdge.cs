namespace Noesis.Scanner.Model;

public sealed record AnnotatedWithEdge : Edge
{
    public required Annotation Annotation { get; init; }
}