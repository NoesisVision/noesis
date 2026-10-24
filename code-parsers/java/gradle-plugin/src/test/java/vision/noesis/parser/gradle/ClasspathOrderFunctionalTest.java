package vision.noesis.parser.gradle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.jar.JarEntry;
import java.util.jar.JarOutputStream;
import java.util.stream.StreamSupport;
import javax.tools.JavaCompiler;
import javax.tools.ToolProvider;
import org.gradle.testkit.runner.BuildResult;
import org.gradle.testkit.runner.GradleRunner;
import org.gradle.testkit.runner.TaskOutcome;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Two jars on the compile classpath hold a class of the same name. javac binds the one that comes first, so the parse
 * must see the classpath in the order Gradle resolved it, not sorted by file name.
 */
class ClasspathOrderFunctionalTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @TempDir
    Path projectDir;

    @Test
    void aClassInTwoJarsBindsToTheJarTheCompileSeesFirst() throws IOException {
        jar("z-first", "public class Dup { public void first() {} }");
        jar("a-second", "public class Dup { public void second() {} }");
        Files.writeString(projectDir.resolve("settings.gradle"), "rootProject.name = 'app'\n");
        Files.writeString(projectDir.resolve("build.gradle"), """
                plugins {
                    id 'java'
                    id 'vision.noesis.parser'
                }
                dependencies {
                    implementation files('libs/z-first.jar', 'libs/a-second.jar')
                }
                tasks.withType(JavaCompile).configureEach {
                    options.release = 17
                }
                """);
        write(projectDir.resolve("src/main/java/app/App.java"), "package app; public class App { void run() { new dup.Dup().first(); } }");

        BuildResult result = GradleRunner.create().withProjectDir(projectDir.toFile()).withPluginClasspath()
                .withArguments("noesisParse", "-Pnoesis.out=build/noesis", "--stacktrace").build();

        assertEquals(TaskOutcome.SUCCESS, result.task(":compileJava").getOutcome());
        JsonNode app = JSON.readTree(projectDir.resolve("build/noesis/code-model/java/app.code-model.json").toFile());
        JsonNode dup = StreamSupport.stream(app.get("stubs").spliterator(), false).filter(s -> s.get("id").asText().equals("T:dup.Dup")).findFirst().orElseThrow();
        assertEquals("A:z-first@local", dup.get("artifact").asText());
        assertTrue(StreamSupport.stream(app.get("edges").spliterator(), false)
                .anyMatch(e -> e.get("kind").asText().equals("INVOKES") && e.get("to").asText().equals("M:dup.Dup#first()")), app.get("edges").toString());
    }

    /** {@code libs/<name>.jar} with {@code dup.Dup} compiled from the given body. */
    private void jar(String name, String body) throws IOException {
        Path sources = projectDir.resolve("jar-sources/" + name);
        Path classes = projectDir.resolve("jar-classes/" + name);
        write(sources.resolve("dup/Dup.java"), "package dup; " + body);
        Files.createDirectories(classes);
        JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
        int status = javac.run(null, null, null, "--release", "17", "-d", classes.toString(), sources.resolve("dup/Dup.java").toString());
        assertEquals(0, status, "fixture jar " + name + " did not compile");
        Path jar = projectDir.resolve("libs/" + name + ".jar");
        Files.createDirectories(jar.getParent());
        try (OutputStream file = Files.newOutputStream(jar); JarOutputStream out = new JarOutputStream(file)) {
            out.putNextEntry(new JarEntry("dup/Dup.class"));
            out.write(Files.readAllBytes(classes.resolve("dup/Dup.class")));
            out.closeEntry();
        }
    }

    private static void write(Path file, String content) throws IOException {
        Files.createDirectories(file.getParent());
        Files.writeString(file, content, StandardCharsets.UTF_8);
    }
}
