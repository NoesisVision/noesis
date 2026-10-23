package vision.noesis.scanner.core;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.CodeModelJson;

/**
 * The scanned fixture against the committed model files: the diff on a change is the review.
 * {@code NOESIS_UPDATE_GOLDEN=1 mvn test} rewrites them after an intended change.
 */
class GoldenModelTest {

    static final Path GOLDEN = Fixtures.MODULE_DIR.resolve("src/test/resources/golden");

    @TestFactory
    Stream<DynamicTest> sourceEngineMatchesGolden() {
        return golden(EngineKind.SOURCE, Fixtures.source());
    }

    @TestFactory
    Stream<DynamicTest> bytecodeEngineMatchesGolden() {
        return golden(EngineKind.BYTECODE, Fixtures.bytecode());
    }

    /** The hybrid engine's model of the syntax fixture is the source engine's, byte for byte ({@link HybridEngineTest}); only the Lombok fixture has a golden of its own per engine. */
    @TestFactory
    Stream<DynamicTest> lombokFixtureMatchesGoldenPerEngine() {
        List<DynamicTest> tests = new ArrayList<>();
        for (EngineKind engine : EngineKind.values()) {
            CodeModelFile model = Fixtures.lombok(engine).model("java-lombok");
            Path golden = GOLDEN.resolve(engine.id()).resolve("java-lombok.code-model.json");
            tests.add(DynamicTest.dynamicTest(engine.id() + "/java-lombok.code-model.json", () -> compare(golden, CodeModelJson.serialize(model))));
        }
        return tests.stream();
    }

    static Stream<DynamicTest> golden(EngineKind engine, ScanResult result) {
        Path directory = GOLDEN.resolve(engine.id());
        List<DynamicTest> tests = new ArrayList<>();
        tests.add(DynamicTest.dynamicTest("manifest.json", () -> compare(directory.resolve("manifest.json"), CodeModelJson.serialize(result.manifest()))));
        for (int i = 0; i < result.models().size(); i++) {
            String file = Path.of(result.manifest().artifacts().get(i).file()).getFileName().toString();
            String json = CodeModelJson.serialize(result.models().get(i));
            tests.add(DynamicTest.dynamicTest(file, () -> compare(directory.resolve(file), json)));
        }
        return tests.stream();
    }

    private static void compare(Path golden, String actual) throws IOException {
        if ("1".equals(System.getenv("NOESIS_UPDATE_GOLDEN"))) {
            Files.createDirectories(golden.getParent());
            Files.writeString(golden, actual, StandardCharsets.UTF_8);
            return;
        }
        String expected = Files.exists(golden) ? Files.readString(golden, StandardCharsets.UTF_8) : "";
        assertEquals(expected, actual, "Golden file " + golden.getFileName() + " differs; run NOESIS_UPDATE_GOLDEN=1 mvn test after an intended model change.");
    }
}
