package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** {@code <kind-letter>:<canonical path>}; unique within one artifact file. */
public record NodeId(@JsonValue String value) implements Comparable<NodeId> {

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public NodeId {
        if (value.length() < 2 || value.charAt(1) != ':') {
            throw new IllegalArgumentException("Not a node id: " + value);
        }
    }

    public static NodeId of(NodeKindLetter kind, String canonicalPath) {
        return new NodeId(kind.letter() + ":" + canonicalPath);
    }

    /** The canonical path after the {@code kind:} prefix. */
    public String canonicalPath() {
        return value.substring(2);
    }

    public NodeKindLetter kind() {
        return NodeKindLetter.of(value.charAt(0));
    }

    @Override
    public int compareTo(NodeId other) {
        return value.compareTo(other.value);
    }

    @Override
    public String toString() {
        return value;
    }
}
