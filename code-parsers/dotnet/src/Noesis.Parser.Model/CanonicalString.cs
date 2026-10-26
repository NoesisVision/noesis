namespace Noesis.Parser.Model;

public static class CanonicalString
{
    public static string Of(TypeRef type) => type switch
    {
        NamedTypeRef named => named.Type.CanonicalPath + Arguments(named) + Nullable(named.Nullable),
        TypeParameterRef parameter => (parameter.Owner.Kind == NodeKindLetter.Type ? "!" : "!!") + parameter.Ordinal + Nullable(parameter.Nullable),
        ArrayTypeRef array => Of(array.Element) + "[" + new string(',', array.Rank - 1) + "]" + Nullable(array.Nullable),
        TupleTypeRef tuple => "(" + string.Join(",", tuple.Elements.Select(element => Of(element.Type))) + ")",
        FunctionTypeRef function => "delegate*" + (function.CallingConvention is null ? "" : " " + function.CallingConvention)
                                                + "<" + string.Join(",", function.Signature.Parameters.Select(parameter => Of(parameter.Type)).Append(Of(function.Signature.ReturnType))) + ">",
        StructuralTypeRef structural => "{" + string.Join(",", structural.Members.Select(member => member.Name + ":" + Of(member.Type))) + "}",
        PointerTypeRef pointer => Of(pointer.Pointee) + "*",
        UnionTypeRef union => string.Join("|", union.Members.Select(Of)),
        IntersectionTypeRef intersection => string.Join("&", intersection.Members.Select(Of)),
        LiteralTypeRef literal => literal.Text,
        PrimitiveTypeRef primitive => primitive.Name + Nullable(primitive.Nullable),
        DynamicTypeRef => "dynamic",
        VoidTypeRef => "void",
        UnresolvedTypeRef unresolved => "<unresolved:" + unresolved.Text + ">",
        OtherTypeRef other => "<other:" + other.Text + ">",
        _ => throw new ArgumentOutOfRangeException(nameof(type), type, null),
    };

    private static string Arguments(NamedTypeRef named) =>
        named.Unbound ? "<>" : named.TypeArguments.Count == 0 ? "" : "[" + string.Join(",", named.TypeArguments.Select(Of)) + "]";

    private static string Nullable(bool nullable) => nullable ? "?" : "";
}