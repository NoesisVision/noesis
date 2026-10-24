namespace Noesis.Parser.Model;

public sealed record ArtifactDependency(NodeId Id, ArtifactKind Kind, PackageReference? Package);