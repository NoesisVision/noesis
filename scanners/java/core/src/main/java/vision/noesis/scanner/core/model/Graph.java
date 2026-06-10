package vision.noesis.scanner.core.model;

import java.util.List;

/** The scan result envelope shipped to the Noesis server. */
public record Graph(
        ScanInfo scan,
        List<Node> nodes,
        List<Edge> edges) {
}
