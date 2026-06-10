package vision.noesis.scanner.core.model;

/** Edge taxonomy of the graph contract (design-doc.md §9.4). */
public enum EdgeType {
    /** module → block | message · aggregate → entity/VO · block → behaviour */
    CONTAINS,
    /** aggregate → aggregate (by id reference) */
    ASSOCIATION,
    /** behaviour → behaviour */
    INVOKES,
    /** behaviour → message (producer side) */
    SENDS,
    /** behaviour → message (consumer side) */
    HANDLES,
    /** module → port */
    EXPOSES,
    /** adapter → port */
    IMPLEMENTS,
    /** block → block fallback for non-behavioural dependencies */
    DEPENDS_ON
}
