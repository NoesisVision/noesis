using Noesis.Parser.Cli;
using Noesis.Parser.CSharp;

namespace Noesis.Parser.Tests;

public class CommandLineTests
{
    private static readonly string Cwd = Path.GetFullPath("/repo");

    [Fact]
    public void DefaultsFollowTheDesign()
    {
        var parsed = CommandLine.Parse(["src/Solution.sln"], Cwd);
        var request = parsed.Request!;
        Assert.Equal([Path.Combine(Cwd, "src", "Solution.sln")], request.Inputs);
        Assert.Equal(Cwd, request.RepositoryRoot);
        Assert.Equal(Path.Combine(Cwd, ".noesis", "tmp", "parser"), request.OutputDirectory);
        Assert.Equal("Debug", request.Configuration);
        Assert.Empty(request.Projects);
        Assert.Empty(request.ExcludeProjects);
        Assert.Null(request.TargetFramework);
        Assert.False(request.NoRestore);
        Assert.Null(request.CacheDirectory);
        Assert.Equal(Verbosity.Normal, parsed.Verbosity);
        Assert.False(parsed.ShowHelp);
    }

    [Fact]
    public void TheDefaultOutputSitsUnderTheRepositoryRoot()
    {
        var request = CommandLine.Parse(["src/Solution.sln", "--repository-root", ".."], Path.Combine(Cwd, "sub")).Request!;
        Assert.Equal(Path.Combine(Cwd, ".noesis", "tmp", "parser"), request.OutputDirectory);
    }

    [Fact]
    public void EveryOptionIsParsed()
    {
        var parsed = CommandLine.Parse(
        [
            "a.csproj", "b.csproj", "--out", "out", "--repository", "noesis", "--revision", "abc", "--repository-root", "..",
            "--configuration", "Release", "--projects", "Sales.*,Billing", "--exclude-projects", "*.Tests", "--tfm", "net8.0", "--no-restore", "--cache", ".noesis/cache/parser/csharp", "--verbosity", "detailed",
        ], Cwd);
        var request = parsed.Request!;
        Assert.Equal(2, request.Inputs.Count);
        Assert.Equal(Path.Combine(Cwd, "out"), request.OutputDirectory);
        Assert.Equal("noesis", request.RepositoryName);
        Assert.Equal("abc", request.Revision);
        Assert.Equal(Path.GetFullPath(Path.Combine(Cwd, "..")), request.RepositoryRoot);
        Assert.Equal("Release", request.Configuration);
        Assert.Equal(["Sales.*", "Billing"], request.Projects);
        Assert.Equal(["*.Tests"], request.ExcludeProjects);
        Assert.Equal("net8.0", request.TargetFramework);
        Assert.True(request.NoRestore);
        Assert.Equal(Path.Combine(Cwd, ".noesis", "cache", "parser", "csharp"), request.CacheDirectory);
        Assert.Equal(Verbosity.Detailed, parsed.Verbosity);
    }

    [Fact]
    public void InvalidArgumentsAreRefused()
    {
        Assert.Throws<CommandLineException>(() => CommandLine.Parse([], Cwd));
        Assert.Throws<CommandLineException>(() => CommandLine.Parse(["x", "--unknown"], Cwd));
        Assert.Throws<CommandLineException>(() => CommandLine.Parse(["x", "--out"], Cwd));
        Assert.Throws<CommandLineException>(() => CommandLine.Parse(["x", "--verbosity", "loud"], Cwd));
        Assert.True(CommandLine.Parse(["--help"], Cwd).ShowHelp);
    }
}
