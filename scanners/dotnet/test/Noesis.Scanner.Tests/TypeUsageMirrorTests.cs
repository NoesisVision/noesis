using System.Text.RegularExpressions;
using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

/// <summary>
/// The three `TypeUsage` fixtures put a type from the own project, from the referenced project and from NuGet
/// in the same positions under the same member names; the models must differ only in the ids the references point at.
/// </summary>
public partial class TypeUsageMirrorTests(FixtureScan scan)
{
    private const string OwnType = "CSharpSyntax.TypeUsage.OwnProjectTypeUsage";
    private const string OtherType = "CSharpSyntax.TypeUsage.OtherProjectTypeUsage";
    private const string NuGetType = "CSharpSyntax.TypeUsage.NuGetPackageTypeUsage";

    /// <summary>
    /// Members whose shapes differ by the fixtures' own choice, not by where the type comes from: constant and default
    /// texts spell the enum member, and the attributes used in the three files have different arguments.
    /// </summary>
    private static readonly HashSet<string> OwnVersusOtherExclusions =
    [
        "ConstEnumField", "OptionalEnumParameter", "AttributedParameter", "AttributedReturn",
    ];

    /// <summary>As above, plus the tuple element names and indexer parameter names the NuGet fixture spells differently.</summary>
    private static readonly HashSet<string> OwnVersusNuGetExclusions =
    [
        "ConstEnumField", "OptionalEnumParameter", "AttributedParameter", "AttributedReturn", "TupleField", "TupleParameter", "this[]",
    ];

    [Fact]
    public void OwnAndOtherProjectUsagesHaveTheSameShapes()
    {
        var mismatches = Compare(scan.Main, OwnType, OtherType, OwnVersusOtherExclusions);
        Assert.True(mismatches.Count == 0, string.Join("\n", mismatches));
    }

    [Fact]
    public void OwnAndNuGetUsagesHaveTheSameShapesWhereTheFixturesMirror()
    {
        var mismatches = Compare(scan.Main, OwnType, NuGetType, OwnVersusNuGetExclusions);
        Assert.True(mismatches.Count == 0, string.Join("\n", mismatches));
    }

    [Fact]
    public void TheMirroredMembersAreAMeaningfulSet()
    {
        var shared = SharedMembers(scan.Main, OwnType, OtherType, OwnVersusOtherExclusions);
        Assert.True(shared.Count >= 50, $"only {shared.Count} shared members");
        Assert.Contains("ClassField", shared);
        Assert.Contains("RefReadonlyParameter", shared);
        Assert.Contains("ConstrainedToClass", shared);
        Assert.Contains("op_Implicit", shared);
    }

    private static List<string> SharedMembers(CodeModelFile model, string left, string right, HashSet<string> exclusions) =>
        MembersOf(model, left).Keys.Intersect(MembersOf(model, right).Keys).Where(name => !exclusions.Contains(name)).Order().ToList();

    private static List<string> Compare(CodeModelFile model, string left, string right, HashSet<string> exclusions)
    {
        var leftMembers = MembersOf(model, left);
        var rightMembers = MembersOf(model, right);
        var mismatches = new List<string>();
        foreach (var name in SharedMembers(model, left, right, exclusions))
        {
            var leftShape = Shape(leftMembers[name], left);
            var rightShape = Shape(rightMembers[name], right);
            if (leftShape != rightShape) mismatches.Add($"{name}:\n  {leftShape}\n  {rightShape}");
        }
        return mismatches;
    }

    private static Dictionary<string, DeclarationNode> MembersOf(CodeModelFile model, string type)
    {
        var prefixes = new[] { "csharp:M:" + type + "#", "csharp:R:" + type + ".", "csharp:F:" + type + "." };
        var members = new Dictionary<string, DeclarationNode>();
        foreach (var node in model.Nodes.Where(node => prefixes.Any(prefix => node.Id.Value.StartsWith(prefix, StringComparison.Ordinal))))
            members.TryAdd(node.Name, node);
        return members;
    }

    private static string Shape(DeclarationNode node, string owner)
    {
        var json = CodeModelJson.Serialize(node);
        json = json.Replace(owner, "<owner>");
        json = IdPattern().Replace(json, "\"<id>\"");
        json = LocationPattern().Replace(json, "\"<location>\"");
        json = json.Replace("\"nullable\": true", "\"nullable\": <n>").Replace("\"nullable\": false", "\"nullable\": <n>");
        return Regex.Replace(json, "\\s+", " ");
    }

    [GeneratedRegex("\"csharp:[TMRFN]:[^\"]*\"")]
    private static partial Regex IdPattern();

    [GeneratedRegex("\"(file|startLine|startColumn|endLine|endColumn)\": [^,}]*")]
    private static partial Regex LocationPattern();
}
