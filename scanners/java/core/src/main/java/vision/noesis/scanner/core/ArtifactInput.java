package vision.noesis.scanner.core;

import java.nio.charset.Charset;
import java.nio.file.Path;
import java.util.List;

/**
 * Everything an engine needs to scan one artifact (a Maven module): where its sources and classes are, what it was
 * compiled against, and how the build names it.
 *
 * @param rootDirectory   the module's base directory
 * @param buildFile       the module's build file, null when there is none
 * @param sourceRoots     compile source roots, generated sources included
 * @param outputDirectory where the compiled classes are ({@code target/classes})
 * @param classpath       the compile classpath, each element with the artifact it belongs to
 * @param release         the Java release the sources are written for
 * @param packaging       the build's packaging ({@code jar}, {@code war})
 * @param mainClass       the configured main class, null when the artifact is not executable
 */
public record ArtifactInput(
        String groupId,
        String artifactId,
        String version,
        Path rootDirectory,
        Path buildFile,
        List<Path> sourceRoots,
        Path outputDirectory,
        List<ClasspathEntry> classpath,
        int release,
        Charset encoding,
        String packaging,
        String mainClass) {

    public boolean executable() {
        return mainClass != null;
    }
}
