using System.Text.Json.Serialization;

namespace Noesis.Parser.Model;

/// <summary>LSP language identifiers; the manifest names the language of the whole parse.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<Language>))]
public enum Language
{
    [JsonStringEnumMemberName("csharp")] CSharp,
    [JsonStringEnumMemberName("java")] Java,
    [JsonStringEnumMemberName("typescript")] TypeScript,
    [JsonStringEnumMemberName("php")] Php,
}