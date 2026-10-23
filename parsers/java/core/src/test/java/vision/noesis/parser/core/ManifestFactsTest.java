package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.parser.model.ArtifactDependency;
import vision.noesis.parser.model.ArtifactKind;
import vision.noesis.parser.model.ArtifactNode;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.DiagnosticSeverity;
import vision.noesis.parser.model.DiagnosticSource;
import vision.noesis.parser.model.Language;
import vision.noesis.parser.model.ManifestArtifact;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.PackageReference;
import vision.noesis.parser.model.ParseManifest;
import vision.noesis.parser.model.StubNode;

/** The manifest, the two artifact nodes, their dependencies, the stubs' artifacts and the diagnostics of a fixture parse. */
class ManifestFactsTest {

    private static final String SYNTAX = "A:java-syntax";
    private static final String OTHER = "A:java-syntax-other";
    private static final String GUAVA = "A:com.google.guava:guava@" + System.getProperty("noesis.version.guava");
    private static final String ANNOTATIONS = "A:vision.noesis:noesis-annotations@0.1.0-SNAPSHOT";
    private static final String PLATFORM = "A:java.base@17";

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void manifestCarriesSchemaRepositoryRootAndTheArtifactsInRequestOrder(EngineKind engine) {
        ParseResult parse = Models.parse(engine);
        ParseManifest manifest = parse.manifest();
        assertEquals(ParseManifest.CURRENT_SCHEMA_VERSION, manifest.schemaVersion());
        assertEquals("noesis-parse-java", manifest.generator().name());
        assertEquals(Fixtures.GENERATOR_VERSION, manifest.generator().version());
        assertEquals(Language.JAVA, manifest.language());
        assertEquals(Fixtures.REPOSITORY_NAME, manifest.repository().name());
        assertEquals(Fixtures.REVISION, manifest.repository().revision());
        assertEquals("parsers/java/test-fixtures", manifest.root());
        assertTrue(manifest.diagnostics().isEmpty());
        // Fixtures hands the modules over other-first, so this shows the request order is kept, not that the parser sorts by dependency.
        assertEquals(List.of(OTHER, SYNTAX), manifest.artifacts().stream().map(artifact -> artifact.id().value()).toList());
        assertEquals("code-model/java/java-syntax-other.code-model.json", manifest.artifacts().get(0).file());
        assertEquals("code-model/java/java-syntax.code-model.json", manifest.artifacts().get(1).file());
        assertTrue(Files.exists(parse.manifestPath()));
        for (ManifestArtifact artifact : manifest.artifacts()) {
            assertTrue(Files.exists(parse.outputDirectory().resolve(artifact.file())), artifact.file());
        }
        assertEquals(manifest.artifacts().stream().map(artifact -> artifact.id().value()).toList(), parse.models().stream().map(model -> model.artifact().id().value()).toList());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void theSyntaxArtifactIsTheExecutableModule(EngineKind engine) {
        ArtifactNode artifact = Models.syntax(engine).artifact();
        assertEquals(SYNTAX, artifact.id().value());
        assertEquals(ArtifactKind.SOURCE, artifact.kind());
        assertEquals("java-syntax", artifact.name());
        assertEquals("0.1.0-SNAPSHOT", artifact.version());
        assertEquals("parsers/java/test-fixtures/java-syntax", artifact.rootDirectory());
        assertEquals("jdk-17", artifact.target());
        assertTrue(artifact.executable());
        assertTrue(artifact.annotations().isEmpty());
        // The main class comes from Fixtures, not from the fixture pom, which declares none.
        assertEquals(Fixtures.MAIN_CLASS, artifact.languageSpecific().get("java.mainClass"));
        assertEquals("parsers/java/test-fixtures/java-syntax/pom.xml", artifact.languageSpecific().get("java.buildFile"));
        assertEquals("vision.noesis.fixtures", artifact.languageSpecific().get("java.groupId"));
        assertEquals("jar", artifact.languageSpecific().get("java.packaging"));
        assertEquals(engine.id(), artifact.languageSpecific().get("java.engine"));
        assertEquals(5, artifact.languageSpecific().entries().size());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void dependenciesTellSourceLibraryAndPlatformApart(EngineKind engine) {
        List<ArtifactDependency> dependencies = Models.syntax(engine).artifact().dependencies();
        assertEquals(List.of(GUAVA, OTHER, PLATFORM, ANNOTATIONS), dependencies.stream().map(dependency -> dependency.id().value()).toList());
        assertEquals(dependencies.stream().sorted(Comparator.comparing(ArtifactDependency::id)).toList(), dependencies);
        ArtifactDependency other = Models.one(dependencies, dependency -> dependency.id().value().equals(OTHER), "other module");
        assertEquals(ArtifactKind.SOURCE, other.kind());
        assertNull(other.packageReference());
        ArtifactDependency guava = Models.one(dependencies, dependency -> dependency.id().value().equals(GUAVA), "guava");
        assertEquals(ArtifactKind.LIBRARY, guava.kind());
        assertEquals(new PackageReference("com.google.guava:guava", System.getProperty("noesis.version.guava")), guava.packageReference());
        ArtifactDependency annotations = Models.one(dependencies, dependency -> dependency.id().value().equals(ANNOTATIONS), "annotations");
        assertEquals(ArtifactKind.LIBRARY, annotations.kind());
        assertEquals(new PackageReference("vision.noesis:noesis-annotations", "0.1.0-SNAPSHOT"), annotations.packageReference());
        ArtifactDependency platform = Models.one(dependencies, dependency -> dependency.id().value().equals(PLATFORM), "platform");
        assertEquals(ArtifactKind.PLATFORM, platform.kind());
        assertNull(platform.packageReference());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void theOtherArtifactIsANonExecutableSourceModule(EngineKind engine) {
        ArtifactNode artifact = Models.other(engine).artifact();
        assertEquals(OTHER, artifact.id().value());
        assertEquals(ArtifactKind.SOURCE, artifact.kind());
        assertFalse(artifact.executable());
        assertEquals("parsers/java/test-fixtures/java-syntax-other", artifact.rootDirectory());
        assertNull(artifact.languageSpecific().get("java.mainClass"));
        assertEquals(List.of(PLATFORM, ANNOTATIONS), artifact.dependencies().stream().map(dependency -> dependency.id().value()).toList());
        assertTrue(artifact.dependencies().stream().noneMatch(dependency -> dependency.kind() == ArtifactKind.SOURCE));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void everyStubBelongsToADependencyAndStubsAreSortedById(EngineKind engine) {
        for (CodeModelFile model : Models.parse(engine).models()) {
            Set<String> known = model.artifact().dependencies().stream().map(dependency -> dependency.id().value()).collect(Collectors.toSet());
            for (StubNode stub : model.stubs()) {
                assertTrue(known.contains(stub.artifact().value()), stub.id() + " -> " + stub.artifact());
            }
            assertEquals(model.stubs().stream().map(StubNode::id).sorted().toList(), model.stubs().stream().map(StubNode::id).toList());
            assertTrue(model.stubs().stream().noneMatch(stub -> stub.id().value().startsWith("T:vision.noesis.fixture.")));
            assertTrue(model.stubs().stream().anyMatch(stub -> stub.artifact().equals(new NodeId(PLATFORM))));
        }
        assertTrue(Models.syntax(engine).stubs().stream().anyMatch(stub -> stub.artifact().value().equals(GUAVA)));
        assertTrue(Models.syntax(engine).stubs().stream().anyMatch(stub -> stub.artifact().value().equals(ANNOTATIONS)));
        assertTrue(Models.other(engine).stubs().stream().noneMatch(stub -> stub.artifact().value().equals(GUAVA)));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void noStubRepeatsADeclaredNode(EngineKind engine) {
        for (CodeModelFile model : Models.parse(engine).models()) {
            Set<NodeId> declared = model.nodes().stream().map(node -> node.id()).collect(Collectors.toSet());
            for (StubNode stub : model.stubs()) {
                assertFalse(declared.contains(stub.id()), model.artifact().name() + " declares and stubs " + stub.id());
            }
        }
        // The annotation types' package chain ends at the packages the fixture declares itself.
        assertTrue(Models.syntax(engine).stubs().stream().anyMatch(stub -> stub.id().value().equals("N:vision.noesis.annotations")));
        assertTrue(Models.syntax(engine).nodes().stream().anyMatch(node -> node.id().value().equals("N:vision.noesis")));
    }

    @Test
    void theSourceEngineReportsJavacsMissingGuavaAnnotationDependency() {
        CodeModelFile syntax = Models.syntax(EngineKind.SOURCE);
        Diagnostic warning = Models.one(syntax.diagnostics(), diagnostic -> true, "diagnostic");
        assertEquals(DiagnosticSeverity.WARNING, warning.severity());
        assertEquals("compiler.warn.unknown.enum.constant.reason", warning.code());
        assertEquals(DiagnosticSource.COMPILER, warning.source());
        assertNull(warning.location());
        assertTrue(warning.message().contains("com.google.j2objc.annotations.ReflectionSupport.Level.FULL"), warning.message());
        assertTrue(Models.other(EngineKind.SOURCE).diagnostics().isEmpty());
    }

    @Test
    void theBytecodeEngineReportsNothing() {
        for (CodeModelFile model : Models.parse(EngineKind.BYTECODE).models()) {
            assertTrue(model.diagnostics().isEmpty(), model.artifact().name());
        }
    }
}
