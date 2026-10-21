using System.Text.Json.Serialization;

namespace Noesis.Scanner.Model;

/// <summary>LSP language identifiers, also the <see cref="NodeId"/> prefix.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<Language>))]
public enum Language
{
    [JsonStringEnumMemberName("csharp")] CSharp,
    [JsonStringEnumMemberName("java")] Java,
    [JsonStringEnumMemberName("typescript")] TypeScript,
    [JsonStringEnumMemberName("php")] Php,
}