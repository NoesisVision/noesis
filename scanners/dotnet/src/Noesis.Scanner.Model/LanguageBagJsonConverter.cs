using System.Text.Json;
using System.Text.Json.Serialization;

namespace Noesis.Scanner.Model;

internal sealed class LanguageBagJsonConverter : JsonConverter<LanguageBag>
{
    public override LanguageBag Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var entries = new List<KeyValuePair<string, object>>();
        using var document = JsonDocument.ParseValue(ref reader);
        foreach (var property in document.RootElement.EnumerateObject())
        {
            object value = property.Value.ValueKind switch
            {
                JsonValueKind.String => property.Value.GetString()!,
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Number => property.Value.TryGetInt64(out var integer) ? integer : property.Value.GetDouble(),
                JsonValueKind.Array => property.Value.EnumerateArray().Select(item => item.GetString()!).ToArray(),
                _ => throw new JsonException($"Unsupported language bag value for '{property.Name}'."),
            };
            entries.Add(new KeyValuePair<string, object>(property.Name, value));
        }
        return LanguageBag.Of(entries);
    }

    public override void Write(Utf8JsonWriter writer, LanguageBag value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        foreach (var (key, entry) in value)
        {
            writer.WritePropertyName(key);
            switch (entry)
            {
                case string text: writer.WriteStringValue(text); break;
                case bool flag: writer.WriteBooleanValue(flag); break;
                case int number: writer.WriteNumberValue(number); break;
                case long number: writer.WriteNumberValue(number); break;
                case double number: writer.WriteNumberValue(number); break;
                case string[] list:
                    writer.WriteStartArray();
                    foreach (var item in list) writer.WriteStringValue(item);
                    writer.WriteEndArray();
                    break;
                default: throw new JsonException($"Unsupported language bag value for '{key}'.");
            }
        }
        writer.WriteEndObject();
    }
}