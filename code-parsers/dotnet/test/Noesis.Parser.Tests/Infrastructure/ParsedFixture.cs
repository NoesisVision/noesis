using Noesis.Parser.CSharp;
using Noesis.Parser.Model;
using Noesis.Parser.Tests.Infrastructure;

[assembly: AssemblyFixture(typeof(ParsedFixture))]

namespace Noesis.Parser.Tests.Infrastructure;

/// <summary>One parse of the C# syntax fixture solution, shared by every test of the assembly.</summary>
public sealed class ParsedFixture : IAsyncLifetime
{
    public string OutputDirectory { get; } = Path.Combine(Path.GetTempPath(), "noesis-parser-tests", Guid.NewGuid().ToString("N"));

    public ParseResult Result { get; private set; } = null!;

    public CodeModelFile Main => Result.Model("CSharpSyntax");

    public CodeModelFile Other => Result.Model("CSharpSyntax.OtherProject");

    public async ValueTask InitializeAsync()
    {
        var request = new ParseRequest
        {
            Inputs = [RepositoryPaths.Fixture("CSharpSyntax.slnx")],
            RepositoryRoot = RepositoryPaths.Root,
            OutputDirectory = OutputDirectory,
            RepositoryName = "noesis",
            Revision = "0123456789abcdef",
            NoRestore = true,
        };
        Result = await CSharpParser.ParseAsync(request, ParseLog.Silent, TestContext.Current.CancellationToken);
    }

    public ValueTask DisposeAsync()
    {
        if (Directory.Exists(OutputDirectory)) Directory.Delete(OutputDirectory, recursive: true);
        return ValueTask.CompletedTask;
    }
}
