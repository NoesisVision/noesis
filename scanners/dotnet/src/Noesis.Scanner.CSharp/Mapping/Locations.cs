using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Noesis.Scanner.Model;

namespace Noesis.Scanner.CSharp.Mapping;

/// <summary>Source spans with repository-relative, forward-slash file paths and 1-based lines and columns.</summary>
internal sealed class Locations(string repositoryRoot)
{
    public string RelativePath(string path)
    {
        var full = Path.GetFullPath(path);
        var relative = Path.GetRelativePath(repositoryRoot, full);
        if (relative.StartsWith("..", StringComparison.Ordinal) || Path.IsPathRooted(relative)) relative = full;
        return relative.Replace('\\', '/');
    }

    public SourceSpan? SpanOf(Location location)
    {
        if (!location.IsInSource) return null;
        var lineSpan = location.GetLineSpan();
        return new SourceSpan(
            RelativePath(lineSpan.Path),
            lineSpan.StartLinePosition.Line + 1,
            lineSpan.StartLinePosition.Character + 1,
            lineSpan.EndLinePosition.Line + 1,
            lineSpan.EndLinePosition.Character + 1);
    }

    public SourceSpan SpanOf(SyntaxNode node) => SpanOf(node.GetLocation()) ?? throw new InvalidOperationException("A syntax node is always in source.");

    /// <summary>Whole declarations for types and members, name tokens for namespaces; every part of a partial.</summary>
    public IReadOnlyList<SourceSpan> SpansOf(ISymbol symbol)
    {
        var spans = new List<SourceSpan>();
        if (symbol is INamespaceSymbol || symbol.DeclaringSyntaxReferences.Length == 0)
        {
            foreach (var location in symbol.Locations)
                if (SpanOf(location) is { } span) spans.Add(span);
        }
        else
        {
            foreach (var reference in symbol.DeclaringSyntaxReferences)
                spans.Add(SpanOf(DeclarationOf(symbol, reference.GetSyntax())));
        }
        switch (symbol)
        {
            case IMethodSymbol { PartialImplementationPart: { } method }: spans.AddRange(SpansOf(method)); break;
            case IPropertySymbol { PartialImplementationPart: { } property }: spans.AddRange(SpansOf(property)); break;
            case IEventSymbol { PartialImplementationPart: { } @event }: spans.AddRange(SpansOf(@event)); break;
        }
        return spans.Order().ToArray();
    }

    /// <summary>A primary constructor is declared by the type itself; its span is the parameter list, not the whole type.</summary>
    private static SyntaxNode DeclarationOf(ISymbol symbol, SyntaxNode syntax) =>
        symbol is IMethodSymbol && syntax is TypeDeclarationSyntax { ParameterList: { } parameters } ? parameters : syntax;
}
