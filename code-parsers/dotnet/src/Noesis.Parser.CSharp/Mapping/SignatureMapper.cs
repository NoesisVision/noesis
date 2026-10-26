using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Noesis.Parser.Model;

namespace Noesis.Parser.CSharp.Mapping;

/// <summary>Parameters, type parameters and signatures of methods, delegates, indexers and function pointers.</summary>
internal sealed class SignatureMapper(ParseContext context)
{
    public Signature SignatureOf(IMethodSymbol method, RefContext refContext) =>
        new(
            ParametersOf(method.Parameters, refContext),
            context.Types.Of(method.ReturnType, refContext),
            method.ReturnsByRef || method.ReturnsByRefReadonly ? Passing.Ref : Passing.Value,
            refContext.ForId ? [] : context.Annotations.Of(method.GetReturnTypeAttributes()));

    public IReadOnlyList<Parameter> ParametersOf(IEnumerable<IParameterSymbol> parameters, RefContext refContext) =>
        parameters.Select(parameter => ParameterOf(parameter, refContext)).ToArray();

    public Parameter ParameterOf(IParameterSymbol parameter, RefContext refContext)
    {
        var bag = new Dictionary<string, object>();
        switch (parameter.RefKind)
        {
            case RefKind.Out: bag["csharp.refKind"] = "out"; break;
            case RefKind.In: bag["csharp.refKind"] = "in"; break;
            case RefKind.RefReadOnlyParameter: bag["csharp.refKind"] = "refReadonly"; break;
        }
        if (parameter.ScopedKind != ScopedKind.None) bag["csharp.scoped"] = true;
        return new Parameter(
            parameter.Name,
            context.Types.Of(parameter.Type, refContext),
            parameter.RefKind == RefKind.None ? Passing.Value : Passing.Ref,
            parameter.IsParams,
            parameter.IsOptional,
            DefaultValueOf(parameter),
            refContext.ForId ? [] : context.Annotations.Of(parameter),
            LanguageBag.Of(bag));
    }

    public IReadOnlyList<TypeParameter> TypeParametersOf(IEnumerable<ITypeParameterSymbol> parameters, RefContext refContext) =>
        parameters.Select(parameter => TypeParameterOf(parameter, refContext)).ToArray();

    public TypeParameter TypeParameterOf(ITypeParameterSymbol parameter, RefContext refContext)
    {
        var constraints = new List<TypeParameterConstraint>();
        var bag = new Dictionary<string, object>();
        if (parameter.HasReferenceTypeConstraint)
        {
            constraints.Add(new ReferenceTypeConstraint());
            if (parameter.ReferenceTypeConstraintNullableAnnotation == NullableAnnotation.Annotated) bag["csharp.nullableReferenceConstraint"] = true;
        }
        if (parameter.HasValueTypeConstraint || parameter.HasUnmanagedTypeConstraint)
        {
            constraints.Add(new ValueTypeConstraint());
            if (parameter.HasUnmanagedTypeConstraint) bag["csharp.unmanaged"] = true;
        }
        if (parameter.HasNotNullConstraint) constraints.Add(new NotNullConstraint());
        foreach (var type in parameter.ConstraintTypes) constraints.Add(new TypeConstraint(context.Types.Of(type, refContext)));
        if (parameter.HasConstructorConstraint) constraints.Add(new ParameterlessConstructorConstraint());
        if (parameter.AllowsRefLikeType) bag["csharp.allowsRefStruct"] = true;
        return new TypeParameter(
            parameter.Name,
            TypeRefs.Ordinal(parameter),
            context.Annotations.Of(parameter),
            parameter.Variance switch { VarianceKind.In => Variance.Contravariant, VarianceKind.Out => Variance.Covariant, _ => Variance.Invariant },
            constraints,
            LanguageBag.Of(bag));
    }

    private static string? DefaultValueOf(IParameterSymbol parameter)
    {
        if (!parameter.HasExplicitDefaultValue) return null;
        foreach (var reference in parameter.DeclaringSyntaxReferences)
            if (reference.GetSyntax() is ParameterSyntax { Default.Value: { } value }) return value.ToString();
        return AnnotationMapper.Literal(parameter.ExplicitDefaultValue);
    }
}
