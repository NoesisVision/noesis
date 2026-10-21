namespace Noesis.Scanner.Model;

/// <summary>One shape for every stubbed symbol; never carries visibility, modifiers, signatures or members.</summary>
public sealed record StubNode(NodeId Id, StubKind Kind, string Name, TypeKind? TypeKind, NodeId? Artifact);