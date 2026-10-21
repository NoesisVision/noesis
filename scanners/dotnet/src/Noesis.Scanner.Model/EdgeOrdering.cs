namespace Noesis.Scanner.Model;

public static class EdgeOrdering
{
    /// <summary>Sort key: kind, from, canonical string of the target, location.</summary>
    public static (string Kind, string From, string To, SourceSpan? Location) KeyOf(Edge edge) => edge switch
    {
        ContainsEdge e => ("CONTAINS", e.From.Value, e.To.Value, null),
        ExtendsEdge e => ("EXTENDS", e.From.Value, e.To.Canonical, null),
        ImplementsEdge e => ("IMPLEMENTS", e.From.Value, e.To.Canonical, null),
        OverridesEdge e => ("OVERRIDES", e.From.Value, e.To.Value, null),
        ImplementsMemberEdge e => ("IMPLEMENTS_MEMBER", e.From.Value, e.To.Value + "@" + e.Interface.Canonical + "@" + e.DeclaredOn.Value, null),
        AnnotatedWithEdge e => ("ANNOTATED_WITH", e.From.Value, e.Annotation.Type.Canonical, null),
        InvokesEdge e => ("INVOKES", e.From.Value, e.To.Value, e.Site.Location),
        AccessesEdge e => ("ACCESSES", e.From.Value, e.To.Value, e.Site.Location),
        UsesTypeEdge e => ("USES_TYPE", e.From.Value, e.To.Canonical, e.Site.Location),
        _ => throw new ArgumentOutOfRangeException(nameof(edge), edge, null),
    };

    public static int Compare(Edge left, Edge right)
    {
        var (leftKind, leftFrom, leftTo, leftLocation) = KeyOf(left);
        var (rightKind, rightFrom, rightTo, rightLocation) = KeyOf(right);
        var result = string.CompareOrdinal(leftKind, rightKind);
        if (result != 0) return result;
        result = string.CompareOrdinal(leftFrom, rightFrom);
        if (result != 0) return result;
        result = string.CompareOrdinal(leftTo, rightTo);
        if (result != 0) return result;
        return leftLocation is null ? (rightLocation is null ? 0 : -1) : leftLocation.CompareTo(rightLocation);
    }
}