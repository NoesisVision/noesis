using System.Text.Json;
using Noesis.Parser.Model;
using Noesis.Parser.Tests.Infrastructure;

namespace Noesis.Parser.Tests;

public class JsonTests(ParsedFixture parsed)
{
    [Fact]
    public void ModelFilesRoundTripThroughTheCodec()
    {
        foreach (var model in parsed.Result.Models)
        {
            var json = CodeModelJson.Serialize(model);
            var again = CodeModelJson.Deserialize<CodeModelFile>(json);
            Assert.Equal(json, CodeModelJson.Serialize(again));
            Assert.Equal(model.Nodes.Count, again.Nodes.Count);
            Assert.Equal(model.Edges.Count, again.Edges.Count);
        }
        var manifestJson = CodeModelJson.Serialize(parsed.Result.Manifest);
        Assert.Equal(manifestJson, CodeModelJson.Serialize(CodeModelJson.Deserialize<ParseManifest>(manifestJson)));
    }

    [Fact]
    public void TheWrittenFilesAreTheSerializedModels()
    {
        var manifestOnDisk = File.ReadAllText(parsed.Result.ManifestPath);
        Assert.Equal(CodeModelJson.Serialize(parsed.Result.Manifest), manifestOnDisk);
        foreach (var (artifact, model) in parsed.Result.Manifest.Artifacts.Zip(parsed.Result.Models))
            Assert.Equal(CodeModelJson.Serialize(model), File.ReadAllText(Path.Combine(parsed.OutputDirectory, artifact.File)));
    }

    [Fact]
    public void JsonUsesTheSchemaSpelling()
    {
        using var document = JsonDocument.Parse(CodeModelJson.Serialize(parsed.Main));
        var root = document.RootElement;
        Assert.Equal(1, root.GetProperty("schemaVersion").GetInt32());
        Assert.False(root.TryGetProperty("language", out _));
        Assert.Equal("source", root.GetProperty("artifact").GetProperty("kind").GetString());
        var type = root.GetProperty("nodes").EnumerateArray().First(node => node.GetProperty("id").GetString() == "T:CSharpSyntax.Types.OuterClassWithNestedTypes+ProtectedInternalNestedClass");
        Assert.Equal("type", type.GetProperty("kind").GetString());
        Assert.Equal("class", type.GetProperty("typeKind").GetString());
        Assert.Equal("protectedOrArtifact", type.GetProperty("visibility").GetString());
        Assert.Equal("declared", type.GetProperty("origin").GetString());
        Assert.Equal(JsonValueKind.Null, type.GetProperty("documentation").ValueKind);
        var method = root.GetProperty("nodes").EnumerateArray().First(node => node.GetProperty("id").GetString() == "M:CSharpSyntax.Methods.MethodDeclarations#.cctor()");
        Assert.Equal("staticInitializer", method.GetProperty("methodKind").GetString());
        Assert.Equal("void", method.GetProperty("signature").GetProperty("returnType").GetProperty("kind").GetString());
        Assert.Equal("value", method.GetProperty("signature").GetProperty("returnPassing").GetString());
        var edge = root.GetProperty("edges").EnumerateArray().First(e => e.GetProperty("kind").GetString() == "IMPLEMENTS_MEMBER");
        Assert.Equal("named", edge.GetProperty("interface").GetProperty("kind").GetString());
        var invokes = root.GetProperty("edges").EnumerateArray().First(e => e.GetProperty("kind").GetString() == "INVOKES" && e.GetProperty("invocationKind").GetString() == "extension");
        Assert.True(invokes.GetProperty("site").GetProperty("location").TryGetProperty("startLine", out _));
        var field = root.GetProperty("nodes").EnumerateArray().First(node => node.GetProperty("id").GetString() == "F:CSharpSyntax.Types.PlainEnum.First");
        Assert.Equal("enumMember", field.GetProperty("fieldKind").GetString());
        Assert.Equal(["static", "readonly"], field.GetProperty("modifiers").EnumerateArray().Select(m => m.GetString()));
        var bag = root.GetProperty("nodes").EnumerateArray().First(node => node.GetProperty("id").GetString() == "T:CSharpSyntax.Types.PartialClass").GetProperty("languageSpecific");
        Assert.True(bag.GetProperty("csharp.partial").GetBoolean());
        var stub = root.GetProperty("stubs").EnumerateArray().First(s => s.GetProperty("id").GetString() == "T:System.Object");
        Assert.Equal("type", stub.GetProperty("kind").GetString());
        Assert.Equal("class", stub.GetProperty("typeKind").GetString());
    }
}
