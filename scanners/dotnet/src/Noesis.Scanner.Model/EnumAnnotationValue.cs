namespace Noesis.Scanner.Model;

public sealed record EnumAnnotationValue(TypeRef Type, string Member) : AnnotationValue;