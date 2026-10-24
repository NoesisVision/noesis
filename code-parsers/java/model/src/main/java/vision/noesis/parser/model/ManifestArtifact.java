package vision.noesis.parser.model;

/** One source artifact of the parse and its model file, relative to the output root. */
public record ManifestArtifact(NodeId id, String file) {}
