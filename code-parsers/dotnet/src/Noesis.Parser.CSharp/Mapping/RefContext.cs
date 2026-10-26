using Noesis.Parser.Model;

namespace Noesis.Parser.CSharp.Mapping;

/// <summary>How a type is referenced inside an id (nullability dropped) or on a node (nullability kept, type parameters owned).</summary>
internal sealed record RefContext(bool ForId, NodeId? ExtensionMemberOwner)
{
    public static readonly RefContext Id = new(true, null);
    public static readonly RefContext Node = new(false, null);
}