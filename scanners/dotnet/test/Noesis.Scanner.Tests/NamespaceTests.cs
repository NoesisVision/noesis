using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

public class NamespaceTests(FixtureScan scan)
{
    [Fact]
    public void TheGlobalNamespaceIsTheRootTheArtifactContains()
    {
        var global = scan.Main.Namespace("");
        Assert.Equal("", global.Name);
        Assert.Equal(Origin.Declared, global.Origin);
        Assert.True(scan.Main.Contains("csharp:A:CSharpSyntax", "csharp:N:"));
        Assert.True(scan.Main.Contains("csharp:N:", "csharp:N:CSharpSyntax"));
        Assert.True(scan.Main.Contains("csharp:N:", "csharp:T:Program"));
    }

    [Fact]
    public void EveryLevelOfADottedNameIsANode()
    {
        foreach (var level in new[] { "CSharpSyntax", "CSharpSyntax.Usings", "CSharpSyntax.Usings.Dotted", "CSharpSyntax.Usings.Dotted.Deeply", "CSharpSyntax.Usings.Dotted.Deeply.Nested" })
            scan.Main.Namespace(level);
        Assert.Equal("Nested", scan.Main.Namespace("CSharpSyntax.Usings.Dotted.Deeply.Nested").Name);
        Assert.True(scan.Main.Contains("csharp:N:CSharpSyntax.Usings.Dotted.Deeply", "csharp:N:CSharpSyntax.Usings.Dotted.Deeply.Nested"));
        Assert.True(scan.Main.Contains("csharp:N:CSharpSyntax.Usings.Dotted.Deeply.Nested", "csharp:T:CSharpSyntax.Usings.Dotted.Deeply.Nested.ClassInDeeplyNestedNamespace"));
        Assert.True(scan.Main.Contains("csharp:N:CSharpSyntax.Usings.Dotted.Deeply.Nested", "csharp:T:CSharpSyntax.Usings.Dotted.Deeply.Nested.Types"));
    }

    [Fact]
    public void NamespaceLocationsAreRepositoryRelativeWithForwardSlashes()
    {
        var dotted = scan.Main.Namespace("CSharpSyntax.Usings.Dotted");
        var location = Assert.Single(dotted.Locations);
        Assert.Equal("scanners/dotnet/test/fixtures/CSharpSyntax/Usings/DottedNamespaceAndTypeNameConflicts.cs", location.File);
        Assert.Equal(4, location.StartLine);
        Assert.True(location.StartColumn >= 1);
        Assert.True(scan.Main.Namespace("CSharpSyntax.Usings").Locations.Count >= 3);
    }

    [Fact]
    public void BlockFileScopedAndNestedDeclarationsAllYieldNamespaces()
    {
        Assert.True(scan.Main.Contains("csharp:N:CSharpSyntax.Usings.FileScoped", "csharp:T:CSharpSyntax.Usings.FileScoped.ClassInFileScopedNamespace"));
        Assert.True(scan.Main.Contains("csharp:N:CSharpSyntax.Usings", "csharp:T:CSharpSyntax.Usings.UsingDirectiveForms"));
        Assert.True(scan.Main.Contains("csharp:N:CSharpSyntax.Usings.NestedBlockNamespace", "csharp:T:CSharpSyntax.Usings.NestedBlockNamespace.ClassInNestedBlockNamespace"));
        Assert.True(scan.Main.Contains("csharp:N:CSharpSyntax.Usings.SecondNamespaceInSameFile", "csharp:T:CSharpSyntax.Usings.SecondNamespaceInSameFile.ClassInSecondNamespace"));
    }

    [Fact]
    public void ANamespaceDeclaredInBothProjectsAppearsInEachArtifactWithItsOwnTypes()
    {
        Assert.True(scan.Main.Contains("csharp:N:CSharpSyntax.SharedNamespace", "csharp:T:CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromMainProject"));
        Assert.False(scan.Main.Has("csharp:T:CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromOtherProject"));
        Assert.True(scan.Other.Contains("csharp:N:CSharpSyntax.SharedNamespace", "csharp:T:CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromOtherProject"));
        Expect.TypeRef("CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromOtherProject",
            scan.Main.Field("CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromMainProject.FromOtherProjectPartOfSameNamespace").Type);
        Assert.False(scan.Main.HasStub("csharp:T:CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromOtherProject"));
    }

    [Fact]
    public void NamespacesCarryNoAnnotationsAndNoDocumentation()
    {
        var types = scan.Main.Namespace("CSharpSyntax.Types");
        Assert.Empty(types.Annotations);
        Assert.Null(types.Documentation);
        Assert.Empty(types.Language);
    }
}
