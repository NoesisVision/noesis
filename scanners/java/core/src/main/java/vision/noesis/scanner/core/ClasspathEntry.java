package vision.noesis.scanner.core;

import java.nio.file.Path;
import vision.noesis.scanner.model.ArtifactDependency;

/** One compile classpath element (a jar or a class directory) and the artifact it belongs to. */
public record ClasspathEntry(Path path, ArtifactDependency dependency) {}
