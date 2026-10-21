using System.Text.Json;
using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

public class JsonTests(FixtureScan scan)
{
    [Fact]
    public void ModelFilesRoundTripThroughTheCodec()
    {
        foreach (var model in scan.Result.Models)
        {
            var json = CodeModelJson.Serialize(model);
            var again = CodeModelJson.Deserialize<CodeModelFile>(json);
            Assert.Equal(json, CodeModelJson.Serialize(again));
            Assert.Equal(model.Nodes.Count, again.Nodes.Count);
            Assert.Equal(model.Edges.Count, again.Edges.Count);
        }
        var manifestJson = CodeModelJson.Serialize(scan.Result.Manifest);
        Assert.Equal(manifestJson, CodeModelJson.Serialize(CodeModelJson.Deserialize<ScanManifest>(manifestJson)));
    }

    [Fact]
    public void TheWrittenFilesAreTheSerializedModels()
    {
        var manifestOnDisk = File.ReadAllText(scan.Result.ManifestPath);
        Assert.Equal(CodeModelJson.Serialize(scan.Result.Manifest), manifestOnDisk);
        foreach (var (artifact, model) in scan.Result.Manifest.Artifacts.Zip(scan.Result.Models))
            Assert.Equal(CodeModelJson.Serialize(model), File.ReadAllText(Path.Combine(scan.OutputDirectory, artifact.File)));
    }

    [Fact]
    public void JsonUsesTheSchemaSpelling()
    {
        using var document = JsonDocument.Parse(CodeModelJson.Serialize(scan.Main));
        var root = document.RootElement;
        Assert.Equal(1, root.GetProperty("schemaVersion").GetInt32());
        Assert.Equal("csharp", root.GetProperty("language").GetString());
        Assert.Equal("source", root.GetProperty("artifact").GetProperty("kind").GetString());
        var type = root.GetProperty("nodes").EnumerateArray().First(node => node.GetProperty("id").GetString() == "csharp:T:CSharpSyntax.Types.OuterClassWithNestedTypes+ProtectedInternalNestedClass");
        Assert.Equal("type", type.GetProperty("kind").GetString());
        Assert.Equal("class", type.GetProperty("typeKind").GetString());
        Assert.Equal("protectedOrArtifact", type.GetProperty("visibility").GetString());
        Assert.Equal("declared", type.GetProperty("origin").GetString());
        Assert.Equal(JsonValueKind.Null, type.GetProperty("documentation").ValueKind);
        var method = root.GetProperty("nodes").EnumerateArray().First(node => node.GetProperty("id").GetString() == "csharp:M:CSharpSyntax.Methods.MethodDeclarations#.cctor()");
        Assert.Equal("staticInitializer", method.GetProperty("methodKind").GetString());
        Assert.Equal("void", method.GetProperty("signature").GetProperty("returnType").GetProperty("kind").GetString());
        Assert.Equal("value", method.GetProperty("signature").GetProperty("returnPassing").GetString());
        var edge = root.GetProperty("edges").EnumerateArray().First(e => e.GetProperty("kind").GetString() == "IMPLEMENTS_MEMBER");
        Assert.Equal("named", edge.GetProperty("interface").GetProperty("kind").GetString());
        var invokes = root.GetProperty("edges").EnumerateArray().First(e => e.GetProperty("kind").GetString() == "INVOKES" && e.GetProperty("invocationKind").GetString() == "extension");
        Assert.True(invokes.GetProperty("site").GetProperty("location").TryGetProperty("startLine", out _));
        var field = root.GetProperty("nodes").EnumerateArray().First(node => node.GetProperty("id").GetString() == "csharp:F:CSharpSyntax.Types.PlainEnum.First");
        Assert.Equal("enumMember", field.GetProperty("fieldKind").GetString());
        Assert.Equal(["static", "readonly"], field.GetProperty("modifiers").EnumerateArray().Select(m => m.GetString()));
        var bag = root.GetProperty("nodes").EnumerateArray().First(node => node.GetProperty("id").GetString() == "csharp:T:CSharpSyntax.Types.PartialClass").GetProperty("language");
        Assert.True(bag.GetProperty("csharp.partial").GetBoolean());
        var stub = root.GetProperty("stubs").EnumerateArray().First(s => s.GetProperty("id").GetString() == "csharp:T:System.Object");
        Assert.Equal("type", stub.GetProperty("kind").GetString());
        Assert.Equal("class", stub.GetProperty("typeKind").GetString());
    }
}
