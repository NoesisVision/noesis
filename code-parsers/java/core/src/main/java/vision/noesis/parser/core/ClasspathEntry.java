package vision.noesis.parser.core;

import java.nio.file.Path;
import vision.noesis.parser.model.ArtifactDependency;

/** One compile classpath element (a jar or a class directory) and the artifact it belongs to. */
public record ClasspathEntry(Path path, ArtifactDependency dependency) {}
