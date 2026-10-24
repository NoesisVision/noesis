package vision.noesis.parser.model;

/** One shape for every stubbed symbol; never carries visibility, modifiers, signatures or members. */
public record StubNode(NodeId id, StubKind kind, String name, TypeKind typeKind, NodeId artifact) {}
