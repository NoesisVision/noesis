using Noesis.Scanner.CSharp;
using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

/// <summary>A project with a syntax error and a missing reference still yields a model, with the diagnostics.</summary>
public class BrokenFixtureTests
{
    [Fact]
    public async Task BrokenCodeIsScannedWithDiagnosticsAndExitCodeZero()
    {
        var output = Path.Combine(Path.GetTempPath(), "noesis-scanner-tests", Guid.NewGuid().ToString("N"));
        try
        {
            var result = await CSharpScanner.ScanAsync(new ScanRequest
            {
                Inputs = [RepositoryPaths.BrokenFixturesDirectory],
                RepositoryRoot = RepositoryPaths.Root,
                OutputDirectory = output,
            }, ScanLog.Silent, TestContext.Current.CancellationToken);

            Assert.Equal(ScanExitCode.Success, result.ExitCode);
            Assert.Equal("scanners/dotnet/test/fixtures-broken", result.Manifest.Root);
            var model = Assert.Single(result.Models);
            Assert.Equal("CSharpBroken", model.Artifact.Name);
            Assert.True(File.Exists(Path.Combine(output, result.Manifest.Artifacts.Single().File)));

            var compilerErrors = model.Diagnostics.Where(diagnostic => diagnostic.Source == DiagnosticSource.Compiler && diagnostic.Severity == Model.DiagnosticSeverity.Error).ToList();
            Assert.Contains(compilerErrors, diagnostic => diagnostic.Code == "CS0246" && diagnostic.Message.Contains("MissingType"));
            Assert.Contains(compilerErrors, diagnostic => diagnostic.Location?.File == "scanners/dotnet/test/fixtures-broken/CSharpBroken/SyntaxError.cs");
            Assert.All(compilerErrors, diagnostic => Assert.NotNull(diagnostic.Location));

            var declared = model.Node<TypeNode>("csharp:T:CSharpBroken.UsesMissingType");
            Assert.Equal(TypeKind.Class, declared.TypeKind);
            var field = model.Node<FieldNode>("csharp:F:CSharpBroken.UsesMissingType.Field");
            var unresolved = Assert.IsType<UnresolvedTypeRef>(field.Type);
            Assert.Equal("MissingType", unresolved.Text);
            Assert.True(model.Has("csharp:M:CSharpBroken.UsesMissingType#CallsMissingType()"));
            Assert.Empty(model.Invokes("csharp:M:CSharpBroken.UsesMissingType#CallsMissingType()"));
            Assert.Contains(model.Diagnostics, diagnostic => diagnostic.Source == DiagnosticSource.Scanner && diagnostic.Location?.StartLine == 7);
            Assert.True(model.Has("csharp:T:CSharpBroken.SyntaxErrorClass"));
            Assert.True(model.Has("csharp:M:CSharpBroken.SyntaxErrorClass#IntactMethod()"));
            Expect.One(model.Invokes("csharp:M:CSharpBroken.SyntaxErrorClass#IntactMethod()"), edge => edge.To.Value == "csharp:M:System.Console#WriteLine(string)", "call in an intact member of a broken file");
            Assert.DoesNotContain(model.Stubs, stub => stub.Name == "MissingType");
        }
        finally
        {
            if (Directory.Exists(output)) Directory.Delete(output, recursive: true);
        }
    }

    [Fact]
    public async Task APathWithNoProjectsLoadsNothing()
    {
        var empty = Path.Combine(Path.GetTempPath(), "noesis-scanner-tests", Guid.NewGuid().ToString("N"), "empty");
        Directory.CreateDirectory(empty);
        try
        {
            var result = await CSharpScanner.ScanAsync(new ScanRequest
            {
                Inputs = [empty],
                RepositoryRoot = empty,
                OutputDirectory = Path.Combine(empty, "out"),
                NoRestore = true,
            }, ScanLog.Silent, TestContext.Current.CancellationToken);
            Assert.Equal(ScanExitCode.NothingLoaded, result.ExitCode);
            Assert.Empty(result.Models);
            Assert.NotEmpty(result.Manifest.Diagnostics);
            Assert.True(File.Exists(result.ManifestPath));
        }
        finally
        {
            Directory.Delete(Path.GetDirectoryName(empty)!, recursive: true);
        }
    }
}
