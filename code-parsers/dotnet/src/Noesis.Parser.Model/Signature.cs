namespace Noesis.Parser.Model;

public sealed record Signature(
    IReadOnlyList<Parameter> Parameters,
    TypeRef ReturnType,
    Passing ReturnPassing,
    IReadOnlyList<Annotation> ReturnAnnotations);