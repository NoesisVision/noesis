package vision.noesis.scanner.core.derive;

import java.util.ArrayList;
import java.util.List;
import vision.noesis.scanner.core.model.Edge;
import vision.noesis.scanner.core.model.Node;

/** Mutable accumulator for nodes and edges produced by the derivers. */
public final class Derived {

    public final List<Node> nodes = new ArrayList<>();
    public final List<Edge> edges = new ArrayList<>();
}
