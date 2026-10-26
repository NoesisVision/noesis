package vision.noesis.parser.gradle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * {@code src/test/resources/broken-project} has a file that does not compile. A build that asks for {@code noesisParse}
 * compiles past the error and parses the whole project, with the compiler's errors in its model; any other build fails
 * on it, as the build's own compile does.
 */
class BrokenProjectFunctionalTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @TempDir
    Path projectDir;

    @Test
    void aCompileErrorDoesNotStopAParse() throws IOException {
        copy(Path.of(System.getProperty("noesis.fixturesDir"), "broken-project"), projectDir);

        BuildResult result = runner("noesisParse", "-Pnoesis.out=build/noesis").build();

        assertEquals(TaskOutcome.SUCCESS, result.task(":noesisParse").getOutcome());
        Path models = projectDir.resolve("build/noesis/code-model/java");
        JsonNode manifest = JSON.readTree(models.resolve("manifest.json").toFile());
        assertEquals(List.of("A:broken"), texts(manifest.get("artifacts"), "id"));
        JsonNode broken = JSON.readTree(models.resolve("broken.code-model.json").toFile());
        List<String> ids = texts(broken.get("nodes"), "id");
        assertTrue(ids.contains("T:com.example.broken.Fine"), ids.toString());
        assertTrue(ids.contains("M:com.example.broken.Broken#name()"), ids.toString());
        assertTrue(stream(broken.get("diagnostics")).anyMatch(d -> d.get("source").asText().equals("compiler") && d.get("severity").asText().equals("error")),
                broken.get("diagnostics").toString());
    }

    @Test
    void aCompileErrorFailsABuildThatParsesNothing() throws IOException {
        copy(Path.of(System.getProperty("noesis.fixturesDir"), "broken-project"), projectDir);

        BuildResult result = runner("classes").buildAndFail();

        assertEquals(TaskOutcome.FAILED, result.task(":broken:compileJava").getOutcome());
    }

    @Test
    void aParseIsAskedForByTheTaskNameOrAPathEndingInIt() {
        assertTrue(NoesisParserPlugin.parseRequested(List.of("clean", "noesisParse")));
        assertTrue(NoesisParserPlugin.parseRequested(List.of(":noesisParse")));
        assertFalse(NoesisParserPlugin.parseRequested(List.of("build")));
        assertFalse(NoesisParserPlugin.parseRequested(List.of()));
    }

    private GradleRunner runner(String... tasks) {
        List<String> arguments = new ArrayList<>(List.of(tasks));
        arguments.addAll(List.of("--warning-mode", "all", "--stacktrace"));
        return GradleRunner.create().withProjectDir(projectDir.toFile()).withPluginClasspath().withArguments(arguments);
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

    private static List<String> texts(JsonNode array, String field) {
        List<String> values = new ArrayList<>();
        for (JsonNode node : array) values.add(node.get(field).asText());
        return values;
    }
}
