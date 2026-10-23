package vision.noesis.scanner.model;

public record ArtifactDependency(NodeId id, ArtifactKind kind, PackageReference packageReference) {

    @com.fasterxml.jackson.annotation.JsonProperty("package")
    @Override
    public PackageReference packageReference() {
        return packageReference;
    }
}
