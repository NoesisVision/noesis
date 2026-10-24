namespace Noesis.Parser.Model;

public sealed record TypeParameter(
    string Name,
    int Ordinal,
    IReadOnlyList<Annotation> Annotations,
    Variance Variance,
    IReadOnlyList<TypeParameterConstraint> Constraints,
    LanguageBag LanguageSpecific);