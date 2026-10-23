using System.Text.Json;
using System.Text.Json.Serialization;

namespace Noesis.Parser.Model;

internal sealed class NodeIdJsonConverter : JsonConverter<NodeId>
{
    public override NodeId Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        new(reader.GetString() ?? throw new JsonException("A node id must be a string."));

    public override void Write(Utf8JsonWriter writer, NodeId value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.Value);
}