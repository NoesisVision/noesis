package vision.noesis.scanner.core;

import java.nio.file.Path;
import java.util.List;

/**
 * What one scan covers and where it writes.
 *
 * @param repositoryRoot  the directory file paths are written relative to
 * @param root            repository-relative path of what was scanned, as the manifest reports it
 * @param outputDirectory the output root; the files land under {@code code-model/java/} inside it
 * @param artifacts       the modules to scan, in dependency order
 */
public record ScanRequest(
        Path repositoryRoot,
        String repositoryName,
        String revision,
        String root,
        Path outputDirectory,
        EngineKind engine,
        List<ArtifactInput> artifacts) {}
