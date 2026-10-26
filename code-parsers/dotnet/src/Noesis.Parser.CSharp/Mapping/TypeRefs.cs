using Microsoft.CodeAnalysis;
using Noesis.Parser.Model;

namespace Noesis.Parser.CSharp.Mapping;

/// <summary>Builds <see cref="TypeRef"/>s from Roslyn type symbols; primitives by keyword, generics CLR-flattened.</summary>
internal sealed class TypeRefs(ParseContext context)
{
    private static readonly NodeId TypeOwnerPlaceholder = NodeId.Of(NodeKindLetter.Type, "?");
    private static readonly NodeId MethodOwnerPlaceholder = NodeId.Of(NodeKindLetter.Method, "?");

    public string IdCanonical(ITypeSymbol type) => Of(type, RefContext.Id).Canonical;

    public TypeRef Of(ITypeSymbol? type, RefContext refContext)
    {
        if (type is null) return new UnresolvedTypeRef("");
        var nullable = !refContext.ForId && type.NullableAnnotation == NullableAnnotation.Annotated && !type.IsValueType;
        switch (type)
        {
            case IErrorTypeSymbol error:
                return new UnresolvedTypeRef(error.ToDisplayString());
            case IDynamicTypeSymbol:
                return new DynamicTypeRef();
            case IArrayTypeSymbol array:
                return new ArrayTypeRef(Of(array.ElementType, refContext), array.Rank, nullable);
            case IPointerTypeSymbol pointer:
                return new PointerTypeRef(Of(pointer.PointedAtType, refContext));
            case IFunctionPointerTypeSymbol functionPointer:
                return new FunctionTypeRef(context.Signatures.SignatureOf(functionPointer.Signature, refContext), CallingConvention(functionPointer));
            case ITypeParameterSymbol parameter:
                return TypeParameter(parameter, nullable, refContext);
            case INamedTypeSymbol named:
                return Named(named, nullable, refContext);
            default:
                return new OtherTypeRef(type.ToDisplayString());
        }
    }

    public TypeParameterRef TypeParameter(ITypeParameterSymbol parameter, bool nullable, RefContext refContext) =>
        new(Owner(parameter, refContext), Ordinal(parameter), nullable);

    /// <summary>CLR-flattened position: the containing types' parameters count first; an extension block's parameters sit before the member's own.</summary>
    public static int Ordinal(ITypeParameterSymbol parameter)
    {
        if (parameter.DeclaringMethod is { } method)
            return (ExtensionMembers.IsExtensionType(method.ContainingType) ? method.ContainingType.Arity : 0) + parameter.Ordinal;
        var declaringType = parameter.DeclaringType!;
        if (declaringType.IsExtension) return parameter.Ordinal;
        return ContainingArity(declaringType.ContainingType) + parameter.Ordinal;
    }

    public static int ContainingArity(INamedTypeSymbol? type)
    {
        var arity = 0;
        for (var current = type; current is not null; current = current.ContainingType) arity += current.Arity;
        return arity;
    }

    private NodeId Owner(ITypeParameterSymbol parameter, RefContext refContext)
    {
        var isMethodLevel = parameter.DeclaringMethod is not null || parameter.DeclaringType!.IsExtension;
        if (refContext.ForId) return isMethodLevel ? MethodOwnerPlaceholder : TypeOwnerPlaceholder;
        if (parameter.DeclaringMethod is { } method)
            return ExtensionMembers.IsExtensionType(method.ContainingType) && refContext.ExtensionMemberOwner is { } owner ? owner : context.Ids.Member(method);
        var declaringType = parameter.DeclaringType!;
        if (declaringType.IsExtension) return refContext.ExtensionMemberOwner ?? context.Ids.Type(declaringType.ContainingType);
        return context.Ids.Type(declaringType);
    }

    private TypeRef Named(INamedTypeSymbol named, bool nullable, RefContext refContext)
    {
        if (named.IsTupleType)
            return new TupleTypeRef(named.TupleElements.Select(element => new TupleElement(element.IsExplicitlyNamedTupleElement && !refContext.ForId ? element.Name : null, Of(element.Type, refContext))).ToArray());
        if (named.IsAnonymousType)
            return new StructuralTypeRef(named.GetMembers().OfType<IPropertySymbol>().Select(property => new StructuralMember(property.Name, Of(property.Type, refContext))).ToArray());
        if (Primitive(named) is { } primitive)
            return new PrimitiveTypeRef(primitive, nullable);
        if (named.SpecialType == SpecialType.System_Void) return new VoidTypeRef();
        var id = context.Ids.Type(named);
        if (named.IsUnboundGenericType) return new NamedTypeRef(id, [], true, nullable);
        return new NamedTypeRef(id, FlattenedArguments(named, refContext), false, nullable);
    }

    private TypeRef[] FlattenedArguments(INamedTypeSymbol named, RefContext refContext)
    {
        var chain = new List<INamedTypeSymbol>();
        for (var current = named; current is not null; current = current.ContainingType) chain.Add(current);
        chain.Reverse();
        return chain.SelectMany(level => level.TypeArguments).Select(argument => Of(argument, refContext)).ToArray();
    }

    private static string? Primitive(INamedTypeSymbol named)
    {
        if (named.IsNativeIntegerType) return named.SpecialType == SpecialType.System_IntPtr ? "nint" : "nuint";
        return named.SpecialType switch
        {
            SpecialType.System_Boolean => "bool",
            SpecialType.System_Byte => "byte",
            SpecialType.System_SByte => "sbyte",
            SpecialType.System_Char => "char",
            SpecialType.System_Int16 => "short",
            SpecialType.System_UInt16 => "ushort",
            SpecialType.System_Int32 => "int",
            SpecialType.System_UInt32 => "uint",
            SpecialType.System_Int64 => "long",
            SpecialType.System_UInt64 => "ulong",
            SpecialType.System_IntPtr => "nint",
            SpecialType.System_UIntPtr => "nuint",
            SpecialType.System_Single => "float",
            SpecialType.System_Double => "double",
            SpecialType.System_Decimal => "decimal",
            SpecialType.System_String => "string",
            SpecialType.System_Object => "object",
            _ => null,
        };
    }

    private static string? CallingConvention(IFunctionPointerTypeSymbol functionPointer)
    {
        var signature = functionPointer.Signature;
        var unmanagedTypes = signature.UnmanagedCallingConventionTypes.Select(type => type.Name.StartsWith("CallConv", StringComparison.Ordinal) ? type.Name["CallConv".Length..] : type.Name).ToArray();
        return signature.CallingConvention switch
        {
            System.Reflection.Metadata.SignatureCallingConvention.Default => null,
            System.Reflection.Metadata.SignatureCallingConvention.Unmanaged => unmanagedTypes.Length == 0 ? "unmanaged" : "unmanaged[" + string.Join(", ", unmanagedTypes) + "]",
            System.Reflection.Metadata.SignatureCallingConvention.CDecl => "unmanaged[Cdecl]",
            System.Reflection.Metadata.SignatureCallingConvention.StdCall => "unmanaged[Stdcall]",
            System.Reflection.Metadata.SignatureCallingConvention.ThisCall => "unmanaged[Thiscall]",
            System.Reflection.Metadata.SignatureCallingConvention.FastCall => "unmanaged[Fastcall]",
            var other => other.ToString(),
        };
    }
}
