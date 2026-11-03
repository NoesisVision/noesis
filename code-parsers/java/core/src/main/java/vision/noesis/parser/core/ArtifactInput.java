package vision.noesis.parser.core;

import java.nio.charset.Charset;
import java.nio.file.Path;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;
import vision.noesis.parser.core.java.JavaIds;
import vision.noesis.parser.model.NodeId;

/**
 * Everything an engine needs to parse one artifact (a Maven module): where its sources and classes are, what it was
 * compiled against, and how the build names it.
 *
 * @param rootDirectory   the module's base directory
 * @param buildFile       the module's build file, null when there is none
 * @param sourceRoots     compile source roots, generated sources included, then the test source roots when the module's
 *                        tests are parsed too: one artifact holds both, as one Maven module or Gradle project does
 * @param outputDirectory where the compiled classes are ({@code target/classes})
 * @param classpath       the compile classpath, each element with the artifact it belongs to; the test classpath when the
 *                        tests are parsed, without the module's own class directories
 * @param release         the Java release the sources are written for
 * @param packaging       the build's packaging ({@code jar}, {@code war})
 * @param mainClass       the configured main class, null when the artifact is not executable
 * @param uniqueName      the module's name in its artifact id: {@code artifactId}, qualified when another module of the
 *                        same build has that artifact id too ({@link JavaIds#moduleName})
 * @param buildDirectory  the build's working directory ({@code target}, {@code build}); a source under it was generated
 *                        by the build. The parent of {@code outputDirectory} when not given, which is Maven's layout but
 *                        not Gradle's ({@code build/classes/java/main})
 * @param testOutputDirectory where the compiled test classes are ({@code target/test-classes}); null when the tests are
 *                        not parsed
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
        String mainClass,
        String uniqueName,
        Path buildDirectory,
        Path testOutputDirectory) {

    public ArtifactInput {
        if (uniqueName == null) uniqueName = artifactId;
        if (buildDirectory == null && outputDirectory != null) buildDirectory = outputDirectory.toAbsolutePath().normalize().getParent();
    }

    /** A module whose tests are not parsed. */
    public ArtifactInput(String groupId, String artifactId, String version, Path rootDirectory, Path buildFile, List<Path> sourceRoots,
                         Path outputDirectory, List<ClasspathEntry> classpath, int release, Charset encoding, String packaging, String mainClass,
                         String uniqueName, Path buildDirectory) {
        this(groupId, artifactId, version, rootDirectory, buildFile, sourceRoots, outputDirectory, classpath, release, encoding, packaging, mainClass, uniqueName, buildDirectory, null);
    }

    /** A module whose build directory is the parent of its output directory, as in Maven's layout. */
    public ArtifactInput(String groupId, String artifactId, String version, Path rootDirectory, Path buildFile, List<Path> sourceRoots,
                         Path outputDirectory, List<ClasspathEntry> classpath, int release, Charset encoding, String packaging, String mainClass,
                         String uniqueName) {
        this(groupId, artifactId, version, rootDirectory, buildFile, sourceRoots, outputDirectory, classpath, release, encoding, packaging, mainClass, uniqueName, null, null);
    }

    /** A module whose artifact id no other module of its build shares. */
    public ArtifactInput(String groupId, String artifactId, String version, Path rootDirectory, Path buildFile, List<Path> sourceRoots,
                         Path outputDirectory, List<ClasspathEntry> classpath, int release, Charset encoding, String packaging, String mainClass) {
        this(groupId, artifactId, version, rootDirectory, buildFile, sourceRoots, outputDirectory, classpath, release, encoding, packaging, mainClass, artifactId, null, null);
    }

    /** The directories the module compiled into: its classes, then its test classes when the tests are parsed. */
    public List<Path> classDirectories() {
        return Stream.of(outputDirectory, testOutputDirectory).filter(Objects::nonNull).toList();
    }

    public boolean executable() {
        return mainClass != null;
    }

    /** {@code A:<uniqueName>}. */
    public NodeId id() {
        return JavaIds.artifact(uniqueName);
    }
}
