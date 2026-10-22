using Noesis.Scanner.CSharp;
using Noesis.Scanner.CSharp.Caching;
using Noesis.Scanner.CSharp.Loading;
using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

/// <summary>
/// The model cache end to end, on a private copy of the fixture solution that the test edits between scans. One
/// test method: every step builds on the cache state the step before left, and a restore plus six scans is paid once.
/// </summary>
public sealed class CacheTests : IAsyncLifetime
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "noesis-scanner-tests", Guid.NewGuid().ToString("N"));
    private string Fixtures => Path.Combine(_root, "fixtures");
    private string Cache => Path.Combine(_root, "cache");
    private string MainFile => Path.Combine(Fixtures, "CSharpSyntax", "Program.cs");
    private string OtherFile => Path.Combine(Fixtures, "CSharpSyntax.OtherProject", "TypesFromOtherProject.cs");
    private string MainCacheDirectory => Path.Combine(Cache, "CSharpSyntax");

    private static readonly NodeId Main = new("A:CSharpSyntax");
    private static readonly NodeId Other = new("A:CSharpSyntax.OtherProject");

    /// <summary>The copy keeps `obj/` (the restore output, which names only global package folders) so no restore runs inside the test host, where `dotnet restore` hangs.</summary>
    public ValueTask InitializeAsync()
    {
        CopyWithoutBinaries(RepositoryPaths.FixturesDirectory, Fixtures);
        return ValueTask.CompletedTask;
    }

    public ValueTask DisposeAsync()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
        return ValueTask.CompletedTask;
    }

    [Fact]
    public async Task TheCacheServesUnchangedProjectsAndKeepsARingOfThree()
    {
        var first = await Scan();
        Assert.Empty(first.CachedArtifacts);
        Assert.Equal(ScanExitCode.Success, first.ExitCode);

        var second = await Scan();
        Assert.Equal([Other, Main], second.CachedArtifacts);
        foreach (var (artifact, model) in second.Manifest.Artifacts.Zip(second.Models))
            Assert.Equal(CodeModelJson.Serialize(first.Model(model.Artifact.Name)), await File.ReadAllTextAsync(Path.Combine(second.OutputDirectory, artifact.File), TestContext.Current.CancellationToken));

        // A change in the referenced project rescans it and its dependent.
        var otherOriginal = await File.ReadAllTextAsync(OtherFile, TestContext.Current.CancellationToken);
        await File.WriteAllTextAsync(OtherFile, otherOriginal + "\n// cache test: other edited\n", TestContext.Current.CancellationToken);
        Assert.Empty((await Scan()).CachedArtifacts);

        // A change in the dependent alone rescans the dependent alone.
        var mainOriginal = await File.ReadAllTextAsync(MainFile, TestContext.Current.CancellationToken);
        await Edit(1);
        Assert.Equal([Other], (await Scan()).CachedArtifacts);

        // Reverting hits the entry of the step before, still in the ring; the hit counts as a use. The ring now
        // holds three versions of the dependent: original, over the edited reference, edit 1.
        await File.WriteAllTextAsync(MainFile, mainOriginal, TestContext.Current.CancellationToken);
        Assert.Equal([Other, Main], (await Scan()).CachedArtifacts);
        Assert.Equal(3, Entries(MainCacheDirectory).Count);

        // Two more versions evict the two least recently used; the just-hit entry survives because the hit refreshed it.
        await Edit(2);
        await Scan();
        await Edit(3);
        await Scan();
        Assert.Equal(3, Entries(MainCacheDirectory).Count);
        await File.WriteAllTextAsync(MainFile, mainOriginal, TestContext.Current.CancellationToken);
        Assert.Equal([Other, Main], (await Scan()).CachedArtifacts);

        // Three versions after its last use, it is gone.
        await Edit(4);
        await Scan();
        await Edit(5);
        await Scan();
        await Edit(6);
        await Scan();
        Assert.Equal(3, Entries(MainCacheDirectory).Count);
        await File.WriteAllTextAsync(MainFile, mainOriginal, TestContext.Current.CancellationToken);
        Assert.Equal([Other], (await Scan()).CachedArtifacts);

        // A full scan sweeps the directory of a project that is no longer there; a filtered scan sweeps nothing.
        var stale = Path.Combine(Cache, "Gone.Project");
        Directory.CreateDirectory(stale);
        await Scan(projects: ["CSharpSyntax"]);
        Assert.True(Directory.Exists(stale));
        await Scan();
        Assert.False(Directory.Exists(stale));
        Assert.True(Directory.Exists(MainCacheDirectory));
    }

    [Fact]
    public async Task TheKeyChangesWithTheInputsItNames()
    {
        var request = Request();
        using var solution = await new SolutionLoader(request, ScanLog.Silent).LoadAsync(TestContext.Current.CancellationToken);
        var names = solution.Projects.Select(project => project.AssemblyName).ToHashSet(StringComparer.Ordinal);
        var main = solution.Projects.Single(project => project.AssemblyName == "CSharpSyntax");
        var other = solution.Projects.Single(project => project.AssemblyName == "CSharpSyntax.OtherProject");

        var keys = new CacheKeys(request, names, solution.ProblemsOf);
        var mainKey = await keys.KeyOf(main, TestContext.Current.CancellationToken);
        var otherKey = await keys.KeyOf(other, TestContext.Current.CancellationToken);
        Assert.Equal(mainKey, await keys.KeyOf(main, TestContext.Current.CancellationToken));
        Assert.NotEqual(mainKey, otherKey);

        var text = await keys.CanonicalTextOf(main, TestContext.Current.CancellationToken);
        Assert.Contains($"project-ref CSharpSyntax.OtherProject {otherKey}", text);
        Assert.Contains("document CSharpSyntax/Program.cs ", text);
        Assert.Contains("source-assemblies CSharpSyntax;CSharpSyntax.OtherProject", text);
        Assert.Contains("configuration Debug", text);

        var release = new CacheKeys(request with { Configuration = "Release" }, names, solution.ProblemsOf);
        Assert.NotEqual(mainKey, await release.KeyOf(main, TestContext.Current.CancellationToken));

        var fewerSources = new CacheKeys(request, new HashSet<string>(["CSharpSyntax"], StringComparer.Ordinal), solution.ProblemsOf);
        Assert.NotEqual(mainKey, await fewerSources.KeyOf(main, TestContext.Current.CancellationToken));
    }

    private async Task<ScanResult> Scan(IReadOnlyList<string>? projects = null)
    {
        var output = Path.Combine(_root, "out", Guid.NewGuid().ToString("N"));
        var request = Request() with { OutputDirectory = output, CacheDirectory = Cache, Projects = projects ?? [] };
        return await CSharpScanner.ScanAsync(request, ScanLog.Silent, TestContext.Current.CancellationToken);
    }

    private ScanRequest Request() => new()
    {
        Inputs = [Path.Combine(Fixtures, "CSharpSyntax.slnx")],
        RepositoryRoot = Fixtures,
        OutputDirectory = Path.Combine(_root, "out"),
        RepositoryName = "cache-test",
        Revision = "r1",
        NoRestore = true,
    };

    private Task Edit(int number) => File.AppendAllTextAsync(MainFile, $"\n// cache test: edit {number}\n", TestContext.Current.CancellationToken);

    private static List<string> Entries(string artifactDirectory) =>
        Directory.GetFiles(artifactDirectory, "*.code-model.json.gz").ToList();

    private static void CopyWithoutBinaries(string source, string target)
    {
        Directory.CreateDirectory(target);
        foreach (var file in Directory.EnumerateFiles(source))
            File.Copy(file, Path.Combine(target, Path.GetFileName(file)));
        foreach (var directory in Directory.EnumerateDirectories(source))
        {
            var name = Path.GetFileName(directory);
            if (name is "bin") continue;
            CopyWithoutBinaries(directory, Path.Combine(target, name));
        }
    }
}
