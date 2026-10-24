namespace Noesis.Parser.Model;

public sealed record EnumAnnotationValue(TypeRef Type, string Member) : AnnotationValue;