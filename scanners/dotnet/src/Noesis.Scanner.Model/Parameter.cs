namespace Noesis.Scanner.Model;

public sealed record Parameter(
    string Name,
    TypeRef Type,
    Passing Passing,
    bool Variadic,
    bool Optional,
    string? DefaultValue,
    IReadOnlyList<Annotation> Annotations,
    LanguageBag LanguageSpecific);