package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import javax.tools.JavaCompiler;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vision.noesis.parser.model.CodeModelFile;

/** Class directories the fixtures do not have, compiled here and read by the bytecode engine as a module of their own. */
class BytecodeEdgeCaseTest {

    @TempDir
    Path root;

    /**
     * A multi-release module keeps a second {@code A/K.class} under {@code META-INF/versions/17}. The package sorts
     * before {@code META-INF}, so a reader that took both would end on the versioned copy and its extra method.
     */
    @Test
    void aMultiReleaseModuleIsReadFromItsBaseClasses() throws IOException {
        Path classes = root.resolve("classes");
        compile(11, classes, "package A;\npublic class K { public void base() {} }\n");
        compile(17, classes.resolve("META-INF/versions/17"), "package A;\npublic class K { public void base() {} public void onlyIn17() {} }\n");

        CodeModelFile model = parse(classes);

        List<String> methods = model.nodes().stream().map(node -> node.id().value()).filter(id -> id.startsWith("M:A.K#")).sorted().toList();
        assertEquals(List.of("M:A.K#.ctor()", "M:A.K#base()"), methods);
    }

    private void compile(int release, Path output, String source) throws IOException {
        Path file = Files.createTempDirectory(root, "src").resolve("A/K.java");
        Files.createDirectories(file.getParent());
        Files.writeString(file, source, StandardCharsets.UTF_8);
        Files.createDirectories(output);
        JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
        assertEquals(0, javac.run(null, null, null, "--release", Integer.toString(release), "-d", output.toString(), file.toString()));
    }

    private CodeModelFile parse(Path classes) {
        ArtifactInput input = new ArtifactInput("p", "edge", "1", root, null, List.of(), classes, List.of(), 17, StandardCharsets.UTF_8, "jar", null);
        ParseRequest request = new ParseRequest(root, "edge", "", "", root.resolve("out"), EngineKind.BYTECODE, List.of(input));
        return JavaParser.engineFor(EngineKind.BYTECODE).parse(input, new ParseSession(new JavaParser(Fixtures.GENERATOR_VERSION).generator(), request));
    }
}
