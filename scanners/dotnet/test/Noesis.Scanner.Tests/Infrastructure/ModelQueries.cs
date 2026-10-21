using Noesis.Scanner.Model;

namespace Noesis.Scanner.Tests.Infrastructure;

public static class ModelQueries
{
    public static DeclarationNode? Find(this CodeModelFile model, string id) =>
        model.Nodes.FirstOrDefault(node => node.Id.Value == id);

    public static bool Has(this CodeModelFile model, string id) => model.Find(id) is not null;

    public static T Node<T>(this CodeModelFile model, string id) where T : DeclarationNode
    {
        var node = model.Find(id);
        Assert.True(node is not null, $"No node {id}. Closest: {string.Join(", ", model.Nodes.Select(n => n.Id.Value).Where(v => v.Contains(LastSegment(id))).Take(5))}");
        return Assert.IsType<T>(node);
    }

    public static TypeNode Type(this CodeModelFile model, string path) => model.Node<TypeNode>("csharp:T:" + path);

    public static MethodNode Method(this CodeModelFile model, string path) => model.Node<MethodNode>("csharp:M:" + path);

    public static PropertyNode Property(this CodeModelFile model, string path) => model.Node<PropertyNode>("csharp:R:" + path);

    public static FieldNode Field(this CodeModelFile model, string path) => model.Node<FieldNode>("csharp:F:" + path);

    public static NamespaceNode Namespace(this CodeModelFile model, string path) => model.Node<NamespaceNode>("csharp:N:" + path);

    public static IEnumerable<T> Edges<T>(this CodeModelFile model) where T : Edge => model.Edges.OfType<T>();

    public static IEnumerable<T> EdgesFrom<T>(this CodeModelFile model, string from) where T : Edge =>
        model.Edges<T>().Where(edge => edge.From.Value == from);

    public static IEnumerable<InvokesEdge> Invokes(this CodeModelFile model, string from) => model.EdgesFrom<InvokesEdge>(from);

    public static IEnumerable<AccessesEdge> Accesses(this CodeModelFile model, string from) => model.EdgesFrom<AccessesEdge>(from);

    public static IEnumerable<UsesTypeEdge> UsesTypes(this CodeModelFile model, string from) => model.EdgesFrom<UsesTypeEdge>(from);

    public static bool Contains(this CodeModelFile model, string from, string to) =>
        model.Edges<ContainsEdge>().Any(edge => edge.From.Value == from && edge.To.Value == to);

    public static IEnumerable<string> ExtendsOf(this CodeModelFile model, string from) =>
        model.EdgesFrom<ExtendsEdge>(from).Select(edge => edge.To.Canonical);

    public static IEnumerable<string> ImplementsOf(this CodeModelFile model, string from) =>
        model.EdgesFrom<ImplementsEdge>(from).Select(edge => edge.To.Canonical);

    public static IEnumerable<string> OverridesOf(this CodeModelFile model, string from) =>
        model.EdgesFrom<OverridesEdge>(from).Select(edge => edge.To.Value);

    public static IEnumerable<ImplementsMemberEdge> ImplementsMembersOf(this CodeModelFile model, string from) =>
        model.EdgesFrom<ImplementsMemberEdge>(from);

    public static IEnumerable<Annotation> AnnotationsOf(this CodeModelFile model, string from) =>
        model.EdgesFrom<AnnotatedWithEdge>(from).Select(edge => edge.Annotation);

    public static StubNode Stub(this CodeModelFile model, string id)
    {
        var stub = model.Stubs.FirstOrDefault(stub => stub.Id.Value == id);
        Assert.True(stub is not null, $"No stub {id}. Closest: {string.Join(", ", model.Stubs.Select(s => s.Id.Value).Where(v => v.Contains(LastSegment(id))).Take(5))}");
        return stub;
    }

    public static bool HasStub(this CodeModelFile model, string id) => model.Stubs.Any(stub => stub.Id.Value == id);

    public static IEnumerable<string> ModifierNames(this IReadOnlyList<Modifier> modifiers) => modifiers.Select(m => m.ToString());

    public static object? Bag(this DeclarationNode node, string key) => node.Language.TryGetValue(key, out var value) ? value : null;

    public static object? Bag(this Parameter parameter, string key) => parameter.Language.TryGetValue(key, out var value) ? value : null;

    public static object? Bag(this UsageSite site, string key) => site.Language.TryGetValue(key, out var value) ? value : null;

    public static Parameter Parameter(this MethodNode method, string name) => method.Signature.Parameters.Single(parameter => parameter.Name == name);

    private static string LastSegment(string id)
    {
        var trimmed = id.TrimEnd(')');
        var cut = trimmed.LastIndexOfAny(['.', '#', '+']);
        return cut < 0 ? id : trimmed[(cut + 1)..].Split('(')[0];
    }
}

/// <summary>Expected type references, compared through their canonical string.</summary>
public static class Expect
{
    public static void TypeRef(string canonical, TypeRef actual) => Assert.Equal(canonical, actual.Canonical);

    public static void Modifiers(IReadOnlyList<Modifier> actual, params Modifier[] expected) =>
        Assert.Equal(expected.Select(m => m.ToString()), actual.ModifierNames());

    public static void Single<T>(IEnumerable<T> edges, Func<T, bool> predicate, string what)
    {
        var matches = edges.Where(predicate).ToList();
        Assert.True(matches.Count == 1, $"Expected exactly one {what}, found {matches.Count}");
    }

    public static T One<T>(IEnumerable<T> edges, Func<T, bool> predicate, string what)
    {
        var matches = edges.Where(predicate).ToList();
        Assert.True(matches.Count >= 1, $"Expected a {what}, found none among {edges.Count()} candidates");
        return matches[0];
    }

    public static void None<T>(IEnumerable<T> edges, Func<T, bool> predicate, string what)
    {
        var matches = edges.Where(predicate).ToList();
        Assert.True(matches.Count == 0, $"Expected no {what}, found {matches.Count}");
    }
}
