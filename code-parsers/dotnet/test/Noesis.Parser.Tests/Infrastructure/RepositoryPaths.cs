namespace Noesis.Parser.Tests.Infrastructure;

/// <summary>Where the checkout is: the ancestor of the test binaries that holds the parser solution.</summary>
public static class RepositoryPaths
{
    public static readonly string Root = Locate();

    public static readonly string ParserRoot = Path.Combine(Root, "code-parsers", "dotnet");

    public static readonly string FixturesDirectory = Path.Combine(ParserRoot, "test", "fixtures");

    public static readonly string BrokenFixturesDirectory = Path.Combine(ParserRoot, "test", "fixtures-broken");

    public static readonly string GoldenDirectory = Path.Combine(ParserRoot, "test", "Noesis.Parser.Tests", "golden");

    public static string Fixture(string relativePath) => Path.Combine(FixturesDirectory, relativePath);

    /// <summary>The 1-based line of the one fixture line containing <paramref name="text"/>; tests pin sites by what they say, not by line number.</summary>
    public static int FixtureLine(string relativePath, string text)
    {
        var lines = File.ReadAllLines(Fixture(relativePath));
        var matches = lines.Index().Where(line => line.Item.Contains(text, StringComparison.Ordinal)).Select(line => line.Index + 1).ToList();
        return matches.Count == 1 ? matches[0] : throw new InvalidOperationException($"Expected one line containing '{text}' in {relativePath}, found {matches.Count}.");
    }

    private static string Locate()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
            if (File.Exists(Path.Combine(directory.FullName, "code-parsers", "dotnet", "Noesis.Parser.slnx")))
                return directory.FullName;
        throw new InvalidOperationException("The repository root was not found above " + AppContext.BaseDirectory);
    }
}
