package vision.noesis.annotations;

/** Direction of a {@link Port} or {@link Adapter} in the hexagonal architecture. */
public enum Direction {
    /** Driving side — the world calls the application (e.g. REST, UI). */
    PRIMARY,
    /** Driven side — the application calls the world (e.g. persistence, messaging). */
    SECONDARY
}
