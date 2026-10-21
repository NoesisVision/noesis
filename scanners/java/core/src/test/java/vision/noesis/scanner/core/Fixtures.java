package vision.noesis.scanner.core;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import vision.noesis.scanner.core.java.JavaIds;
import vision.noesis.scanner.model.ArtifactDependency;
import vision.noesis.scanner.model.ArtifactKind;
import vision.noesis.scanner.model.PackageReference;

/** The fixture modules under {@code test-fixtures/}, scanned once per engine the way the Maven plugin would hand them over. */
public final class Fixtures {

    public static final String REPOSITORY_NAME = "noesis";
    public static final String REVISION = "0123456789abcdef";
    public static final String GENERATOR_VERSION = "1.0.0";
    public static final String MAIN_CLASS = "vision.noesis.fixture.syntax.Program";

    public static final Path REPOSITORY_ROOT = Path.of(System.getProperty("noesis.repositoryRoot", "../../..")).toAbsolutePath().normalize();
    public static final Path FIXTURES = Path.of(System.getProperty("noesis.fixturesDir", "../test-fixtures")).toAbsolutePath().normalize();
    public static final Path SCHEMAS = Path.of(System.getProperty("noesis.schemaDir", "../../code-model")).toAbsolutePath().normalize();
    public static final Path MODULE_DIR = Path.of(System.getProperty("basedir", ".")).toAbsolutePath().normalize();

    private static ScanResult source;
    private static ScanResult bytecode;

    private Fixtures() {}

    public static synchronized ScanResult source() {
        if (source == null) source = new JavaScanner(GENERATOR_VERSION).scan(request(EngineKind.SOURCE));
        return source;
    }

    public static synchronized ScanResult bytecode() {
        if (bytecode == null) bytecode = new JavaScanner(GENERATOR_VERSION).scan(request(EngineKind.BYTECODE));
        return bytecode;
    }

    public static ScanRequest request(EngineKind engine) {
        return request(engine, MODULE_DIR.resolve("target/fixture-scan").resolve(engine.id()));
    }

    public static ScanRequest request(EngineKind engine, Path output) {
        ClasspathEntry annotations = library("noesis.classpath.annotations", "vision.noesis:noesis-annotations", "0.1.0-SNAPSHOT");
        ClasspathEntry guava = library("noesis.classpath.guava", "com.google.guava:guava", System.getProperty("noesis.version.guava"));
        ClasspathEntry other = new ClasspathEntry(classpathEntry("noesis.classpath.other"), new ArtifactDependency(JavaIds.artifact("java-syntax-other"), ArtifactKind.SOURCE, null));
        ArtifactInput otherModule = module("java-syntax-other", List.of(annotations), null);
        ArtifactInput syntaxModule = module("java-syntax", List.of(other, annotations, guava), MAIN_CLASS);
        return new ScanRequest(REPOSITORY_ROOT, REPOSITORY_NAME, REVISION, "scanners/java/test-fixtures", output, engine, List.of(otherModule, syntaxModule));
    }

    private static ArtifactInput module(String artifactId, List<ClasspathEntry> classpath, String mainClass) {
        Path root = FIXTURES.resolve(artifactId);
        return new ArtifactInput(
                "vision.noesis.fixtures",
                artifactId,
                "0.1.0-SNAPSHOT",
                root,
                root.resolve("pom.xml"),
                List.of(root.resolve("src/main/java")),
                root.resolve("target/classes"),
                classpath,
                17,
                StandardCharsets.UTF_8,
                "jar",
                mainClass);
    }

    /** A library Maven resolved for the tests, as the surefire configuration hands it over. */
    private static ClasspathEntry library(String property, String packageId, String version) {
        return new ClasspathEntry(classpathEntry(property), new ArtifactDependency(JavaIds.libraryArtifact(packageId, version), ArtifactKind.LIBRARY, new PackageReference(packageId, version)));
    }

    private static Path classpathEntry(String property) {
        String path = System.getProperty(property);
        if (path == null || path.isEmpty() || path.startsWith("${")) {
            throw new IllegalStateException("System property " + property + " is not set; run the tests through Maven (mvn verify in scanners/java).");
        }
        return Path.of(path).toAbsolutePath().normalize();
    }
}
