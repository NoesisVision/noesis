using System.Text.Json.Serialization;

namespace Noesis.Parser.Model;

/// <summary>`&lt;kind-letter&gt;:&lt;canonical path&gt;`; unique within one artifact file.</summary>
[JsonConverter(typeof(NodeIdJsonConverter))]
public readonly record struct NodeId(string Value) : IComparable<NodeId>
{
    public int CompareTo(NodeId other) => string.CompareOrdinal(Value, other.Value);

    public override string ToString() => Value;

    public static NodeId Of(NodeKindLetter kind, string canonicalPath) => new($"{(char)kind}:{canonicalPath}");

    /// <summary>The canonical path after the `kind:` prefix.</summary>
    public string CanonicalPath => Value[2..];

    public NodeKindLetter Kind => (NodeKindLetter)Value[0];
}
