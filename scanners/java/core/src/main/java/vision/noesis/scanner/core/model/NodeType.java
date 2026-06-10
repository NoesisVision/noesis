package vision.noesis.scanner.core.model;

import java.util.EnumSet;
import java.util.Set;

/** Node taxonomy of the graph contract (design-doc.md §9.4). */
public enum NodeType {
    // grouping (package-backed)
    BOUNDED_CONTEXT,
    MODULE,
    // blocks (class-backed)
    AGGREGATE_ROOT,
    ENTITY,
    VALUE_OBJECT,
    IDENTIFIER,
    DOMAIN_SERVICE,
    APPLICATION_SERVICE,
    REPOSITORY,
    FACTORY,
    PORT,
    ADAPTER,
    // messages (class-backed, own category)
    COMMAND,
    QUERY,
    EVENT,
    // behaviour (method-backed)
    BEHAVIOUR;

    private static final Set<NodeType> BLOCKS = EnumSet.range(AGGREGATE_ROOT, ADAPTER);
    private static final Set<NodeType> MESSAGES = EnumSet.of(COMMAND, QUERY, EVENT);

    public boolean isBlock() {
        return BLOCKS.contains(this);
    }

    public boolean isMessage() {
        return MESSAGES.contains(this);
    }
}
