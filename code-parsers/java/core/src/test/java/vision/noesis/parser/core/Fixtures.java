package vision.noesis.parser.core;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import vision.noesis.parser.core.java.JavaIds;
import vision.noesis.parser.model.ArtifactDependency;
import vision.noesis.parser.model.ArtifactKind;
import vision.noesis.parser.model.PackageReference;

/** The fixture modules under {@code test-fixtures/}, parsed once per engine the way the Maven plugin would hand them over: the syntax fixture as one request, the Lombok fixture as another. The syntax module's main class is injected here ({@link #MAIN_CLASS}); the fixture pom declares none. */
public final class Fixtures {

    public static final String REPOSITORY_NAME = "noesis";
    public static final String REVISION = "0123456789abcdef";
    public static final String GENERATOR_VERSION = "1.0.0";
    public static final String MAIN_CLASS = "vision.noesis.fixture.syntax.Program";

    public static final Path REPOSITORY_ROOT = Path.of(System.getProperty("noesis.repositoryRoot", "../../..")).toAbsolutePath().normalize();
    public static final Path FIXTURES = Path.of(System.getProperty("noesis.fixturesDir", "../test-fixtures")).toAbsolutePath().normalize();
    public static final Path MODULE_DIR = Path.of(System.getProperty("basedir", ".")).toAbsolutePath().normalize();

    private static final Map<EngineKind, ParseResult> syntax = new EnumMap<>(EngineKind.class);
    private static final Map<EngineKind, ParseResult> lombok = new EnumMap<>(EngineKind.class);
    private static final Map<EngineKind, Long> syntaxMillis = new EnumMap<>(EngineKind.class);
    private static final Map<EngineKind, Long> lombokMillis = new EnumMap<>(EngineKind.class);

    private Fixtures() {}

    public static ParseResult source() {
        return parse(EngineKind.SOURCE);
    }

    public static ParseResult bytecode() {
        return parse(EngineKind.BYTECODE);
    }

    /** The syntax fixture (both modules) parsed with the engine, once per engine. */
    public static synchronized ParseResult parse(EngineKind engine) {
        return syntax.computeIfAbsent(engine, kind -> timed(kind, syntaxMillis, request(kind)));
    }

    /** The Lombok fixture parsed with the engine, once per engine: its own request, so the syntax fixture's manifest stays what it is. */
    public static synchronized ParseResult lombok(EngineKind engine) {
        return lombok.computeIfAbsent(engine, kind -> timed(kind, lombokMillis, lombokRequest(kind)));
    }

    /** Wall-clock time of the first parse of the syntax fixture with the engine, for the comparison report. */
    public static synchronized long parseMillis(EngineKind engine) {
        parse(engine);
        return syntaxMillis.get(engine);
    }

    public static synchronized long lombokMillis(EngineKind engine) {
        lombok(engine);
        return lombokMillis.get(engine);
    }

    private static ParseResult timed(EngineKind engine, Map<EngineKind, Long> millis, ParseRequest request) {
        long started = System.nanoTime();
        ParseResult result = new JavaParser(GENERATOR_VERSION).parse(request);
        millis.put(engine, (System.nanoTime() - started) / 1_000_000);
        return result;
    }

    public static ParseRequest request(EngineKind engine) {
        return request(engine, MODULE_DIR.resolve("target/fixture-parse").resolve(engine.id()));
    }

    public static ParseRequest request(EngineKind engine, Path output) {
        ClasspathEntry annotations = library("noesis.classpath.annotations", "vision.noesis:noesis-annotations", "0.1.0-SNAPSHOT");
        ClasspathEntry guava = library("noesis.classpath.guava", "com.google.guava:guava", System.getProperty("noesis.version.guava"));
        ClasspathEntry other = new ClasspathEntry(classpathEntry("noesis.classpath.other"), new ArtifactDependency(JavaIds.artifact("java-syntax-other"), ArtifactKind.SOURCE, null));
        ArtifactInput otherModule = module("java-syntax-other", List.of(annotations), null);
        ArtifactInput syntaxModule = module("java-syntax", List.of(other, annotations, guava), MAIN_CLASS);
        return new ParseRequest(REPOSITORY_ROOT, REPOSITORY_NAME, REVISION, "code-parsers/java/test-fixtures", output, engine, List.of(otherModule, syntaxModule));
    }

    public static ParseRequest lombokRequest(EngineKind engine) {
        ClasspathEntry lombok = library("noesis.classpath.lombok", "org.projectlombok:lombok", System.getProperty("noesis.version.lombok"));
        ArtifactInput lombokModule = module("java-lombok", List.of(lombok), null);
        return new ParseRequest(REPOSITORY_ROOT, REPOSITORY_NAME, REVISION, "code-parsers/java/test-fixtures", MODULE_DIR.resolve("target/fixture-parse/lombok").resolve(engine.id()), engine, List.of(lombokModule));
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
            throw new IllegalStateException("System property " + property + " is not set; run the tests through Maven (mvn verify in code-parsers/java).");
        }
        return Path.of(path).toAbsolutePath().normalize();
    }
}
