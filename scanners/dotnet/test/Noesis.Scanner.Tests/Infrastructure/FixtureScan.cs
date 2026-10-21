using Noesis.Scanner.CSharp;
using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

[assembly: AssemblyFixture(typeof(FixtureScan))]

namespace Noesis.Scanner.Tests.Infrastructure;

/// <summary>One scan of the C# syntax fixture solution, shared by every test of the assembly.</summary>
public sealed class FixtureScan : IAsyncLifetime
{
    public string OutputDirectory { get; } = Path.Combine(Path.GetTempPath(), "noesis-scanner-tests", Guid.NewGuid().ToString("N"));

    public ScanResult Result { get; private set; } = null!;

    public CodeModelFile Main => Result.Model("CSharpSyntax");

    public CodeModelFile Other => Result.Model("CSharpSyntax.OtherProject");

    public async ValueTask InitializeAsync()
    {
        var request = new ScanRequest
        {
            Inputs = [RepositoryPaths.Fixture("CSharpSyntax.slnx")],
            RepositoryRoot = RepositoryPaths.Root,
            OutputDirectory = OutputDirectory,
            RepositoryName = "noesis",
            Revision = "0123456789abcdef",
            NoRestore = true,
        };
        Result = await CSharpScanner.ScanAsync(request, ScanLog.Silent, TestContext.Current.CancellationToken);
    }

    public ValueTask DisposeAsync()
    {
        if (Directory.Exists(OutputDirectory)) Directory.Delete(OutputDirectory, recursive: true);
        return ValueTask.CompletedTask;
    }
}
