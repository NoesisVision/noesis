package vision.noesis.scanner.core.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** A typed edge; derived edges carry human-readable code references as evidence. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Edge(
        String from,
        String to,
        EdgeType type,
        List<String> evidence) {

    public static Edge of(String from, String to, EdgeType type) {
        return new Edge(from, to, type, null);
    }
}
