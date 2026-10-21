using System.Text.Json.Serialization;

namespace Noesis.Scanner.Model;

/// <summary>LSP language identifiers; the manifest names the language of the whole scan.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<Language>))]
public enum Language
{
    [JsonStringEnumMemberName("csharp")] CSharp,
    [JsonStringEnumMemberName("java")] Java,
    [JsonStringEnumMemberName("typescript")] TypeScript,
    [JsonStringEnumMemberName("php")] Php,
}