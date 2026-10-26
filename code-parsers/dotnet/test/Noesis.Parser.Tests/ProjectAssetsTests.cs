using Noesis.Parser.Model;
using Noesis.Parser.CSharp.Loading;

namespace Noesis.Parser.Tests;

/// <summary>Reading `project.assets.json`: package mapping and framework reference assemblies, wherever the targeting pack sits.</summary>
public class ProjectAssetsTests
{
    private const string Assets = """
        {
          "libraries": {
            "NodaTime/3.3.2": { "type": "package", "path": "nodatime/3.3.2" },
            "CSharpSyntax.OtherProject/1.0.0": { "type": "project", "path": "../CSharpSyntax.OtherProject/CSharpSyntax.OtherProject.csproj" }
          },
          "project": {
            "frameworks": {
              "net10.0": {
                "frameworkReferences": { "Microsoft.NETCore.App": { "privateAssets": "all" }, "Microsoft.AspNetCore.App": { "privateAssets": "none" } }
              }
            }
          }
        }
        """;

    [Fact]
    public void FrameworkAssembliesArePlatformWhetherTheSdkOrNuGetShipsThePack()
    {
        var assets = Load(Assets);
        Assert.True(assets.IsFrameworkAssembly("/usr/lib64/dotnet/packs/Microsoft.NETCore.App.Ref/10.0.0/ref/net10.0/System.Runtime.dll"));
        Assert.True(assets.IsFrameworkAssembly("/home/me/.nuget/packages/microsoft.netcore.app.ref/10.0.0/ref/net10.0/System.Runtime.dll"));
        Assert.True(assets.IsFrameworkAssembly(@"C:\Program Files\dotnet\packs\Microsoft.AspNetCore.App.Ref\10.0.0\ref\net10.0\Microsoft.AspNetCore.Http.dll"));
        Assert.False(assets.IsFrameworkAssembly("/usr/lib64/dotnet/packs/Microsoft.WindowsDesktop.App.Ref/10.0.0/ref/net10.0/PresentationCore.dll"));
        Assert.False(assets.IsFrameworkAssembly("/home/me/.nuget/packages/nodatime/3.3.2/lib/net8.0/NodaTime.dll"));
        Assert.False(assets.IsFrameworkAssembly(null));
    }

    [Fact]
    public void PackagesMapByTheirExtractedDirectoryAndProjectsDoNot()
    {
        var assets = Load(Assets);
        Assert.Equal(new PackageReference("NodaTime", "3.3.2"), assets.PackageOf("/home/me/.nuget/packages/nodatime/3.3.2/lib/net8.0/NodaTime.dll"));
        Assert.Null(assets.PackageOf("/repo/CSharpSyntax.OtherProject/bin/Debug/net10.0/CSharpSyntax.OtherProject.dll"));
        Assert.Null(assets.PackageOf(null));
    }

    [Fact]
    public void MissingOrBrokenRestoreOutputYieldsNothing()
    {
        Assert.False(ProjectAssets.Empty.IsFrameworkAssembly("/usr/lib64/dotnet/packs/Microsoft.NETCore.App.Ref/10.0.0/ref/net10.0/System.Runtime.dll"));
        Assert.Null(Load("{ not json").PackageOf("/home/me/.nuget/packages/nodatime/3.3.2/lib/net8.0/NodaTime.dll"));
    }

    private static ProjectAssets Load(string json)
    {
        var directory = Path.Combine(Path.GetTempPath(), "noesis-parser-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(directory, "obj"));
        File.WriteAllText(Path.Combine(directory, "obj", "project.assets.json"), json);
        try
        {
            return ProjectAssets.Load(Path.Combine(directory, "Project.csproj"));
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }
}
