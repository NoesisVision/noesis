package vision.noesis.scanner.model;

/** One source artifact of the scan and its model file, relative to the output root. */
public record ManifestArtifact(NodeId id, String file) {}
