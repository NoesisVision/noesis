package vision.noesis.parser.gradle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.gradle.testkit.runner.BuildResult;
import org.gradle.testkit.runner.GradleRunner;
import org.gradle.testkit.runner.TaskOutcome;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Runs {@code noesisParse} on {@code src/test/resources/multi-project}, the Gradle twin of the Maven plugin's
 * {@code src/it/multi-module} (b depends on a, a uses Guava, b has a main class), with the invocation the service would
 * make, and asserts what its {@code verify.groovy} asserts.
 */
class ParseTaskFunctionalTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @TempDir
    static Path projectDir;

    private static BuildResult result;
    private static Path out;

    @BeforeAll
    static void parse() throws IOException {
        copy(Path.of(System.getProperty("noesis.fixturesDir"), "multi-project"), projectDir);
        result = runner().build();
        out = projectDir.resolve("build/noesis");
    }

    @Test
    void manifestListsTheProjectsInDependencyOrder() throws IOException {
        JsonNode manifest = JSON.readTree(out.resolve("code-model/java/manifest.json").toFile());
        assertEquals(1, manifest.get("schemaVersion").asInt());
        assertEquals("java", manifest.get("language").asText());
        assertEquals("noesis-parse-java", manifest.at("/generator/name").asText());
        assertEquals("multi-project", manifest.at("/repository/name").asText());
        assertEquals("0123456789abcdef", manifest.at("/repository/revision").asText());
        assertEquals("settings.gradle", manifest.get("root").asText());
        assertEquals(List.of("A:a", "A:b"), texts(manifest.get("artifacts"), "id"));
        assertEquals(List.of("code-model/java/a.code-model.json", "code-model/java/b.code-model.json"), texts(manifest.get("artifacts"), "file"));
        assertEquals(0, manifest.get("diagnostics").size());
    }

    @Test
    void aIsASourceArtifactWithALibraryAndAPlatformDependency() throws IOException {
        JsonNode a = JSON.readTree(out.resolve("code-model/java/a.code-model.json").toFile());
        assertEquals("A:a", a.at("/artifact/id").asText());
        assertEquals("source", a.at("/artifact/kind").asText());
        assertEquals("a", a.at("/artifact/rootDirectory").asText());
        assertEquals("jdk-17", a.at("/artifact/target").asText());
        assertFalse(a.at("/artifact/executable").asBoolean());
        assertEquals("a/build.gradle", a.at("/artifact/languageSpecific/java.buildFile").asText());
        assertEquals("com.example", a.at("/artifact/languageSpecific/java.groupId").asText());
        assertEquals("source", a.at("/artifact/languageSpecific/java.engine").asText());
        JsonNode guava = find(a.at("/artifact/dependencies"), d -> d.get("id").asText().startsWith("A:com.google.guava:guava@"));
        assertNotNull(guava, "guava dependency expected, got " + texts(a.at("/artifact/dependencies"), "id"));
        assertEquals("library", guava.get("kind").asText());
        assertEquals("com.google.guava:guava", guava.at("/package/id").asText());
        assertEquals("33.5.0-jre", guava.at("/package/version").asText());
        assertNotNull(find(a.at("/artifact/dependencies"), d -> d.get("id").asText().equals("A:java.base@17") && d.get("kind").asText().equals("platform")));
        assertNotNull(find(a.get("nodes"), n -> n.get("id").asText().equals("T:com.example.a.Greeting")));
        assertNotNull(find(a.get("stubs"), s -> s.get("id").asText().equals("T:com.google.common.base.Strings") && s.get("artifact").asText().equals(guava.get("id").asText())));
        assertEquals(List.of(), stream(a.get("diagnostics")).filter(d -> d.get("severity").asText().equals("error")).toList());
    }

    @Test
    void bDependsOnAAsASourceArtifactAndInvokesAcrossIt() throws IOException {
        JsonNode b = JSON.readTree(out.resolve("code-model/java/b.code-model.json").toFile());
        assertTrue(b.at("/artifact/executable").asBoolean());
        assertEquals("com.example.b.App", b.at("/artifact/languageSpecific/java.mainClass").asText());
        JsonNode onA = find(b.at("/artifact/dependencies"), d -> d.get("id").asText().equals("A:a"));
        assertNotNull(onA, "b depends on a, got " + texts(b.at("/artifact/dependencies"), "id"));
        assertEquals("source", onA.get("kind").asText());
        assertTrue(onA.get("package").isNull());
        assertNotNull(find(b.get("nodes"), n -> n.get("id").asText().equals("M:com.example.b.App#main(java.lang.String[])")));
        assertNotNull(find(b.get("edges"), e -> e.get("kind").asText().equals("INVOKES") && e.get("to").asText().equals("M:com.example.a.Greeting#text()")));
        assertTrue(stream(b.get("stubs")).noneMatch(s -> s.get("id").asText().startsWith("T:com.example.a.")), "a sibling project is never stubbed");
        JsonNode app = find(b.get("nodes"), n -> n.get("id").asText().equals("T:com.example.b.App"));
        assertEquals("b/src/main/java/com/example/b/App.java", app.at("/locations/0/file").asText());
    }

    @Test
    void theTaskCompilesFirstAndIsUpToDateOnARerun() {
        assertEquals(TaskOutcome.SUCCESS, result.task(":a:compileJava").getOutcome());
        assertEquals(TaskOutcome.SUCCESS, result.task(":b:compileJava").getOutcome());
        assertEquals(TaskOutcome.SUCCESS, result.task(":noesisParse").getOutcome());
        assertFalse(result.getOutput().contains("deprecated"), "no deprecation warnings expected:\n" + result.getOutput());
        BuildResult rerun = runner().build();
        assertEquals(TaskOutcome.UP_TO_DATE, rerun.task(":noesisParse").getOutcome());
    }

    @Test
    void theTaskRunsUnderTheConfigurationCache(@TempDir Path cachedDir) throws IOException {
        copy(Path.of(System.getProperty("noesis.fixturesDir"), "multi-project"), cachedDir);
        BuildResult stored = runner(cachedDir, "--configuration-cache").build();
        assertEquals(TaskOutcome.SUCCESS, stored.task(":noesisParse").getOutcome());
        assertTrue(stored.getOutput().contains("Configuration cache entry stored"), stored.getOutput());
        Path manifest = cachedDir.resolve("build/noesis/code-model/java/manifest.json");
        Files.delete(manifest);
        BuildResult reused = runner(cachedDir, "--configuration-cache").build();
        assertEquals(TaskOutcome.SUCCESS, reused.task(":noesisParse").getOutcome());
        assertTrue(reused.getOutput().contains("Configuration cache entry reused"), reused.getOutput());
        assertEquals(List.of("A:a", "A:b"), texts(JSON.readTree(manifest.toFile()).get("artifacts"), "id"));
        JsonNode b = JSON.readTree(cachedDir.resolve("build/noesis/code-model/java/b.code-model.json").toFile());
        assertNotNull(find(b.at("/artifact/dependencies"), d -> d.get("id").asText().equals("A:a")), "the classpath survives the cache");
    }

    private static GradleRunner runner() {
        return runner(projectDir);
    }

    private static GradleRunner runner(Path dir, String... extra) {
        List<String> arguments = new ArrayList<>(List.of("noesisParse", "-Pnoesis.out=build/noesis", "-Pnoesis.repository=multi-project", "-Pnoesis.revision=0123456789abcdef",
                "--warning-mode", "all", "--stacktrace"));
        arguments.addAll(List.of(extra));
        return GradleRunner.create()
                .withProjectDir(dir.toFile())
                .withPluginClasspath()
                .withArguments(arguments);
    }

    private static void copy(Path from, Path to) throws IOException {
        try (Stream<Path> files = Files.walk(from)) {
            for (Path file : files.toList()) {
                Path target = to.resolve(from.relativize(file).toString());
                if (Files.isDirectory(file)) Files.createDirectories(target);
                else Files.copy(file, target);
            }
        }
    }

    private static Stream<JsonNode> stream(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false);
    }

    private static JsonNode find(JsonNode array, java.util.function.Predicate<JsonNode> test) {
        return stream(array).filter(test).findFirst().orElse(null);
    }

    private static List<String> texts(JsonNode array, String field) {
        List<String> values = new ArrayList<>();
        for (JsonNode node : array) values.add(node.get(field).asText());
        return values;
    }
}
