using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Noesis.Parser.CSharp.Bodies;

/// <summary>Finds every body and initializer of a syntax tree and the member it attributes to.</summary>
internal static class BodyRoots
{
    public static IEnumerable<BodyRoot> Of(SyntaxTree tree, SemanticModel model, IMethodSymbol? entryPoint, CancellationToken cancellationToken)
    {
        var root = tree.GetRoot(cancellationToken);
        foreach (var node in root.DescendantNodes(descendIntoChildren: IsContainer))
        {
            var roots = node switch
            {
                BaseMethodDeclarationSyntax method => MethodBody(method, model, cancellationToken),
                BasePropertyDeclarationSyntax property => PropertyBodies(property, model, cancellationToken),
                BaseFieldDeclarationSyntax field => FieldInitializers(field, model, cancellationToken),
                TypeDeclarationSyntax { ParameterList: not null } type => PrimaryConstructorBaseCall(type, model, cancellationToken),
                GlobalStatementSyntax global => TopLevelStatement(global, model, entryPoint, cancellationToken),
                _ => [],
            };
            foreach (var bodyRoot in roots) yield return bodyRoot;
        }
    }

    private static bool IsContainer(SyntaxNode node) =>
        node is CompilationUnitSyntax or BaseNamespaceDeclarationSyntax or TypeDeclarationSyntax;

    /// <summary>Methods, constructors (with their `: this(...)`/`: base(...)` initializer), operators and finalizers.</summary>
    private static IEnumerable<BodyRoot> MethodBody(BaseMethodDeclarationSyntax method, SemanticModel model, CancellationToken cancellationToken)
    {
        if (model.GetDeclaredSymbol(method, cancellationToken) is { } symbol && model.GetOperation(method, cancellationToken) is { } body)
            yield return new BodyRoot(symbol, body);
    }

    /// <summary>Every accessor, the expression body and the initializer of a property, indexer or event, all attributed to the property.</summary>
    private static IEnumerable<BodyRoot> PropertyBodies(BasePropertyDeclarationSyntax property, SemanticModel model, CancellationToken cancellationToken)
    {
        if (model.GetDeclaredSymbol(property, cancellationToken) is not { } symbol) yield break;
        foreach (var accessor in property.AccessorList?.Accessors ?? [])
            if (model.GetOperation(accessor, cancellationToken) is { } accessorBody) yield return new BodyRoot(symbol, accessorBody);
        var expressionBody = (property as PropertyDeclarationSyntax)?.ExpressionBody ?? (property as IndexerDeclarationSyntax)?.ExpressionBody;
        if (expressionBody is not null && model.GetOperation(expressionBody, cancellationToken) is { } arrow)
            yield return new BodyRoot(symbol, arrow);
        if (property is PropertyDeclarationSyntax { Initializer: { } initializer } && model.GetOperation(initializer, cancellationToken) is { } propertyInitializer)
            yield return new BodyRoot(symbol, propertyInitializer);
    }

    /// <summary>Field and event-field initializers; constants are folded by the compiler and have no body.</summary>
    private static IEnumerable<BodyRoot> FieldInitializers(BaseFieldDeclarationSyntax field, SemanticModel model, CancellationToken cancellationToken)
    {
        foreach (var declarator in field.Declaration.Variables)
        {
            if (declarator.Initializer is null) continue;
            var symbol = model.GetDeclaredSymbol(declarator, cancellationToken);
            if (symbol is null or IFieldSymbol { IsConst: true }) continue;
            if (model.GetOperation(declarator.Initializer, cancellationToken) is { } initializer) yield return new BodyRoot(symbol, initializer);
        }
    }

    /// <summary>`class D(int x) : Base(x)`: the base call is the primary constructor's body.</summary>
    private static IEnumerable<BodyRoot> PrimaryConstructorBaseCall(TypeDeclarationSyntax type, SemanticModel model, CancellationToken cancellationToken)
    {
        var baseCall = type.BaseList?.Types.OfType<PrimaryConstructorBaseTypeSyntax>().FirstOrDefault();
        if (baseCall is null || model.GetDeclaredSymbol(type, cancellationToken) is not INamedTypeSymbol typeSymbol) yield break;
        var primaryConstructor = typeSymbol.InstanceConstructors.FirstOrDefault(constructor => constructor.DeclaringSyntaxReferences.Any(reference => reference.GetSyntax(cancellationToken) == type));
        if (primaryConstructor is not null && model.GetOperation(baseCall, cancellationToken) is { } baseInvocation)
            yield return new BodyRoot(primaryConstructor, baseInvocation);
    }

    /// <summary>Top-level statements are the body of the generated `&lt;Main&gt;$`.</summary>
    private static IEnumerable<BodyRoot> TopLevelStatement(GlobalStatementSyntax global, SemanticModel model, IMethodSymbol? entryPoint, CancellationToken cancellationToken)
    {
        if (entryPoint is not null && model.GetOperation(global.Statement, cancellationToken) is { } statement)
            yield return new BodyRoot(entryPoint, statement);
    }
}
