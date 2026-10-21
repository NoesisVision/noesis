using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Microsoft.CodeAnalysis;
using Noesis.Scanner.Model;
using MethodKind = Microsoft.CodeAnalysis.MethodKind;

namespace Noesis.Scanner.CSharp.Mapping;

/// <summary>Stable ids from Roslyn's canonical names: `csharp:T:Ns.Outer`1+Inner`, `csharp:M:Ns.Type#Name`1(int,!!0)`.</summary>
internal sealed class SymbolIds(ScanContext context)
{
    private readonly ConcurrentDictionary<ISymbol, NodeId> _cache = new(SymbolEqualityComparer.Default);
    private readonly ConcurrentDictionary<INamedTypeSymbol, string> _typePaths = new(SymbolEqualityComparer.Default);

    /// <summary>Every declaration symbol an id was built for so far; the stub collector reads the external ones off it.</summary>
    public IEnumerable<ISymbol> ReferencedSymbols => _cache.Keys.ToArray();

    /// <summary>Source artifacts by assembly name; external ones add the assembly version, the identity Roslyn knows for every metadata reference.</summary>
    public NodeId Artifact(IAssemblySymbol assembly) =>
        NodeId.Of(Language.CSharp, NodeKindLetter.Artifact, context.IsSourceAssembly(assembly) ? assembly.Name : assembly.Name + "@" + assembly.Identity.Version);

    public static NodeId ArtifactFromName(string assemblyName) => NodeId.Of(Language.CSharp, NodeKindLetter.Artifact, assemblyName);

    public NodeId Namespace(INamespaceSymbol ns) => NodeId.Of(Language.CSharp, NodeKindLetter.Namespace, NamespacePath(ns));

    public static string NamespacePath(INamespaceSymbol ns) =>
        ns.IsGlobalNamespace ? "" : ns.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat).Replace("global::", "");

    public NodeId Type(INamedTypeSymbol type)
    {
        var definition = type.OriginalDefinition;
        return _cache.GetOrAdd(definition, _ => NodeId.Of(Language.CSharp, NodeKindLetter.Type, TypePath(definition)));
    }

    /// <summary>The type's canonical path: namespace, `+`-nested names with their own `` `arity ``; an extension type is its enclosing class.</summary>
    public string TypePath(INamedTypeSymbol type)
    {
        var definition = type.OriginalDefinition;
        if (definition.IsExtension) return TypePath(definition.ContainingType);
        return _typePaths.GetOrAdd(definition, _ =>
        {
            var name = definition.Name;
            if (definition.IsFileLocal) name += "@" + FileHash(definition);
            if (definition.Arity > 0) name += "`" + definition.Arity;
            if (definition.ContainingType is { } outer) return TypePath(outer) + "+" + name;
            var ns = NamespacePath(definition.ContainingNamespace);
            return ns.Length == 0 ? name : ns + "." + name;
        });
    }

    /// <summary>The id of a member, type or namespace; a partial member and a synthesised extension implementation map to their one declaration.</summary>
    public NodeId Member(ISymbol symbol) =>
        _cache.GetOrAdd(Declaration(symbol), declaration => declaration switch
        {
            IMethodSymbol method => NodeId.Of(Language.CSharp, NodeKindLetter.Method, MethodPath(method)),
            IPropertySymbol property => NodeId.Of(Language.CSharp, NodeKindLetter.Property, OwnerPath(property) + "." + PropertyName(property)),
            IEventSymbol @event => NodeId.Of(Language.CSharp, NodeKindLetter.Property, OwnerPath(@event) + "." + ExplicitlyImplementedName(@event, @event.ExplicitInterfaceImplementations.FirstOrDefault())),
            IFieldSymbol field => NodeId.Of(Language.CSharp, NodeKindLetter.Field, OwnerPath(field) + "." + field.Name),
            INamedTypeSymbol type => Type(type),
            INamespaceSymbol ns => Namespace(ns),
            _ => throw new ArgumentOutOfRangeException(nameof(symbol), symbol.Kind, "Not a declaration symbol."),
        });

    private ISymbol Declaration(ISymbol symbol) => context.Extensions.Normalise(symbol).OriginalDefinition switch
    {
        IMethodSymbol { PartialDefinitionPart: { } definition } => definition,
        IPropertySymbol { PartialDefinitionPart: { } definition } => definition,
        IEventSymbol { PartialDefinitionPart: { } definition } => definition,
        var declaration => declaration,
    };

    /// <summary>The name the node carries: the member name alone, even for explicit implementations.</summary>
    public static string NodeName(ISymbol symbol) => symbol switch
    {
        IMethodSymbol { ExplicitInterfaceImplementations: [{ } implemented, ..] } => implemented.Name,
        IMethodSymbol method => method.MetadataName,
        IPropertySymbol { ExplicitInterfaceImplementations: [{ } implemented, ..] } => implemented.Name,
        IEventSymbol { ExplicitInterfaceImplementations: [{ } implemented, ..] } => implemented.Name,
        _ => symbol.Name,
    };

    private string OwnerPath(ISymbol member) => TypePath(member.ContainingType);

    /// <summary>`Type#Name`arity(parameter types)`, conversions with `:return type`; the extension block's arity counts as the hoisted member's.</summary>
    private string MethodPath(IMethodSymbol method)
    {
        var name = method.MethodKind switch
        {
            MethodKind.Destructor => "Finalize",
            _ when method.ExplicitInterfaceImplementations.Length > 0 => ExplicitlyImplementedName(method, method.ExplicitInterfaceImplementations[0]),
            _ => method.MetadataName,
        };
        var arity = method.Arity + (ExtensionMembers.IsExtensionType(method.ContainingType) ? method.ContainingType.Arity : 0);
        if (arity > 0) name += "`" + arity;
        var parameters = string.Join(",", method.Parameters.Select(parameter => context.Types.IdCanonical(parameter.Type)));
        var suffix = method.MethodKind == MethodKind.Conversion ? ":" + context.Types.IdCanonical(method.ReturnType) : "";
        return OwnerPath(method) + "#" + name + "(" + parameters + ")" + suffix;
    }

    private string PropertyName(IPropertySymbol property)
    {
        var implemented = property.ExplicitInterfaceImplementations.FirstOrDefault();
        if (!property.IsIndexer) return ExplicitlyImplementedName(property, implemented);
        var parameters = string.Join(",", property.Parameters.Select(parameter => context.Types.IdCanonical(parameter.Type)));
        return ExplicitPrefix(implemented) + "this[" + parameters + "]";
    }

    /// <summary>`IFoo`1[int].Bar` for an explicit implementation, built from the interface's canonical string and never from Roslyn's own spelling; the plain name otherwise.</summary>
    private string ExplicitlyImplementedName(ISymbol member, ISymbol? implemented) =>
        implemented is null ? member.Name : ExplicitPrefix(implemented) + implemented.Name;

    private string ExplicitPrefix(ISymbol? implemented) =>
        implemented is null ? "" : context.Types.IdCanonical(implemented.ContainingType) + ".";

    private string FileHash(INamedTypeSymbol type)
    {
        var path = type.DeclaringSyntaxReferences.FirstOrDefault()?.SyntaxTree.FilePath ?? type.MetadataName;
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(context.Locations.RelativePath(path)));
        return Convert.ToHexStringLower(bytes)[..8];
    }
}
