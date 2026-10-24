using System.Globalization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Noesis.Parser.Model;

namespace Noesis.Parser.CSharp.Mapping;

/// <summary>Attributes as annotations: every argument named by its parameter or property, constants as source-like text.</summary>
internal sealed class AnnotationMapper(ParseContext context)
{
    public IReadOnlyList<Annotation> Of(ISymbol symbol) => Of(symbol.GetAttributes());

    public IReadOnlyList<Annotation> Of(IEnumerable<AttributeData> attributes) =>
        attributes.Select(Of).OfType<Annotation>().ToArray();

    public Annotation? Of(AttributeData attribute)
    {
        if (attribute.AttributeClass is null) return null;
        var arguments = new List<AnnotationArgument>();
        var parameters = attribute.AttributeConstructor?.Parameters ?? [];
        for (var i = 0; i < attribute.ConstructorArguments.Length; i++)
        {
            var name = i < parameters.Length ? parameters[i].Name : "arg" + i;
            arguments.Add(new AnnotationArgument(name, true, ValueOf(attribute.ConstructorArguments[i])));
        }
        foreach (var (name, value) in attribute.NamedArguments)
            arguments.Add(new AnnotationArgument(name, false, ValueOf(value)));
        return new Annotation(context.Types.Of(attribute.AttributeClass, RefContext.Node), arguments);
    }

    public AnnotationValue ValueOf(TypedConstant constant)
    {
        switch (constant.Kind)
        {
            case TypedConstantKind.Primitive:
                return new LiteralAnnotationValue(Literal(constant.Value));
            case TypedConstantKind.Enum:
                return EnumValue(constant);
            case TypedConstantKind.Type:
                return constant.Value is ITypeSymbol type ? new TypeAnnotationValue(context.Types.Of(type, RefContext.Node)) : new LiteralAnnotationValue("null");
            case TypedConstantKind.Array:
                return constant.IsNull ? new LiteralAnnotationValue("null") : new ArrayAnnotationValue(constant.Values.Select(ValueOf).ToArray());
            default:
                return new OtherAnnotationValue(constant.IsNull ? "null" : constant.ToCSharpString());
        }
    }

    private AnnotationValue EnumValue(TypedConstant constant)
    {
        if (constant.Type is not INamedTypeSymbol enumType || constant.Value is null) return new LiteralAnnotationValue("null");
        var member = enumType.GetMembers().OfType<IFieldSymbol>().FirstOrDefault(field => field.HasConstantValue && Equals(field.ConstantValue, constant.Value));
        var type = context.Types.Of(enumType, RefContext.Node);
        return member is null ? new OtherAnnotationValue(constant.ToCSharpString()) : new EnumAnnotationValue(type, member.Name);
    }

    public static string Literal(object? value) => value switch
    {
        null => "null",
        string text => SymbolDisplay.FormatLiteral(text, quote: true),
        char character => SymbolDisplay.FormatLiteral(character, quote: true),
        bool flag => flag ? "true" : "false",
        IFormattable number => number.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? "null",
    };
}
