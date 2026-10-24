package vision.noesis.parser.model;

import java.util.List;

/** What the server opens first: every file the parse produced, in dependency order. */
public record ParseManifest(
        int schemaVersion,
        Generator generator,
        Language language,
        RepositoryInfo repository,
        String root,
        List<ManifestArtifact> artifacts,
        List<Diagnostic> diagnostics) {

    public static final int CURRENT_SCHEMA_VERSION = 1;
}
