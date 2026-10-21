namespace Noesis.Scanner.Model;

public sealed record ArtifactDependency(NodeId Id, ArtifactKind Kind, PackageReference? Package);