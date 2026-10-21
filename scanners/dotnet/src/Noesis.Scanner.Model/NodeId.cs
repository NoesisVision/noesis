using System.Text.Json.Serialization;

namespace Noesis.Scanner.Model;

/// <summary>`&lt;language&gt;:&lt;kind-letter&gt;:&lt;canonical path&gt;`; unique within one artifact file.</summary>
[JsonConverter(typeof(NodeIdJsonConverter))]
public readonly record struct NodeId(string Value) : IComparable<NodeId>
{
    public int CompareTo(NodeId other) => string.CompareOrdinal(Value, other.Value);

    public override string ToString() => Value;

    public static NodeId Of(Language language, NodeKindLetter kind, string canonicalPath) =>
        new($"{language.Identifier()}:{(char)kind}:{canonicalPath}");

    /// <summary>The canonical path after the `language:kind:` prefix.</summary>
    public string CanonicalPath => Value[(Value.IndexOf(':', Value.IndexOf(':') + 1) + 1)..];

    public NodeKindLetter Kind => (NodeKindLetter)Value[Value.IndexOf(':') + 1];
}