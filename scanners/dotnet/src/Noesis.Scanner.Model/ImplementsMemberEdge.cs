namespace Noesis.Scanner.Model;

public sealed record ImplementsMemberEdge : Edge
{
    /// <summary>The interface member definition.</summary>
    public required NodeId To { get; init; }
    /// <summary>The constructed interface, which tells `IFoo&lt;int&gt;` from `IFoo&lt;string&gt;` on one type.</summary>
    public required TypeRef Interface { get; init; }
    /// <summary>The type whose interface list produced this mapping.</summary>
    public required NodeId DeclaredOn { get; init; }
}