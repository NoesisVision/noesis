package vision.noesis.scanner.core.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * A graph node. Ids are stable across scans: FQN for class-backed nodes,
 * package name for groupings, ArchUnit full name ("fqn.method(paramTypes)")
 * for behaviours.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Node(
        String id,
        NodeType type,
        String label,
        /** Owning package — grouping hint for class-backed nodes. */
        String group,
        /** Only for PORT / ADAPTER nodes. */
        PortDirection direction,
        /** Only for BEHAVIOUR nodes — method signature without owner prefix. */
        String signature,
        /** Source location ("File.java:42") when debug info is present. */
        String source) {

    public static Node grouping(String packageName, NodeType type, String label) {
        return new Node(packageName, type, label, null, null, null, null);
    }
}
