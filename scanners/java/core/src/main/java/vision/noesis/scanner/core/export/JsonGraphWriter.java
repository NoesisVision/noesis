package vision.noesis.scanner.core.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import vision.noesis.scanner.core.model.Graph;

/** Serializes a graph to the JSON contract consumed by the Noesis server. */
public final class JsonGraphWriter {

    private final ObjectMapper mapper = new ObjectMapper();

    public void write(Graph graph, Path target) {
        try {
            Files.createDirectories(target.getParent());
            mapper.writerWithDefaultPrettyPrinter().writeValue(target.toFile(), graph);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to write graph to " + target, e);
        }
    }

    public String toJson(Graph graph) {
        try {
            return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(graph);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to serialize graph", e);
        }
    }
}
