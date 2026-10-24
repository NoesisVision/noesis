package vision.noesis.parser.core;

import java.util.Locale;

/** Which front end reads the code: javac over the sources, or ArchUnit over the compiled classes. */
public enum EngineKind {
    SOURCE,
    BYTECODE,
    /** The source engine's model with what only the compiled classes hold merged in: members an annotation processor generated and the calls to them. */
    HYBRID;

    public String id() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static EngineKind of(String id) {
        for (EngineKind kind : values()) {
            if (kind.id().equals(id)) return kind;
        }
        throw new IllegalArgumentException("Unknown engine '" + id + "'; expected source, bytecode or hybrid.");
    }
}
