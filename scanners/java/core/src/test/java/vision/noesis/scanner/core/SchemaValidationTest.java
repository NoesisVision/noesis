package vision.noesis.scanner.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Set;
import org.junit.jupiter.api.Test;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.CodeModelJson;

/** The written files fit the JSON Schema the service generates from its zod schema (scanners/code-model/). */
class SchemaValidationTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void manifestFitsTheSchema() throws IOException {
        assertValid("manifest.schema.json", CodeModelJson.serialize(Fixtures.source().manifest()));
    }

    @Test
    void modelFilesFitTheSchema() throws IOException {
        for (CodeModelFile model : Fixtures.source().models()) {
            assertValid("code-model.schema.json", CodeModelJson.serialize(model));
        }
        for (CodeModelFile model : Fixtures.bytecode().models()) {
            assertValid("code-model.schema.json", CodeModelJson.serialize(model));
        }
    }

    @Test
    void modelFilesRoundTripThroughTheCodec() {
        for (CodeModelFile model : Fixtures.source().models()) {
            String json = CodeModelJson.serialize(model);
            CodeModelFile again = CodeModelJson.deserialize(json, CodeModelFile.class);
            assertEquals(json, CodeModelJson.serialize(again));
            assertTrue(again.nodes().size() > 0);
        }
    }

    static void assertValid(String schemaFile, String json) throws IOException {
        JsonSchema schema = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012)
                .getSchema(Files.readString(Fixtures.SCHEMAS.resolve(schemaFile)));
        Set<ValidationMessage> errors = schema.validate(JSON.readTree(json));
        assertTrue(errors.isEmpty(), () -> errors.size() + " schema violations, first: " + errors.iterator().next());
    }
}
