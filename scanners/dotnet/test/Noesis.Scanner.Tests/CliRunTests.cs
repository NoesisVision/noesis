using System.Diagnostics;
using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

public class CliRunTests
{
    [Fact]
    public async Task TheToolScansASolutionAndExitsWithZero()
    {
        var output = Path.Combine(Path.GetTempPath(), "noesis-scanner-tests", Guid.NewGuid().ToString("N"));
        try
        {
            var dll = Path.Combine(AppContext.BaseDirectory, "noesis-scan-dotnet.dll");
            Assert.True(File.Exists(dll), dll);
            var process = Process.Start(new ProcessStartInfo("dotnet")
            {
                ArgumentList = { dll, RepositoryPaths.Fixture("CSharpSyntax.slnx"), "--out", output, "--repository-root", RepositoryPaths.Root, "--repository", "noesis", "--revision", "r1", "--no-restore", "--verbosity", "quiet" },
                RedirectStandardError = true,
                RedirectStandardOutput = true,
                WorkingDirectory = RepositoryPaths.Root,
            })!;
            var stderr = await process.StandardError.ReadToEndAsync(TestContext.Current.CancellationToken);
            await process.WaitForExitAsync(TestContext.Current.CancellationToken);
            Assert.True(process.ExitCode == 0, stderr);
            var manifest = CodeModelJson.Deserialize<ScanManifest>(await File.ReadAllTextAsync(Path.Combine(output, "code-model", "csharp", "manifest.json"), TestContext.Current.CancellationToken));
            Assert.Equal("noesis", manifest.Repository.Name);
            Assert.Equal("r1", manifest.Repository.Revision);
            Assert.Equal(2, manifest.Artifacts.Count);
        }
        finally
        {
            if (Directory.Exists(output)) Directory.Delete(output, recursive: true);
        }
    }

    [Fact]
    public async Task InvalidArgumentsExitWithOne()
    {
        var dll = Path.Combine(AppContext.BaseDirectory, "noesis-scan-dotnet.dll");
        var process = Process.Start(new ProcessStartInfo("dotnet") { ArgumentList = { dll, "--bogus" }, RedirectStandardError = true, RedirectStandardOutput = true })!;
        await process.WaitForExitAsync(TestContext.Current.CancellationToken);
        Assert.Equal(1, process.ExitCode);
    }
}
