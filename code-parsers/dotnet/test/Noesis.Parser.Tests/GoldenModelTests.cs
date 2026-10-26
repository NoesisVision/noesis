using Noesis.Parser.Model;
using Noesis.Parser.Tests.Infrastructure;

namespace Noesis.Parser.Tests;

/// <summary>
/// The checked-in model of the fixture solution: the diff on a change is the review.
/// Set NOESIS_UPDATE_GOLDEN=1 to rewrite the files after an intended change.
/// </summary>
public class GoldenModelTests(ParsedFixture parsed)
{
    private static bool Update => Environment.GetEnvironmentVariable("NOESIS_UPDATE_GOLDEN") == "1";

    [Fact]
    public void ManifestMatchesTheGoldenFile() => AssertGolden("manifest.json", CodeModelJson.Serialize(parsed.Result.Manifest));

    [Fact]
    public void MainModelMatchesTheGoldenFile() => AssertGolden("CSharpSyntax.code-model.json", CodeModelJson.Serialize(parsed.Main));

    [Fact]
    public void OtherProjectModelMatchesTheGoldenFile() => AssertGolden("CSharpSyntax.OtherProject.code-model.json", CodeModelJson.Serialize(parsed.Other));

    private static void AssertGolden(string file, string actual)
    {
        var path = Path.Combine(RepositoryPaths.GoldenDirectory, file);
        if (Update)
        {
            Directory.CreateDirectory(RepositoryPaths.GoldenDirectory);
            File.WriteAllText(path, actual + "\n");
        }
        Assert.True(File.Exists(path), $"Golden file missing: {path}; run with NOESIS_UPDATE_GOLDEN=1 to create it.");
        var expected = File.ReadAllText(path).TrimEnd('\n');
        if (expected == actual) return;
        var firstDifference = FirstDifference(expected, actual);
        Assert.Fail($"{file} differs from the golden file at line {firstDifference.Line}:\n expected: {firstDifference.Expected}\n actual:   {firstDifference.Actual}\nRun with NOESIS_UPDATE_GOLDEN=1 after reviewing the change.");
    }

    private static (int Line, string Expected, string Actual) FirstDifference(string expected, string actual)
    {
        var expectedLines = expected.Split('\n');
        var actualLines = actual.Split('\n');
        for (var i = 0; i < Math.Max(expectedLines.Length, actualLines.Length); i++)
        {
            var e = i < expectedLines.Length ? expectedLines[i] : "<end>";
            var a = i < actualLines.Length ? actualLines[i] : "<end>";
            if (e != a) return (i + 1, e, a);
        }
        return (0, "", "");
    }
}
