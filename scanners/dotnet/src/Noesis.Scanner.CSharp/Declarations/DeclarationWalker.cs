using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Noesis.Scanner.CSharp.Mapping;
using Noesis.Scanner.Model;
using MethodKind = Noesis.Scanner.Model.MethodKind;
using TypeKind = Noesis.Scanner.Model.TypeKind;
using RoslynMethodKind = Microsoft.CodeAnalysis.MethodKind;
using RoslynTypeKind = Microsoft.CodeAnalysis.TypeKind;

namespace Noesis.Scanner.CSharp.Declarations;

/// <summary>
/// Walks the assembly's symbol tree into nodes and structural edges: namespaces, types, members, CONTAINS, EXTENDS,
/// IMPLEMENTS, OVERRIDES, IMPLEMENTS_MEMBER and ANNOTATED_WITH. Bodies are the body walker's job.
/// </summary>
internal sealed class DeclarationWalker(ScanContext context)
{
    private readonly List<DeclarationNode> _nodes = [];
    private readonly List<Edge> _edges = [];

    public IReadOnlyList<DeclarationNode> Nodes => _nodes;
    public IReadOnlyList<Edge> Edges => _edges;

    public void Walk(NodeId artifactId)
    {
        var global = context.OwnAssembly.GlobalNamespace;
        var globalId = WalkNamespace(global);
        _edges.Add(new ContainsEdge { From = artifactId, To = globalId });
    }

    private NodeId WalkNamespace(INamespaceSymbol ns)
    {
        var id = context.Ids.Namespace(ns);
        _nodes.Add(new NamespaceNode
        {
            Id = id,
            Name = ns.Name,
            Origin = Origin.Declared,
            Locations = context.Locations.SpansOf(ns),
            Annotations = [],
            Documentation = null,
            Language = LanguageBag.Empty,
        });
        foreach (var child in ns.GetNamespaceMembers())
            _edges.Add(new ContainsEdge { From = id, To = WalkNamespace(child) });
        foreach (var type in ns.GetTypeMembers())
            if (WalkType(type) is { } typeId) _edges.Add(new ContainsEdge { From = id, To = typeId });
        return id;
    }

    private NodeId? WalkType(INamedTypeSymbol type)
    {
        if (!ShouldEmit(type)) return null;
        var id = context.Ids.Type(type);
        var syntaxModifiers = SyntaxModifiers(type);
        var annotations = context.Annotations.Of(type);
        _nodes.Add(new TypeNode
        {
            Id = id,
            Name = type.Name,
            Origin = IsTopLevelProgram(type) ? Origin.Generated : Origin.Declared,
            Locations = context.Locations.SpansOf(type),
            Annotations = annotations,
            Documentation = Documentation(type),
            Language = LanguageBag.Of(TypeBag(type, syntaxModifiers)),
            TypeKind = StubCollector.TypeKindOf(type),
            Visibility = type.IsFileLocal ? Visibility.File : VisibilityOf(type.DeclaredAccessibility),
            Modifiers = TypeModifiers(type, syntaxModifiers),
            TypeParameters = context.Signatures.TypeParametersOf(type.TypeParameters, RefContext.Node),
            UnderlyingType = type.EnumUnderlyingType is { } underlying ? context.Types.Of(underlying, RefContext.Node) : null,
            DelegateSignature = type.DelegateInvokeMethod is { } invoke ? context.Signatures.SignatureOf(invoke, RefContext.Node) : null,
            AliasOf = null,
        });
        AddAnnotationEdges(id, annotations);
        AddBaseEdges(type, id);
        WalkMembers(type, id);
        AddInterfaceMemberEdges(type, id);
        return id;
    }

    private void WalkMembers(INamedTypeSymbol type, NodeId id)
    {
        foreach (var member in type.GetMembers())
        {
            NodeId? memberId = member switch
            {
                INamedTypeSymbol { IsExtension: true } extension => WalkExtensionBlock(extension, id),
                INamedTypeSymbol nested => WalkType(nested),
                IMethodSymbol method => WalkMethod(method, null),
                IPropertySymbol property => WalkProperty(property, null),
                IEventSymbol @event => WalkEvent(@event, null),
                IFieldSymbol field => WalkField(field),
                _ => null,
            };
            if (memberId is { } contained) _edges.Add(new ContainsEdge { From = id, To = contained });
        }
    }

    /// <summary>Hoists every member of a C# 14 `extension(...)` block onto the enclosing static class; the block itself is no node.</summary>
    private NodeId? WalkExtensionBlock(INamedTypeSymbol extension, NodeId ownerId)
    {
        var receiver = extension.ExtensionParameter?.Type;
        foreach (var member in extension.GetMembers())
        {
            NodeId? memberId = member switch
            {
                IMethodSymbol method => WalkMethod(method, receiver),
                IPropertySymbol property => WalkProperty(property, receiver),
                IEventSymbol @event => WalkEvent(@event, receiver),
                _ => null,
            };
            if (memberId is { } contained) _edges.Add(new ContainsEdge { From = ownerId, To = contained });
        }
        return null;
    }

    private NodeId? WalkMethod(IMethodSymbol method, ITypeSymbol? extensionReceiver)
    {
        if (!ShouldEmit(method)) return null;
        var id = context.Ids.Member(method);
        var refContext = new RefContext(false, extensionReceiver is null ? null : id);
        var syntaxModifiers = SyntaxModifiers(method);
        var declaredKind = method.ExplicitInterfaceImplementations.FirstOrDefault()?.MethodKind ?? method.MethodKind;
        var receiver = extensionReceiver ?? (method.IsExtensionMethod ? method.Parameters[0].Type : null);
        var annotations = context.Annotations.Of(method);
        _nodes.Add(new MethodNode
        {
            Id = id,
            Name = SymbolIds.NodeName(method),
            Origin = method.IsImplicitlyDeclared || IsTopLevelEntryPoint(method) ? Origin.Generated : Origin.Declared,
            Locations = method.IsImplicitlyDeclared ? [] : context.Locations.SpansOf(method),
            Annotations = annotations,
            Documentation = Documentation(method),
            Language = LanguageBag.Of(MethodBag(method, declaredKind, syntaxModifiers, extensionReceiver is not null)),
            MethodKind = MethodKindOf(declaredKind),
            Visibility = VisibilityOf(method.DeclaredAccessibility),
            Modifiers = MethodModifiers(method, syntaxModifiers),
            TypeParameters = MethodTypeParameters(method, refContext),
            Signature = context.Signatures.SignatureOf(method, refContext),
            ExtensionReceiver = receiver is null ? null : context.Types.Of(receiver, refContext),
            Bodiless = method.IsAbstract || method.IsExtern || method.IsPartialDefinition && method.PartialImplementationPart is null,
        });
        AddAnnotationEdges(id, annotations);
        if (method.OverriddenMethod is { } overridden) AddOverridesEdge(id, overridden);
        return id;
    }

    private NodeId? WalkProperty(IPropertySymbol property, ITypeSymbol? extensionReceiver)
    {
        if (!ShouldEmit(property)) return null;
        var id = context.Ids.Member(property);
        var refContext = new RefContext(false, extensionReceiver is null ? null : id);
        var syntaxModifiers = SyntaxModifiers(property);
        var annotations = context.Annotations.Of(property);
        _nodes.Add(new PropertyNode
        {
            Id = id,
            Name = SymbolIds.NodeName(property),
            Origin = property.IsImplicitlyDeclared ? Origin.Generated : Origin.Declared,
            Locations = property.IsImplicitlyDeclared ? [] : context.Locations.SpansOf(property),
            Annotations = annotations,
            Documentation = Documentation(property),
            Language = LanguageBag.Of(PropertyBag(property, syntaxModifiers, extensionReceiver is not null)),
            Visibility = VisibilityOf(property.DeclaredAccessibility),
            Modifiers = MemberModifiers(property.IsStatic, property.IsAbstract, property.IsSealed, property.IsVirtual, property.IsOverride, property.IsExtern, syntaxModifiers),
            Type = context.Types.Of(property.Type, refContext),
            ReturnPassing = property.ReturnsByRef || property.ReturnsByRefReadonly ? Passing.Ref : Passing.Value,
            Parameters = context.Signatures.ParametersOf(property.Parameters, refContext),
            ExtensionReceiver = extensionReceiver is null ? null : context.Types.Of(extensionReceiver, refContext),
            Accessors = AccessorsOf(property),
        });
        AddAnnotationEdges(id, annotations);
        if (property.OverriddenProperty is { } overridden) AddOverridesEdge(id, overridden);
        return id;
    }

    private NodeId? WalkEvent(IEventSymbol @event, ITypeSymbol? extensionReceiver)
    {
        if (@event.IsImplicitlyDeclared) return null;
        var id = context.Ids.Member(@event);
        var refContext = new RefContext(false, extensionReceiver is null ? null : id);
        var syntaxModifiers = SyntaxModifiers(@event);
        var annotations = context.Annotations.Of(@event);
        _nodes.Add(new PropertyNode
        {
            Id = id,
            Name = SymbolIds.NodeName(@event),
            Origin = Origin.Declared,
            Locations = context.Locations.SpansOf(@event),
            Annotations = annotations,
            Documentation = Documentation(@event),
            Language = LanguageBag.Of(EventBag(@event, extensionReceiver is not null)),
            Visibility = VisibilityOf(@event.DeclaredAccessibility),
            Modifiers = MemberModifiers(@event.IsStatic, @event.IsAbstract, @event.IsSealed, @event.IsVirtual, @event.IsOverride, @event.IsExtern, syntaxModifiers),
            Type = context.Types.Of(@event.Type, refContext),
            ReturnPassing = Passing.Value,
            Parameters = [],
            ExtensionReceiver = extensionReceiver is null ? null : context.Types.Of(extensionReceiver, refContext),
            Accessors = [Accessor.Add, Accessor.Remove],
        });
        AddAnnotationEdges(id, annotations);
        if (@event.OverriddenEvent is { } overridden) AddOverridesEdge(id, overridden);
        return id;
    }

    private NodeId? WalkField(IFieldSymbol field)
    {
        if (!ShouldEmit(field)) return null;
        var id = context.Ids.Member(field);
        var syntaxModifiers = SyntaxModifiers(field);
        var isEnumMember = field.ContainingType.TypeKind == RoslynTypeKind.Enum && field.IsConst;
        var annotations = context.Annotations.Of(field);
        _nodes.Add(new FieldNode
        {
            Id = id,
            Name = field.Name,
            Origin = Origin.Declared,
            Locations = context.Locations.SpansOf(field),
            Annotations = annotations,
            Documentation = Documentation(field),
            Language = LanguageBag.Of(FieldBag(field, syntaxModifiers)),
            FieldKind = isEnumMember ? FieldKind.EnumMember : FieldKind.Field,
            Visibility = VisibilityOf(field.DeclaredAccessibility),
            Modifiers = FieldModifiers(field, syntaxModifiers),
            Type = context.Types.Of(FieldType(field), RefContext.Node),
            Passing = field.RefKind == RefKind.None ? Passing.Value : Passing.Ref,
            ConstantValue = ConstantText(field),
        });
        AddAnnotationEdges(id, annotations);
        return id;
    }

    // --- What is emitted ---------------------------------------------------------------------------------------------

    /// <summary>Extension blocks are hoisted, anonymous types are structural references, and of the compiler's own types only the top-level `Program` is a node.</summary>
    private static bool ShouldEmit(INamedTypeSymbol type) =>
        !type.IsExtension && !type.IsAnonymousType && (!type.IsImplicitlyDeclared || IsTopLevelProgram(type));

    /// <summary>Callable surface only: no accessors, no synthesised extension implementations, no implicit constructors of enums and delegates.</summary>
    private bool ShouldEmit(IMethodSymbol method)
    {
        switch (method.MethodKind)
        {
            case RoslynMethodKind.Ordinary:
            case RoslynMethodKind.Constructor:
            case RoslynMethodKind.StaticConstructor:
            case RoslynMethodKind.Destructor:
            case RoslynMethodKind.UserDefinedOperator:
            case RoslynMethodKind.Conversion:
            case RoslynMethodKind.ExplicitInterfaceImplementation:
            case RoslynMethodKind.DelegateInvoke:
                break;
            default:
                return false;
        }
        if (method.AssociatedSymbol is not null) return false;
        if (!method.IsImplicitlyDeclared) return true;
        if (method.MethodKind == RoslynMethodKind.StaticConstructor) return false;
        var owner = method.ContainingType.TypeKind;
        if (method.MethodKind == RoslynMethodKind.Constructor && owner is RoslynTypeKind.Enum or RoslynTypeKind.Delegate) return false;
        return !context.Extensions.IsImplementation(method);
    }

    /// <summary>Of the synthesised record properties only `EqualityContract` is callable surface.</summary>
    private static bool ShouldEmit(IPropertySymbol property) =>
        !property.IsImplicitlyDeclared || property.Name == "EqualityContract";

    /// <summary>Backing fields, `value__` and other compiler storage are never nodes.</summary>
    private static bool ShouldEmit(IFieldSymbol field) =>
        !field.IsImplicitlyDeclared && field.AssociatedSymbol is null;

    // --- Language bags -----------------------------------------------------------------------------------------------

    private static Dictionary<string, object> TypeBag(INamedTypeSymbol type, SyntaxTokenList syntaxModifiers)
    {
        var bag = new Dictionary<string, object>();
        if (type.DeclaringSyntaxReferences.Length > 1 || syntaxModifiers.Any(SyntaxKind.PartialKeyword)) bag["csharp.partial"] = true;
        if (syntaxModifiers.Any(SyntaxKind.UnsafeKeyword)) bag["csharp.unsafe"] = true;
        if (type.IsRefLikeType) bag["csharp.isRefStruct"] = true;
        if (type.IsReadOnly && type.TypeKind == RoslynTypeKind.Struct) bag["csharp.isReadonlyStruct"] = true;
        if (type.IsFileLocal) bag["csharp.isFileLocal"] = true;
        if (type.InstanceConstructors.Any(IsPrimaryConstructor)) bag["csharp.primaryConstructor"] = true;
        if (type.TypeKind == RoslynTypeKind.Delegate && type.DelegateInvokeMethod is { ReturnsByRefReadonly: true }) bag["csharp.readonlyRef"] = true;
        return bag;
    }

    private static Dictionary<string, object> MethodBag(IMethodSymbol method, RoslynMethodKind declaredKind, SyntaxTokenList syntaxModifiers, bool inExtensionBlock)
    {
        var bag = new Dictionary<string, object>();
        if (method.IsPartialDefinition) bag["csharp.partial"] = true;
        if (syntaxModifiers.Any(SyntaxKind.UnsafeKeyword)) bag["csharp.unsafe"] = true;
        if (method.IsReadOnly && !method.ContainingType.IsReadOnly) bag["csharp.readonlyMember"] = true;
        if (method.ExplicitInterfaceImplementations.Length > 0) bag["csharp.explicitInterfaceImplementation"] = true;
        if (declaredKind == RoslynMethodKind.Conversion) bag["csharp.conversion"] = IsImplicitConversion(method) ? "implicit" : "explicit";
        if (IsPrimaryConstructor(method)) bag["csharp.primaryConstructor"] = true;
        if (inExtensionBlock) bag["csharp.extensionBlock"] = true;
        if (method.ReturnsByRefReadonly) bag["csharp.readonlyRef"] = true;
        return bag;
    }

    private Dictionary<string, object> PropertyBag(IPropertySymbol property, SyntaxTokenList syntaxModifiers, bool inExtensionBlock)
    {
        var bag = new Dictionary<string, object>();
        if (property.IsPartialDefinition) bag["csharp.partial"] = true;
        if (property.IsRequired) bag["csharp.required"] = true;
        if (syntaxModifiers.Any(SyntaxKind.UnsafeKeyword)) bag["csharp.unsafe"] = true;
        if (syntaxModifiers.Any(SyntaxKind.ReadOnlyKeyword)) bag["csharp.readonlyMember"] = true;
        if (property.ExplicitInterfaceImplementations.Length > 0) bag["csharp.explicitInterfaceImplementation"] = true;
        if (property.ReturnsByRefReadonly) bag["csharp.readonlyRef"] = true;
        if (inExtensionBlock) bag["csharp.extensionBlock"] = true;
        if (IsPositional(property)) bag["csharp.positional"] = true;
        AddBackingFieldAnnotations(bag, property);
        return bag;
    }

    private Dictionary<string, object> EventBag(IEventSymbol @event, bool inExtensionBlock)
    {
        var bag = new Dictionary<string, object>();
        if (@event.IsPartialDefinition) bag["csharp.partial"] = true;
        if (@event.ExplicitInterfaceImplementations.Length > 0) bag["csharp.explicitInterfaceImplementation"] = true;
        if (inExtensionBlock) bag["csharp.extensionBlock"] = true;
        AddBackingFieldAnnotations(bag, @event);
        return bag;
    }

    private static Dictionary<string, object> FieldBag(IFieldSymbol field, SyntaxTokenList syntaxModifiers)
    {
        var bag = new Dictionary<string, object>();
        if (field.IsRequired) bag["csharp.required"] = true;
        if (field.IsFixedSizeBuffer) bag["csharp.fixedSize"] = field.FixedSize;
        if (field.RefKind == RefKind.RefReadOnly) bag["csharp.readonlyRef"] = true;
        if (syntaxModifiers.Any(SyntaxKind.UnsafeKeyword)) bag["csharp.unsafe"] = true;
        return bag;
    }

    /// <summary>`[field: X]` sits on the synthesised backing field, which is not emitted; its attribute types travel on the member.</summary>
    private void AddBackingFieldAnnotations(Dictionary<string, object> bag, ISymbol member)
    {
        var backingField = member.ContainingType.GetMembers().OfType<IFieldSymbol>().FirstOrDefault(field => field.IsImplicitlyDeclared && SymbolEqualityComparer.Default.Equals(field.AssociatedSymbol, member));
        if (backingField is null) return;
        var annotations = backingField.GetAttributes().Where(attribute => attribute.AttributeClass is not null).Select(attribute => context.Ids.Type(attribute.AttributeClass!).Value).ToArray();
        if (annotations.Length > 0) bag["csharp.backingFieldAnnotations"] = annotations;
    }

    // --- Modifiers and kinds -----------------------------------------------------------------------------------------

    private static IReadOnlyList<Modifier> TypeModifiers(INamedTypeSymbol type, SyntaxTokenList syntaxModifiers)
    {
        var modifiers = new List<Modifier>();
        if (type.IsStatic) modifiers.Add(Modifier.Static);
        if (type.IsAbstract && type.TypeKind != RoslynTypeKind.Interface && !type.IsStatic) modifiers.Add(Modifier.Abstract);
        if (type.IsSealed && type.TypeKind == RoslynTypeKind.Class && !type.IsStatic) modifiers.Add(Modifier.Final);
        if (syntaxModifiers.Any(SyntaxKind.NewKeyword)) modifiers.Add(Modifier.Hiding);
        if (type.IsRecord) modifiers.Add(Modifier.Record);
        return modifiers;
    }

    private static IReadOnlyList<Modifier> MethodModifiers(IMethodSymbol method, SyntaxTokenList syntaxModifiers) =>
        MemberModifiers(method.IsStatic, method.IsAbstract, method.IsSealed, method.IsVirtual, method.IsOverride, method.IsExtern, syntaxModifiers, method.IsAsync);

    /// <summary>Shared by methods, properties and events: `sealed` is `final`, `new` is `hiding`, `extern` is `external`; `override` is an edge, not a modifier.</summary>
    private static IReadOnlyList<Modifier> MemberModifiers(bool isStatic, bool isAbstract, bool isSealed, bool isVirtual, bool isOverride, bool isExtern, SyntaxTokenList syntaxModifiers, bool isAsync = false)
    {
        var modifiers = new List<Modifier>();
        if (isStatic) modifiers.Add(Modifier.Static);
        if (isAbstract) modifiers.Add(Modifier.Abstract);
        if (isSealed || syntaxModifiers.Any(SyntaxKind.SealedKeyword)) modifiers.Add(Modifier.Final);
        if ((isVirtual || isOverride && !isSealed) && !isAbstract) modifiers.Add(Modifier.Virtual);
        if (syntaxModifiers.Any(SyntaxKind.NewKeyword)) modifiers.Add(Modifier.Hiding);
        if (isAsync) modifiers.Add(Modifier.Async);
        if (isExtern) modifiers.Add(Modifier.External);
        return modifiers;
    }

    private static IReadOnlyList<Modifier> FieldModifiers(IFieldSymbol field, SyntaxTokenList syntaxModifiers)
    {
        var modifiers = new List<Modifier>();
        if (field.IsStatic) modifiers.Add(Modifier.Static);
        if (syntaxModifiers.Any(SyntaxKind.NewKeyword)) modifiers.Add(Modifier.Hiding);
        if (field.IsReadOnly || field.IsConst) modifiers.Add(Modifier.Readonly);
        if (field.IsVolatile) modifiers.Add(Modifier.Volatile);
        return modifiers;
    }

    private static MethodKind MethodKindOf(RoslynMethodKind declaredKind) => declaredKind switch
    {
        RoslynMethodKind.Constructor => MethodKind.Constructor,
        RoslynMethodKind.StaticConstructor => MethodKind.StaticInitializer,
        RoslynMethodKind.Destructor => MethodKind.Destructor,
        RoslynMethodKind.UserDefinedOperator or RoslynMethodKind.Conversion => MethodKind.Operator,
        _ => MethodKind.Method,
    };

    /// <summary>An extension block's type parameters come first, as the hoisted member's own.</summary>
    private IReadOnlyList<TypeParameter> MethodTypeParameters(IMethodSymbol method, RefContext refContext)
    {
        var typeParameters = new List<TypeParameter>();
        if (ExtensionMembers.IsExtensionType(method.ContainingType))
            typeParameters.AddRange(context.Signatures.TypeParametersOf(method.ContainingType.TypeParameters, refContext));
        typeParameters.AddRange(context.Signatures.TypeParametersOf(method.TypeParameters, refContext));
        return typeParameters;
    }

    private static IReadOnlyList<Accessor> AccessorsOf(IPropertySymbol property)
    {
        var accessors = new List<Accessor>();
        if (property.GetMethod is not null) accessors.Add(Accessor.Get);
        if (property.SetMethod is { } setter) accessors.Add(setter.IsInitOnly ? Accessor.Init : Accessor.Set);
        return accessors;
    }

    /// <summary>A fixed buffer is typed by its element: `fixed byte Buffer[16]` is a `byte` field with `csharp.fixedSize`.</summary>
    private static ITypeSymbol FieldType(IFieldSymbol field) =>
        field.IsFixedSizeBuffer && field.Type is IPointerTypeSymbol pointer ? pointer.PointedAtType : field.Type;

    // --- Edges -------------------------------------------------------------------------------------------------------

    private void AddBaseEdges(INamedTypeSymbol type, NodeId id)
    {
        if (type.TypeKind == RoslynTypeKind.Class && type.BaseType is { SpecialType: not SpecialType.System_Object } baseType)
            _edges.Add(new ExtendsEdge { From = id, To = context.Types.Of(baseType, RefContext.Node) });
        foreach (var @interface in type.Interfaces)
        {
            var reference = context.Types.Of(@interface, RefContext.Node);
            _edges.Add(type.TypeKind == RoslynTypeKind.Interface ? new ExtendsEdge { From = id, To = reference } : new ImplementsEdge { From = id, To = reference });
        }
    }

    private void AddOverridesEdge(NodeId id, ISymbol overridden) =>
        _edges.Add(new OverridesEdge { From = id, To = context.Ids.Member(overridden.OriginalDefinition) });

    /// <summary>One edge per interface member the type satisfies, over every interface including inherited ones, from the member that fills the slot.</summary>
    private void AddInterfaceMemberEdges(INamedTypeSymbol type, NodeId id)
    {
        if (type.TypeKind is RoslynTypeKind.Enum or RoslynTypeKind.Delegate || type.IsStatic) return;
        foreach (var @interface in type.AllInterfaces)
        {
            var interfaceRef = context.Types.Of(@interface, RefContext.Node);
            foreach (var member in @interface.GetMembers().Where(IsImplementableInterfaceMember))
            {
                var implementation = type.FindImplementationForInterfaceMember(member);
                if (implementation is null) continue;
                if (SymbolEqualityComparer.Default.Equals(implementation.OriginalDefinition, member.OriginalDefinition)) continue;
                _edges.Add(new ImplementsMemberEdge
                {
                    From = context.Ids.Member(implementation.OriginalDefinition),
                    To = context.Ids.Member(member.OriginalDefinition),
                    Interface = interfaceRef,
                    DeclaredOn = id,
                });
            }
        }
    }

    /// <summary>Methods, properties and events that a type can satisfy: accessors and non-virtual statics are not slots.</summary>
    private static bool IsImplementableInterfaceMember(ISymbol member)
    {
        if (member is not (IMethodSymbol { AssociatedSymbol: null } or IPropertySymbol or IEventSymbol)) return false;
        if (member is IMethodSymbol { MethodKind: not (RoslynMethodKind.Ordinary or RoslynMethodKind.UserDefinedOperator or RoslynMethodKind.Conversion) }) return false;
        return !member.IsStatic || member.IsAbstract || member.IsVirtual;
    }

    private void AddAnnotationEdges(NodeId id, IReadOnlyList<Annotation> annotations)
    {
        foreach (var annotation in annotations)
            _edges.Add(new AnnotatedWithEdge { From = id, Annotation = annotation });
    }

    // --- Reading the syntax ------------------------------------------------------------------------------------------

    private static string? ConstantText(IFieldSymbol field)
    {
        if (!field.HasConstantValue) return null;
        foreach (var reference in field.DeclaringSyntaxReferences)
        {
            var syntax = reference.GetSyntax();
            if (syntax is VariableDeclaratorSyntax { Initializer.Value: { } value }) return value.ToString();
            if (syntax is EnumMemberDeclarationSyntax { EqualsValue.Value: { } enumValue }) return enumValue.ToString();
        }
        return AnnotationMapper.Literal(field.ConstantValue);
    }

    private static bool IsImplicitConversion(IMethodSymbol method) =>
        method.MetadataName.EndsWith(WellKnownMemberNames.ImplicitConversionName, StringComparison.Ordinal);

    private static bool IsPrimaryConstructor(IMethodSymbol method) =>
        method.MethodKind == RoslynMethodKind.Constructor && !method.IsImplicitlyDeclared
        && method.DeclaringSyntaxReferences.Any(reference => reference.GetSyntax() is TypeDeclarationSyntax);

    private static bool IsPositional(IPropertySymbol property) =>
        property.DeclaringSyntaxReferences.Any(reference => reference.GetSyntax() is ParameterSyntax);

    /// <summary>Top-level statements declare `Program` and `&lt;Main&gt;$` on the compilation unit itself.</summary>
    private static bool IsTopLevelProgram(INamedTypeSymbol type) => IsDeclaredByCompilationUnit(type);

    private static bool IsTopLevelEntryPoint(IMethodSymbol method) => IsDeclaredByCompilationUnit(method);

    private static bool IsDeclaredByCompilationUnit(ISymbol symbol) =>
        symbol.DeclaringSyntaxReferences.Any(reference => reference.GetSyntax() is CompilationUnitSyntax);

    /// <summary>The modifier tokens of the member declaration; none for positional parameters and primary constructors, which have no modifier list of their own.</summary>
    private static SyntaxTokenList SyntaxModifiers(ISymbol symbol)
    {
        foreach (var reference in symbol.DeclaringSyntaxReferences)
        {
            var syntax = reference.GetSyntax();
            if (syntax is ParameterSyntax || symbol is IMethodSymbol && syntax is TypeDeclarationSyntax) continue;
            if (syntax.FirstAncestorOrSelf<MemberDeclarationSyntax>() is { } declaration) return declaration.Modifiers;
        }
        return default;
    }

    /// <summary>The `&lt;summary&gt;` text of the doc comment, whitespace collapsed; null when there is none.</summary>
    private static string? Documentation(ISymbol symbol)
    {
        var xml = symbol.GetDocumentationCommentXml();
        if (string.IsNullOrWhiteSpace(xml)) return null;
        var start = xml.IndexOf("<summary>", StringComparison.Ordinal);
        var end = xml.IndexOf("</summary>", StringComparison.Ordinal);
        if (start < 0 || end < start) return null;
        var summary = xml[(start + "<summary>".Length)..end];
        var lines = summary.Split('\n').Select(line => line.Trim()).Where(line => line.Length > 0);
        var text = string.Join(" ", lines);
        return text.Length == 0 ? null : text;
    }

    private static Visibility VisibilityOf(Accessibility accessibility) => accessibility switch
    {
        Accessibility.Public => Visibility.Public,
        Accessibility.Protected => Visibility.Protected,
        Accessibility.Private => Visibility.Private,
        Accessibility.Internal => Visibility.Artifact,
        Accessibility.ProtectedOrInternal => Visibility.ProtectedOrArtifact,
        Accessibility.ProtectedAndInternal => Visibility.ProtectedAndArtifact,
        _ => Visibility.Private,
    };
}
