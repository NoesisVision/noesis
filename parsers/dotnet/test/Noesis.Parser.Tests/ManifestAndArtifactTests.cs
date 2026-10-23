using Noesis.Parser.CSharp;
using Noesis.Parser.Model;
using Noesis.Parser.Tests.Infrastructure;

namespace Noesis.Parser.Tests;

public class ManifestAndArtifactTests(ParsedFixture parsed)
{
    private const string Main = "A:CSharpSyntax";
    private const string Other = "A:CSharpSyntax.OtherProject";

    [Fact]
    public void ParseSucceedsAndWritesEveryFileTheManifestLists()
    {
        Assert.Equal(ParseExitCode.Success, parsed.Result.ExitCode);
        Assert.True(File.Exists(parsed.Result.ManifestPath));
        foreach (var artifact in parsed.Result.Manifest.Artifacts)
            Assert.True(File.Exists(Path.Combine(parsed.OutputDirectory, artifact.File)), artifact.File);
    }

    [Fact]
    public void ManifestCarriesSchemaRepositoryAndRootRelativeToTheRepository()
    {
        var manifest = parsed.Result.Manifest;
        Assert.Equal(1, manifest.SchemaVersion);
        Assert.Equal(Language.CSharp, manifest.Language);
        Assert.Equal("noesis-parse-csharp", manifest.Generator.Name);
        Assert.Equal("noesis", manifest.Repository.Name);
        Assert.Equal("0123456789abcdef", manifest.Repository.Revision);
        Assert.Equal("parsers/dotnet/test/fixtures/CSharpSyntax.slnx", manifest.Root);
        Assert.Empty(manifest.Diagnostics);
    }

    [Fact]
    public void ManifestListsArtifactsInDependencyOrder()
    {
        var artifacts = parsed.Result.Manifest.Artifacts;
        Assert.Equal([Other, Main], artifacts.Select(artifact => artifact.Id.Value));
        Assert.Equal("code-model/csharp/CSharpSyntax.OtherProject.code-model.json", artifacts[0].File);
        Assert.Equal("code-model/csharp/CSharpSyntax.code-model.json", artifacts[1].File);
    }

    [Fact]
    public void ModelFilesCarrySchemaVersionAndNoCompilerDiagnosticsForCleanFixtures()
    {
        foreach (var model in parsed.Result.Models)
        {
            Assert.Equal(1, model.SchemaVersion);
            Assert.DoesNotContain(model.Diagnostics, diagnostic => diagnostic.Source == DiagnosticSource.Compiler);
        }
    }

    [Fact]
    public void MainArtifactDescribesTheExecutableProject()
    {
        var artifact = parsed.Main.Artifact;
        Assert.Equal(Main, artifact.Id.Value);
        Assert.Equal(ArtifactKind.Source, artifact.Kind);
        Assert.Equal("CSharpSyntax", artifact.Name);
        Assert.Equal("1.0.0.0", artifact.Version);
        Assert.Equal("parsers/dotnet/test/fixtures/CSharpSyntax", artifact.RootDirectory);
        Assert.Equal("net10.0", artifact.Target);
        Assert.True(artifact.Executable);
        Assert.Equal("CSharpSyntax", artifact.LanguageSpecific["csharp.projectName"]);
        Assert.Equal("parsers/dotnet/test/fixtures/CSharpSyntax/CSharpSyntax.csproj", artifact.LanguageSpecific["csharp.projectFile"]);
        Assert.Equal("CSharpSyntax", artifact.LanguageSpecific["csharp.rootNamespace"]);
        Assert.Equal("ConsoleApplication", artifact.LanguageSpecific["csharp.outputKind"]);
    }

    [Fact]
    public void OtherArtifactIsALibraryWithAssemblyLevelAnnotations()
    {
        var artifact = parsed.Other.Artifact;
        Assert.False(artifact.Executable);
        Assert.Equal("DynamicallyLinkedLibrary", artifact.LanguageSpecific["csharp.outputKind"]);
        var internalsVisibleTo = Assert.Single(artifact.Annotations, annotation => annotation.Type.Canonical == "System.Runtime.CompilerServices.InternalsVisibleToAttribute");
        var argument = Assert.Single(internalsVisibleTo.Arguments);
        Assert.Equal("assemblyName", argument.Name);
        Assert.True(argument.Positional);
        Assert.Equal("\"CSharpSyntax\"", Assert.IsType<LiteralAnnotationValue>(argument.Value).Text);
        Assert.Contains(parsed.Main.Artifact.Annotations, annotation => annotation.Type.Canonical == "System.Runtime.Versioning.TargetFrameworkAttribute");
    }

    [Fact]
    public void DependenciesTellSourceLibraryAndPlatformApart()
    {
        var dependencies = parsed.Main.Artifact.Dependencies;
        var other = Assert.Single(dependencies, dependency => dependency.Id.Value == Other);
        Assert.Equal(ArtifactKind.Source, other.Kind);
        Assert.Null(other.Package);

        var nodaTime = Assert.Single(dependencies, dependency => dependency.Id.Value == "A:NodaTime@3.3.2.0");
        Assert.Equal(ArtifactKind.Library, nodaTime.Kind);
        Assert.Equal(new PackageReference("NodaTime", "3.3.2"), nodaTime.Package);

        var annotations = Assert.Single(dependencies, dependency => dependency.Id.Value.StartsWith("A:JetBrains.Annotations@", StringComparison.Ordinal));
        Assert.Equal(new PackageReference("JetBrains.Annotations", "2025.2.4"), annotations.Package);

        var runtime = Assert.Single(dependencies, dependency => dependency.Id.Value == "A:System.Runtime@10.0.0.0");
        Assert.Equal(ArtifactKind.Platform, runtime.Kind);
        Assert.Null(runtime.Package);
        Assert.Equal(dependencies.OrderBy(dependency => dependency.Id).Select(dependency => dependency.Id), dependencies.Select(dependency => dependency.Id));
    }

    [Fact]
    public void OtherArtifactDependsOnTheAnnotationsLibraryAndThePlatformOnly()
    {
        var dependencies = parsed.Other.Artifact.Dependencies;
        var annotations = Assert.Single(dependencies, dependency => dependency.Kind != ArtifactKind.Platform);
        Assert.Equal(ArtifactKind.Library, annotations.Kind);
        Assert.Equal(new PackageReference("NoesisVision.Annotations", "0.1.3"), annotations.Package);
    }
}
