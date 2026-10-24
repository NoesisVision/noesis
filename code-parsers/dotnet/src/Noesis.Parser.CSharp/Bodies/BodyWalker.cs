using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;
using Noesis.Parser.CSharp.Mapping;
using Noesis.Parser.Model;
using MethodKind = Microsoft.CodeAnalysis.MethodKind;
using Diagnostic = Noesis.Parser.Model.Diagnostic;
using DiagnosticSeverity = Noesis.Parser.Model.DiagnosticSeverity;

namespace Noesis.Parser.CSharp.Bodies;

/// <summary>
/// Walks one member's operation tree for the four body-level facts: INVOKES, ACCESSES, USES_TYPE and the
/// diagnostics of sites the compiler could not bind. Lambdas and local functions attribute to the member via closure.
/// </summary>
internal sealed class BodyWalker : OperationWalker
{
    /// <summary>What a receiver expression denotes, null when there is none, and whether it was reached through `?.`.</summary>
    private readonly record struct Receiver(ExpressionKind? Kind, bool NullConditional)
    {
        public static readonly Receiver None = new(null, false);
    }

    private readonly ParseContext _context;
    private readonly NodeId _from;
    private readonly RefContext _refContext;
    private readonly List<Edge> _edges;
    private readonly List<Diagnostic> _diagnostics;
    private readonly List<IOperation> _conditionalReceivers = [];
    private int _closureDepth;

    private BodyWalker(ParseContext context, NodeId from, List<Edge> edges, List<Diagnostic> diagnostics, bool extensionMember)
    {
        _context = context;
        _from = from;
        _refContext = new RefContext(false, extensionMember ? from : null);
        _edges = edges;
        _diagnostics = diagnostics;
    }

    public static void Walk(ParseContext context, BodyRoot root, List<Edge> edges, List<Diagnostic> diagnostics)
    {
        var owner = context.Extensions.Normalise(root.Owner);
        var from = context.Ids.Member(owner);
        var extensionMember = ExtensionMembers.IsExtensionType(owner.ContainingType);
        new BodyWalker(context, from, edges, diagnostics, extensionMember).Visit(root.Operation);
    }

    // --- INVOKES -----------------------------------------------------------------------------------------------------

    public override void VisitInvocation(IInvocationOperation operation)
    {
        var target = operation.TargetMethod;
        if (IsInvocationWithoutEdge(target))
        {
            base.VisitInvocation(operation);
            return;
        }
        var normalised = _context.Extensions.Normalise(target.OriginalDefinition);
        var (kind, receiver) = ClassifyInvocation(operation, normalised);
        _edges.Add(new InvokesEdge
        {
            From = _from,
            To = _context.Ids.Member(normalised),
            TypeArguments = TypeArgumentsOf(target),
            Site = Site(operation, receiver.NullConditional),
            InvocationKind = kind,
            Receiver = receiver.Kind,
        });
        base.VisitInvocation(operation);
    }

    /// <summary>Delegate, function pointer, local function and lambda calls produce no edge in this iteration (design section 8); anonymous types have no members to target.</summary>
    private static bool IsInvocationWithoutEdge(IMethodSymbol target) =>
        target.MethodKind is MethodKind.LocalFunction or MethodKind.AnonymousFunction or MethodKind.LambdaMethod or MethodKind.DelegateInvoke or MethodKind.FunctionPointerSignature
        || target.ContainingType is { IsAnonymousType: true };

    /// <summary>`extension` when the source spells an instance call on an extension method or block member; `call` otherwise, with the receiver read off the instance or the spelling.</summary>
    private (InvocationKind Kind, Receiver Receiver) ClassifyInvocation(IInvocationOperation operation, ISymbol normalised)
    {
        var target = operation.TargetMethod;
        if (target.MethodKind == MethodKind.Constructor)
            return (InvocationKind.Call, new Receiver(ReceiverOfConstructorCall(operation), false));
        if (target.IsExtensionMethod && operation.Arguments.Length > 0 && IsReducedSpelling(operation))
            return (InvocationKind.Extension, Classify(operation.Arguments[0].Value));
        if (ExtensionMembers.IsExtensionType(target.ContainingType) && !target.IsStatic)
            return (InvocationKind.Extension, Classify(operation.Instance));
        if (operation.Instance is not null)
            return (InvocationKind.Call, Classify(operation.Instance));
        if (operation.ConstrainedToType is not null)
            return (InvocationKind.Call, new Receiver(ExpressionKind.TypeParameter, false));
        if (normalised.IsStatic || target.IsStatic)
            return (InvocationKind.Call, new Receiver(ExpressionKind.Type, false));
        return (InvocationKind.Call, Receiver.None);
    }

    /// <summary>An extension block's type arguments come first, matching the hoisted member's type parameters.</summary>
    private IReadOnlyList<TypeRef> TypeArgumentsOf(IMethodSymbol target)
    {
        var typeArguments = new List<TypeRef>();
        if (ExtensionMembers.IsExtensionType(target.ContainingType))
            typeArguments.AddRange(target.ContainingType.TypeArguments.Select(argument => _context.Types.Of(argument, _refContext)));
        typeArguments.AddRange(target.TypeArguments.Select(argument => _context.Types.Of(argument, _refContext)));
        return typeArguments;
    }

    public override void VisitObjectCreation(IObjectCreationOperation operation)
    {
        if (operation.Type is { IsAnonymousType: false } type)
        {
            if (operation.Constructor is { } constructor)
                _edges.Add(new InvokesEdge { From = _from, To = _context.Ids.Member(constructor.OriginalDefinition), TypeArguments = ConstructedTypeArguments(type), Site = Site(operation, false), InvocationKind = InvocationKind.Call, Receiver = null });
            else
                AddTypeUse(type, TypeUseRole.Creation, operation);
        }
        base.VisitObjectCreation(operation);
    }

    /// <summary>The constructor is the definition's; the arguments of the created type, CLR-flattened, go on the edge.</summary>
    private IReadOnlyList<TypeRef> ConstructedTypeArguments(ITypeSymbol type) =>
        _context.Types.Of(type, _refContext) is NamedTypeRef named ? named.TypeArguments : [];

    // --- USES_TYPE ---------------------------------------------------------------------------------------------------

    public override void VisitTypeParameterObjectCreation(ITypeParameterObjectCreationOperation operation)
    {
        AddTypeUse(operation.Type, TypeUseRole.Creation, operation);
        base.VisitTypeParameterObjectCreation(operation);
    }

    public override void VisitAnonymousObjectCreation(IAnonymousObjectCreationOperation operation)
    {
        AddTypeUse(operation.Type, TypeUseRole.Creation, operation);
        base.VisitAnonymousObjectCreation(operation);
    }

    public override void VisitArrayCreation(IArrayCreationOperation operation)
    {
        AddTypeUse(operation.Type, TypeUseRole.Creation, operation);
        base.VisitArrayCreation(operation);
    }

    public override void VisitIsType(IIsTypeOperation operation)
    {
        AddTypeUse(operation.TypeOperand, TypeUseRole.TypeTest, operation);
        base.VisitIsType(operation);
    }

    public override void VisitDeclarationPattern(IDeclarationPatternOperation operation)
    {
        if (operation.Syntax is DeclarationPatternSyntax) AddTypeUse(operation.MatchedType, TypeUseRole.TypeTest, operation);
        base.VisitDeclarationPattern(operation);
    }

    public override void VisitTypePattern(ITypePatternOperation operation)
    {
        AddTypeUse(operation.MatchedType, TypeUseRole.TypeTest, operation);
        base.VisitTypePattern(operation);
    }

    public override void VisitRecursivePattern(IRecursivePatternOperation operation)
    {
        if (operation.Syntax is RecursivePatternSyntax { Type: not null }) AddTypeUse(operation.MatchedType, TypeUseRole.TypeTest, operation);
        base.VisitRecursivePattern(operation);
    }

    /// <summary>Only casts the source wrote, `(T)x` and `x as T`; implicit conversions are not a use.</summary>
    public override void VisitConversion(IConversionOperation operation)
    {
        if (!operation.IsImplicit && operation.Syntax is CastExpressionSyntax or BinaryExpressionSyntax { RawKind: (int)SyntaxKind.AsExpression })
            AddTypeUse(operation.Type, TypeUseRole.Cast, operation);
        base.VisitConversion(operation);
    }

    // --- ACCESSES ----------------------------------------------------------------------------------------------------

    public override void VisitPropertyReference(IPropertyReferenceOperation operation)
    {
        AddAccess(operation.Property, operation, operation.Instance, operation.ConstrainedToType);
        base.VisitPropertyReference(operation);
    }

    /// <summary>Tuple fields (`Item1`, named elements) and compiler storage are not members of the model.</summary>
    public override void VisitFieldReference(IFieldReferenceOperation operation)
    {
        if (!operation.Field.IsImplicitlyDeclared && !operation.Field.ContainingType.IsTupleType)
            AddAccess(operation.Field, operation, operation.Instance, null);
        base.VisitFieldReference(operation);
    }

    public override void VisitEventReference(IEventReferenceOperation operation)
    {
        AddAccess(operation.Event, operation, operation.Instance, operation.ConstrainedToType);
        base.VisitEventReference(operation);
    }

    /// <summary>`E += h` and `E -= h` are one readWrite access of the event with the accessor in the site bag; the handler is walked for its own facts.</summary>
    public override void VisitEventAssignment(IEventAssignmentOperation operation)
    {
        if (operation.EventReference is IEventReferenceOperation reference)
        {
            var bag = new Dictionary<string, object> { ["csharp.eventAccessor"] = operation.Adds ? "add" : "remove" };
            AddAccess(reference.Event, reference, reference.Instance, reference.ConstrainedToType, AccessKind.ReadWrite, bag);
            if (reference.Instance is not null) Visit(reference.Instance);
        }
        else
        {
            Visit(operation.EventReference);
        }
        Visit(operation.HandlerValue);
    }

    // --- Closures, skipped operations, unbound sites -----------------------------------------------------------------

    public override void VisitAnonymousFunction(IAnonymousFunctionOperation operation)
    {
        _closureDepth++;
        base.VisitAnonymousFunction(operation);
        _closureDepth--;
    }

    public override void VisitLocalFunction(ILocalFunctionOperation operation)
    {
        _closureDepth++;
        base.VisitLocalFunction(operation);
        _closureDepth--;
    }

    /// <summary>Remembers the receiver of `a?.b` so that sites under `WhenNotNull` can classify `a` and flag `csharp.nullConditional`.</summary>
    public override void VisitConditionalAccess(IConditionalAccessOperation operation)
    {
        Visit(operation.Operation);
        _conditionalReceivers.Add(operation.Operation);
        Visit(operation.WhenNotNull);
        _conditionalReceivers.RemoveAt(_conditionalReceivers.Count - 1);
    }

    public override void VisitNameOf(INameOfOperation operation) { }

    public override void VisitTypeOf(ITypeOfOperation operation) { }

    public override void VisitSizeOf(ISizeOfOperation operation) { }

    /// <summary>A method group is not a call (`REFERENCES_METHOD` is deferred, design section 8); only its receiver is walked.</summary>
    public override void VisitMethodReference(IMethodReferenceOperation operation)
    {
        if (operation.Instance is not null) Visit(operation.Instance);
    }

    public override void VisitInvalid(IInvalidOperation operation)
    {
        AddDiagnostic("NS1002", $"Could not bind '{Text(operation.Syntax)}'.", operation);
        base.VisitInvalid(operation);
    }

    public override void VisitDynamicMemberReference(IDynamicMemberReferenceOperation operation)
    {
        AddDiagnostic("NS1003", $"Member '{operation.MemberName}' is reached through dynamic and not bound.", operation);
        base.VisitDynamicMemberReference(operation);
    }

    public override void VisitDynamicInvocation(IDynamicInvocationOperation operation)
    {
        if (operation.Operation is not IDynamicMemberReferenceOperation)
            AddDiagnostic("NS1003", $"Invocation '{Text(operation.Syntax)}' is bound dynamically.", operation);
        base.VisitDynamicInvocation(operation);
    }

    public override void VisitDynamicObjectCreation(IDynamicObjectCreationOperation operation)
    {
        AddDiagnostic("NS1003", $"Creation '{Text(operation.Syntax)}' is bound dynamically.", operation);
        base.VisitDynamicObjectCreation(operation);
    }

    public override void VisitDynamicIndexerAccess(IDynamicIndexerAccessOperation operation)
    {
        AddDiagnostic("NS1003", $"Indexer access '{Text(operation.Syntax)}' is bound dynamically.", operation);
        base.VisitDynamicIndexerAccess(operation);
    }

    // --- Emitting ----------------------------------------------------------------------------------------------------

    private void AddAccess(ISymbol member, IMemberReferenceOperation reference, IOperation? instance, ITypeSymbol? constrainedTo, AccessKind? access = null, Dictionary<string, object>? bag = null)
    {
        if (member.ContainingType is { IsAnonymousType: true }) return;
        var receiver = instance is not null ? Classify(instance)
            : constrainedTo is not null ? new Receiver(ExpressionKind.TypeParameter, false)
            : new Receiver(ExpressionKind.Type, false);
        _edges.Add(new AccessesEdge
        {
            From = _from,
            To = _context.Ids.Member(member),
            Access = access ?? AccessKindOf(reference),
            Site = Site(reference, receiver.NullConditional, bag),
            Receiver = receiver.Kind,
        });
    }

    private void AddTypeUse(ITypeSymbol? type, TypeUseRole role, IOperation operation)
    {
        if (type is null) return;
        _edges.Add(new UsesTypeEdge { From = _from, To = _context.Types.Of(type, _refContext), Role = role, Site = Site(operation, false) });
    }

    private void AddDiagnostic(string code, string message, IOperation operation) =>
        _diagnostics.Add(new Diagnostic(DiagnosticSeverity.Info, code, message, _context.Locations.SpanOf(operation.Syntax), DiagnosticSource.Parser));

    private UsageSite Site(IOperation operation, bool nullConditional, Dictionary<string, object>? bag = null)
    {
        bag ??= new Dictionary<string, object>();
        if (nullConditional) bag["csharp.nullConditional"] = true;
        return new UsageSite(_context.Locations.SpanOf(operation.Syntax), _closureDepth > 0, LanguageBag.Of(bag));
    }

    // --- Classifying expressions -------------------------------------------------------------------------------------

    private static ExpressionKind ReceiverOfConstructorCall(IInvocationOperation operation) => operation.Syntax.Kind() switch
    {
        SyntaxKind.ThisConstructorInitializer => ExpressionKind.This,
        _ => ExpressionKind.Base,
    };

    /// <summary>`x.Ext()` as opposed to `Extensions.Ext(x)`: the receiver argument sits outside the argument list.</summary>
    private static bool IsReducedSpelling(IInvocationOperation operation)
    {
        if (operation.Syntax is not InvocationExpressionSyntax invocation) return true;
        var receiverSyntax = operation.Arguments[0].Syntax;
        return !invocation.ArgumentList.Span.Contains(receiverSyntax.Span);
    }

    /// <summary>Looks through parentheses, conversions, awaits and `?.` to what the receiver expression denotes.</summary>
    private Receiver Classify(IOperation? operation)
    {
        var nullConditional = false;
        while (true)
        {
            switch (operation)
            {
                case null:
                    return new Receiver(ExpressionKind.Other, nullConditional);
                case IParenthesizedOperation parenthesized:
                    operation = parenthesized.Operand;
                    continue;
                case IConversionOperation conversion:
                    operation = conversion.Operand;
                    continue;
                case IAwaitOperation await:
                    operation = await.Operation;
                    continue;
                case IConditionalAccessInstanceOperation:
                    nullConditional = true;
                    operation = _conditionalReceivers.Count > 0 ? _conditionalReceivers[^1] : null;
                    if (operation is IConditionalAccessInstanceOperation) return new Receiver(ExpressionKind.Other, nullConditional);
                    continue;
                default:
                    return new Receiver(KindOf(operation), nullConditional);
            }
        }
    }

    private static ExpressionKind KindOf(IOperation operation) => operation switch
    {
        IInstanceReferenceOperation instance => ClassifyInstance(instance),
        IParameterReferenceOperation => ExpressionKind.Parameter,
        ILocalReferenceOperation => ExpressionKind.Local,
        IFieldReferenceOperation => ExpressionKind.Field,
        IPropertyReferenceOperation or IEventReferenceOperation => ExpressionKind.Property,
        IInvocationOperation => ExpressionKind.ReturnValue,
        IObjectCreationOperation or ITypeParameterObjectCreationOperation or IArrayCreationOperation or IAnonymousObjectCreationOperation or ICollectionExpressionOperation or IWithOperation => ExpressionKind.Creation,
        ILiteralOperation or IDefaultValueOperation or INameOfOperation => ExpressionKind.Literal,
        _ => ExpressionKind.Other,
    };

    /// <summary>`this`, `base`, or the implicit receiver of an object initializer, which counts as the creation.</summary>
    private static ExpressionKind ClassifyInstance(IInstanceReferenceOperation instance)
    {
        switch (instance.Syntax.Kind())
        {
            case SyntaxKind.BaseExpression:
            case SyntaxKind.BaseConstructorInitializer:
            case SyntaxKind.PrimaryConstructorBaseType:
                return ExpressionKind.Base;
            case SyntaxKind.ThisConstructorInitializer:
                return ExpressionKind.This;
        }
        switch (instance.ReferenceKind)
        {
            case InstanceReferenceKind.ContainingTypeInstance:
                return ExpressionKind.This;
            case InstanceReferenceKind.ImplicitReceiver:
                for (var parent = instance.Parent; parent is not null; parent = parent.Parent)
                {
                    if (parent is IObjectCreationOperation or IAnonymousObjectCreationOperation or ITypeParameterObjectCreationOperation) return ExpressionKind.Creation;
                    if (parent is IWithOperation or IPatternOperation) return ExpressionKind.Other;
                }
                return ExpressionKind.Other;
            default:
                return ExpressionKind.Other;
        }
    }

    /// <summary>Read, write or both, from the operation the reference sits in: assignment target, compound assignment, `out`/`ref` argument, `ref` expression.</summary>
    private static AccessKind AccessKindOf(IOperation reference)
    {
        var node = reference;
        var parent = reference.Parent;
        while (parent is ITupleOperation or IParenthesizedOperation)
        {
            node = parent;
            parent = parent.Parent;
        }
        switch (parent)
        {
            case ISimpleAssignmentOperation assignment when ReferenceEquals(assignment.Target, node):
                return AccessKind.Write;
            case IDeconstructionAssignmentOperation deconstruction when ReferenceEquals(deconstruction.Target, node):
                return AccessKind.Write;
            case ICompoundAssignmentOperation compound when ReferenceEquals(compound.Target, node):
                return AccessKind.ReadWrite;
            case ICoalesceAssignmentOperation coalesce when ReferenceEquals(coalesce.Target, node):
                return AccessKind.ReadWrite;
            case IIncrementOrDecrementOperation:
                return AccessKind.ReadWrite;
            case IArgumentOperation argument:
                return argument.Parameter?.RefKind switch
                {
                    RefKind.Out => AccessKind.Write,
                    RefKind.Ref => AccessKind.ReadWrite,
                    _ => AccessKind.Read,
                };
        }
        return reference.Syntax.Parent is RefExpressionSyntax ? AccessKind.ReadWrite : AccessKind.Read;
    }

    private static string Text(SyntaxNode syntax)
    {
        var text = syntax.ToString().ReplaceLineEndings(" ");
        return text.Length <= 120 ? text : text[..120] + "…";
    }
}
