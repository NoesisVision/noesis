using Microsoft.CodeAnalysis;
using Noesis.Parser.Model;
using TypeKind = Noesis.Parser.Model.TypeKind;
using RoslynTypeKind = Microsoft.CodeAnalysis.TypeKind;

namespace Noesis.Parser.CSharp.Mapping;

/// <summary>
/// The external closure: every symbol outside the parsed projects that an id was built for, plus its containing types
/// and namespaces and, for a type, its base chain, each stub with the owning assembly. Run once after both walks.
/// </summary>
internal sealed class StubCollector(ParseContext context)
{
    private readonly Dictionary<NodeId, StubNode> _stubs = [];
    private readonly Dictionary<NodeId, NamespaceStub> _namespaces = [];
    private readonly List<Edge> _edges = [];
    private readonly Queue<ISymbol> _pending = new();
    private readonly HashSet<INamedTypeSymbol> _seenTypes = new(SymbolEqualityComparer.Default);

    /// <summary>A namespace may be declared by several assemblies; the stub names the first by id.</summary>
    private sealed record NamespaceStub(string Name, SortedSet<NodeId> Artifacts);

    public StubSet Build()
    {
        foreach (var symbol in context.Ids.ReferencedSymbols.Where(context.IsExternal))
            _pending.Enqueue(symbol);
        while (_pending.TryDequeue(out var symbol))
        {
            switch (symbol)
            {
                case INamespaceSymbol ns: AddNamespaceChain(ns, ns.ContainingAssembly); break;
                case INamedTypeSymbol type: AddType(type.OriginalDefinition); break;
                case IMethodSymbol or IPropertySymbol or IEventSymbol or IFieldSymbol: AddMember(symbol); break;
            }
        }
        foreach (var (id, ns) in _namespaces)
            _stubs[id] = new StubNode(id, StubKind.Namespace, ns.Name, null, ns.Artifacts.Min);
        return new StubSet(_stubs.Values.ToArray(), _edges);
    }

    private void AddNamespaceChain(INamespaceSymbol ns, IAssemblySymbol? assembly)
    {
        for (var current = ns; current is { IsGlobalNamespace: false }; current = current.ContainingNamespace)
        {
            var id = context.Ids.Namespace(current);
            if (!_namespaces.TryGetValue(id, out var entry))
                _namespaces[id] = entry = new NamespaceStub(current.Name, []);
            if ((assembly ?? current.ContainingAssembly) is { } owner) entry.Artifacts.Add(context.Ids.Artifact(owner));
        }
    }

    private void AddType(INamedTypeSymbol type)
    {
        if (!_seenTypes.Add(type)) return;
        var id = context.Ids.Type(type);
        _stubs[id] = new StubNode(id, StubKind.Type, type.Name, TypeKindOf(type), ArtifactOf(type));
        if (type.ContainingType is { } outer) _pending.Enqueue(outer);
        else AddNamespaceChain(type.ContainingNamespace, type.ContainingAssembly);
        AddBaseChain(type, id);
    }

    /// <summary>EXTENDS and IMPLEMENTS of the stub, with the bases stubbed in turn; their members are not.</summary>
    private void AddBaseChain(INamedTypeSymbol type, NodeId id)
    {
        if (type.TypeKind is not (RoslynTypeKind.Class or RoslynTypeKind.Struct or RoslynTypeKind.Interface)) return;
        if (type.TypeKind == RoslynTypeKind.Class && type.BaseType is { SpecialType: not SpecialType.System_Object } baseType)
        {
            _edges.Add(new ExtendsEdge { From = id, To = context.Types.Of(baseType, RefContext.Node) });
            _pending.Enqueue(baseType.OriginalDefinition);
        }
        foreach (var @interface in type.Interfaces)
        {
            var reference = context.Types.Of(@interface, RefContext.Node);
            _edges.Add(type.TypeKind == RoslynTypeKind.Interface ? new ExtendsEdge { From = id, To = reference } : new ImplementsEdge { From = id, To = reference });
            _pending.Enqueue(@interface.OriginalDefinition);
        }
    }

    private void AddMember(ISymbol member)
    {
        var id = context.Ids.Member(member);
        var kind = member switch
        {
            IMethodSymbol => StubKind.Method,
            IPropertySymbol or IEventSymbol => StubKind.Property,
            _ => StubKind.Field,
        };
        _stubs[id] = new StubNode(id, kind, SymbolIds.NodeName(member), null, ArtifactOf(member));
        _pending.Enqueue(member.ContainingType);
    }

    private NodeId? ArtifactOf(ISymbol symbol) => symbol.ContainingAssembly is { } assembly ? context.Ids.Artifact(assembly) : null;

    public static TypeKind TypeKindOf(INamedTypeSymbol type) => type.TypeKind switch
    {
        RoslynTypeKind.Interface => TypeKind.Interface,
        RoslynTypeKind.Struct => TypeKind.Struct,
        RoslynTypeKind.Enum => TypeKind.Enum,
        RoslynTypeKind.Delegate => TypeKind.Delegate,
        _ => TypeKind.Class,
    };
}
