package vision.noesis.parser.core;

import java.nio.file.Path;
import vision.noesis.parser.model.ArtifactDependency;

/**
 * One classpath element (a jar or a class directory) and the artifact it belongs to.
 *
 * @param testOnly on the test classpath alone: a library only the test sources use is a dependency of the artifact only
 *                 when the model references it, so a test framework's own dependencies stay out of the module's
 */
public record ClasspathEntry(Path path, ArtifactDependency dependency, boolean testOnly) {

    public ClasspathEntry(Path path, ArtifactDependency dependency) {
        this(path, dependency, false);
    }
}
