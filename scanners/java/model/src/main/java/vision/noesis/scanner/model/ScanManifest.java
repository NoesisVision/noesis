package vision.noesis.scanner.model;

import java.util.List;

/** What the server opens first: every file the scan produced, in dependency order. */
public record ScanManifest(
        int schemaVersion,
        Generator generator,
        Language language,
        RepositoryInfo repository,
        String root,
        List<ManifestArtifact> artifacts,
        List<Diagnostic> diagnostics) {

    public static final int CURRENT_SCHEMA_VERSION = 1;
}
