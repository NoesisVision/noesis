using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;

namespace Noesis.Scanner.CSharp.Loading;

/// <summary>The target framework a project was evaluated for, read off its preprocessor symbols.</summary>
internal static partial class TargetFrameworks
{
    public static string Of(Project project)
    {
        var symbols = project.ParseOptions?.PreprocessorSymbolNames ?? [];
        foreach (var symbol in symbols)
        {
            var match = NetSymbol().Match(symbol);
            if (match.Success) return $"net{match.Groups[1].Value}.{match.Groups[2].Value}";
        }
        var suffix = NameSuffix().Match(project.Name);
        return suffix.Success ? suffix.Groups[1].Value : "unknown";
    }

    public static (int Major, int Minor) Rank(string moniker)
    {
        var match = Moniker().Match(moniker);
        return match.Success ? (int.Parse(match.Groups[1].Value), int.Parse(match.Groups[2].Value)) : (0, 0);
    }

    [GeneratedRegex("^NET(\\d+)_(\\d+)$")]
    private static partial Regex NetSymbol();

    [GeneratedRegex("\\(([^)]+)\\)$")]
    private static partial Regex NameSuffix();

    [GeneratedRegex("^net(\\d+)\\.(\\d+)")]
    private static partial Regex Moniker();
}
