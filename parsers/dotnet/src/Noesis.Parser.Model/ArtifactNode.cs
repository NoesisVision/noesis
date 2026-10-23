namespace Noesis.Parser.Model;

/// <param name="Name">The name references bind to: assembly name, Maven artifactId, npm package name.</param>
/// <param name="Target">The platform the declarations were bound against: `net10.0`, `jdk-21`.</param>
public sealed record ArtifactNode(
    NodeId Id,
    ArtifactKind Kind,
    string Name,
    string? Version,
    string? RootDirectory,
    string Target,
    bool Executable,
    IReadOnlyList<ArtifactDependency> Dependencies,
    IReadOnlyList<Annotation> Annotations,
    LanguageBag LanguageSpecific);