using Noesis.Parser.Model;
using Noesis.Parser.Tests.Infrastructure;

namespace Noesis.Parser.Tests;

public class NamespaceTests(ParsedFixture parsed)
{
    [Fact]
    public void TheGlobalNamespaceIsTheRootTheArtifactContains()
    {
        var global = parsed.Main.Namespace("");
        Assert.Equal("", global.Name);
        Assert.Equal(Origin.Declared, global.Origin);
        Assert.True(parsed.Main.Contains("A:CSharpSyntax", "N:"));
        Assert.True(parsed.Main.Contains("N:", "N:CSharpSyntax"));
        Assert.True(parsed.Main.Contains("N:", "T:Program"));
    }

    [Fact]
    public void EveryLevelOfADottedNameIsANode()
    {
        foreach (var level in new[] { "CSharpSyntax", "CSharpSyntax.Usings", "CSharpSyntax.Usings.Dotted", "CSharpSyntax.Usings.Dotted.Deeply", "CSharpSyntax.Usings.Dotted.Deeply.Nested" })
            parsed.Main.Namespace(level);
        Assert.Equal("Nested", parsed.Main.Namespace("CSharpSyntax.Usings.Dotted.Deeply.Nested").Name);
        Assert.True(parsed.Main.Contains("N:CSharpSyntax.Usings.Dotted.Deeply", "N:CSharpSyntax.Usings.Dotted.Deeply.Nested"));
        Assert.True(parsed.Main.Contains("N:CSharpSyntax.Usings.Dotted.Deeply.Nested", "T:CSharpSyntax.Usings.Dotted.Deeply.Nested.ClassInDeeplyNestedNamespace"));
        Assert.True(parsed.Main.Contains("N:CSharpSyntax.Usings.Dotted.Deeply.Nested", "T:CSharpSyntax.Usings.Dotted.Deeply.Nested.Types"));
    }

    [Fact]
    public void NamespaceLocationsAreRepositoryRelativeWithForwardSlashes()
    {
        var dotted = parsed.Main.Namespace("CSharpSyntax.Usings.Dotted");
        var location = Assert.Single(dotted.Locations);
        Assert.Equal("code-parsers/dotnet/test/fixtures/CSharpSyntax/Usings/DottedNamespaceAndTypeNameConflicts.cs", location.File);
        Assert.Equal(4, location.StartLine);
        Assert.True(location.StartColumn >= 1);
        Assert.True(parsed.Main.Namespace("CSharpSyntax.Usings").Locations.Count >= 3);
    }

    [Fact]
    public void BlockFileScopedAndNestedDeclarationsAllYieldNamespaces()
    {
        Assert.True(parsed.Main.Contains("N:CSharpSyntax.Usings.FileScoped", "T:CSharpSyntax.Usings.FileScoped.ClassInFileScopedNamespace"));
        Assert.True(parsed.Main.Contains("N:CSharpSyntax.Usings", "T:CSharpSyntax.Usings.UsingDirectiveForms"));
        Assert.True(parsed.Main.Contains("N:CSharpSyntax.Usings.NestedBlockNamespace", "T:CSharpSyntax.Usings.NestedBlockNamespace.ClassInNestedBlockNamespace"));
        Assert.True(parsed.Main.Contains("N:CSharpSyntax.Usings.SecondNamespaceInSameFile", "T:CSharpSyntax.Usings.SecondNamespaceInSameFile.ClassInSecondNamespace"));
    }

    [Fact]
    public void ANamespaceDeclaredInBothProjectsAppearsInEachArtifactWithItsOwnTypes()
    {
        Assert.True(parsed.Main.Contains("N:CSharpSyntax.SharedNamespace", "T:CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromMainProject"));
        Assert.False(parsed.Main.Has("T:CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromOtherProject"));
        Assert.True(parsed.Other.Contains("N:CSharpSyntax.SharedNamespace", "T:CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromOtherProject"));
        Expect.TypeRef("CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromOtherProject",
            parsed.Main.Field("CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromMainProject.FromOtherProjectPartOfSameNamespace").Type);
        Assert.False(parsed.Main.HasStub("T:CSharpSyntax.SharedNamespace.ClassInSharedNamespaceFromOtherProject"));
    }

    [Fact]
    public void NamespacesCarryNoAnnotationsAndNoDocumentation()
    {
        var types = parsed.Main.Namespace("CSharpSyntax.Types");
        Assert.Empty(types.Annotations);
        Assert.Null(types.Documentation);
        Assert.Empty(types.LanguageSpecific);
    }
}
