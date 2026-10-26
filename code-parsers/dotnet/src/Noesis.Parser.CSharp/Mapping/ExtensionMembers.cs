using System.Collections.Concurrent;
using Microsoft.CodeAnalysis;

namespace Noesis.Parser.CSharp.Mapping;

/// <summary>
/// C# 14 `extension(...)` blocks: Roslyn models each block as an unspeakable nested extension type and synthesises a
/// static implementation method per member on the enclosing class. Every symbol Roslyn hands back for such a member
/// is normalised to the member declared in the block, which the model hoists onto the enclosing class.
/// </summary>
internal sealed class ExtensionMembers
{
    private readonly ConcurrentDictionary<INamedTypeSymbol, Dictionary<IMethodSymbol, ISymbol>> _implementations = new(SymbolEqualityComparer.Default);

    public static bool IsExtensionType(INamedTypeSymbol? type) => type is { IsExtension: true };

    /// <summary>The block member a synthesised implementation method stands for; the symbol itself otherwise.</summary>
    public ISymbol Normalise(ISymbol symbol)
    {
        if (symbol is not IMethodSymbol { IsImplicitlyDeclared: true, IsStatic: true, ContainingType: { } owner } method || IsExtensionType(owner)) return symbol;
        var definition = method.OriginalDefinition;
        var map = _implementations.GetOrAdd(owner.OriginalDefinition, BuildMap);
        return map.TryGetValue(definition, out var member) ? member : symbol;
    }

    public bool IsImplementation(IMethodSymbol method) => !ReferenceEquals(Normalise(method), method);

    private static Dictionary<IMethodSymbol, ISymbol> BuildMap(INamedTypeSymbol owner)
    {
        var map = new Dictionary<IMethodSymbol, ISymbol>(SymbolEqualityComparer.Default);
        foreach (var extension in owner.GetTypeMembers().Where(IsExtensionType))
            foreach (var member in extension.GetMembers())
            {
                switch (member)
                {
                    case IMethodSymbol { AssociatedSymbol: null } method when method.AssociatedExtensionImplementation is { } implementation:
                        map[implementation.OriginalDefinition] = method;
                        break;
                    case IPropertySymbol property:
                        foreach (var accessor in new[] { property.GetMethod, property.SetMethod })
                            if (accessor?.AssociatedExtensionImplementation is { } implementation)
                                map[implementation.OriginalDefinition] = property;
                        break;
                }
            }
        return map;
    }
}
