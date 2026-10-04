package vision.noesis.scanner.core.model;

/** What a behaviour does, read from its method annotation (design-doc §9.4). */
public enum BehaviourType {
    /** Handles a command: changes state. */
    COMMAND,
    /** Answers a query: reads state, no side effects. */
    QUERY,
    /** Reacts to an event it takes as its parameter. */
    EVENT
}
