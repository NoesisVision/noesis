extern alias OtherProjectAlias;

using CSharpSyntax.OtherProject;
using CSharpSyntax.OtherProject.NestedNamespace;

namespace CSharpSyntax.TypeUsage;

// Types declared in `CSharpSyntax.OtherProject`, consumed through a `ProjectReference`, in every
// position a type can occupy. Mirrors `OwnProjectTypeUsage`.
[AttributeFromOtherProject(typeof(PublicClassFromOtherProject), NamedEnumArgument = EnumFromOtherProject.SecondFromOtherProject)]
public class OtherProjectTypeUsage(PublicClassFromOtherProject primaryConstructorParameter, StructFromOtherProject primaryConstructorStruct)
    : AbstractBaseClassFromOtherProject, IInterfaceFromOtherProject, IGenericInterfaceFromOtherProject<PublicClassFromOtherProject>, IComparer<RecordFromOtherProject>
{
    // Fields.
    public PublicClassFromOtherProject ClassField = new();
    public static PublicClassFromOtherProject StaticClassField = new();
    public readonly PublicClassFromOtherProject ReadonlyClassField = new();
    public const EnumFromOtherProject ConstEnumField = EnumFromOtherProject.SecondFromOtherProject;
    public const int ConstFromOtherProjectConst = StaticClassFromOtherProject.ConstantFromOtherProject + 1;
    public StructFromOtherProject StructField;
    public StructFromOtherProject? NullableStructField;
    public PublicClassFromOtherProject? NullableClassField;
    public PublicClassFromOtherProject[] ArrayField = [];
    public List<PublicClassFromOtherProject> GenericCollectionField = [];
    public Dictionary<EnumFromOtherProject, List<PublicClassFromOtherProject>> NestedGenericField = [];
    public (PublicClassFromOtherProject Class, StructFromOtherProject Struct) TupleField = (new(), default);
    public DelegateFromOtherProject CustomDelegateField = static _ => { };
    public Func<PublicClassFromOtherProject, StructFromOtherProject> FrameworkDelegateOfCustomTypesField = static _ => default;
    public IInterfaceFromOtherProject InterfaceField = new OtherProjectTypeUsage { RequiredProperty = new() };
    public GenericClassFromOtherProject<PublicClassFromOtherProject> GenericClassField = new();
    public RecordFromOtherProject RecordField = new(1);
    public PublicClassFromOtherProject.NestedClassFromOtherProject NestedTypeField = new();
    public ClassFromNestedNamespaceOfOtherProject NestedNamespaceTypeField = new();
    internal InternalClassVisibleViaInternalsVisibleTo InternalTypeField = new();
    public OtherProjectAlias::CSharpSyntax.OtherProject.PublicClassFromOtherProject ExternAliasField = new();
    public global::CSharpSyntax.OtherProject.PublicClassFromOtherProject FullyQualifiedField = new();
    public PublicClassFromOtherProject PrimaryConstructorParameterField = primaryConstructorParameter;

    // Events.
    public event DelegateFromOtherProject? CustomDelegateEvent;
    public event EventHandler<EventArgsFromOtherProject>? EventWithCustomArgs;

    // Properties.
    public PublicClassFromOtherProject AutoProperty { get; set; } = new();
    public PublicClassFromOtherProject InitProperty { get; init; } = new();
    public required PublicClassFromOtherProject RequiredProperty { get; set; }
    public StructFromOtherProject ExpressionBodiedProperty => primaryConstructorStruct;
    public StructFromOtherProject? NullableStructProperty { get; set; }
    public static PublicClassFromOtherProject StaticProperty { get; set; } = new();
    public IReadOnlyList<PublicClassFromOtherProject> GenericInterfaceProperty { get; } = [];
    public ref StructFromOtherProject RefReturningProperty => ref StructField;

    // Indexers.
    public PublicClassFromOtherProject this[EnumFromOtherProject key] => ClassField;
    public StructFromOtherProject this[PublicClassFromOtherProject key, RecordFromOtherProject second] => default;

    // Constructors.
    public OtherProjectTypeUsage() : this(new PublicClassFromOtherProject(), default(StructFromOtherProject)) { }

    public OtherProjectTypeUsage(PublicClassFromOtherProject value, EnumFromOtherProject kind) : this(value, default(StructFromOtherProject)) { }

    // Return types.
    public PublicClassFromOtherProject ClassReturn() => ClassField;
    public StructFromOtherProject StructReturn() => default;
    public EnumFromOtherProject EnumReturn() => EnumFromOtherProject.FirstFromOtherProject;
    public RecordFromOtherProject RecordReturn() => RecordField;
    public IInterfaceFromOtherProject InterfaceReturn() => this;
    public PublicClassFromOtherProject? NullableClassReturn() => null;
    public StructFromOtherProject? NullableStructReturn() => null;
    public PublicClassFromOtherProject[] ArrayReturn() => [];
    public List<PublicClassFromOtherProject> GenericReturn() => [];
    public (PublicClassFromOtherProject, EnumFromOtherProject) TupleReturn() => (new(), EnumFromOtherProject.FirstFromOtherProject);
    public DelegateFromOtherProject DelegateReturn() => CustomDelegateField;
    public async Task<PublicClassFromOtherProject> AsyncReturn() => await Task.FromResult(ClassField);
    public IEnumerable<PublicClassFromOtherProject> IteratorReturn()
    {
        yield return ClassField;
    }
    public ref StructFromOtherProject RefReturn() => ref StructField;

    // Parameters.
    public void ClassParameter(PublicClassFromOtherProject value) { }
    public void StructParameter(StructFromOtherProject value) { }
    public void EnumParameter(EnumFromOtherProject value) { }
    public void RecordParameter(RecordFromOtherProject value) { }
    public void InterfaceParameter(IInterfaceFromOtherProject value) { }
    public void NullableParameters(PublicClassFromOtherProject? reference, StructFromOtherProject? value) { }
    public void RefParameter(ref StructFromOtherProject value) { }
    public void OutParameter(out PublicClassFromOtherProject value) => value = new();
    public void InParameter(in StructFromOtherProject value) { }
    public void RefReadonlyParameter(ref readonly StructFromOtherProject value) { }
    public void ParamsArrayParameter(params PublicClassFromOtherProject[] values) { }
    public void ParamsSpanParameter(params ReadOnlySpan<PublicClassFromOtherProject> values) { }
    public void OptionalEnumParameter(EnumFromOtherProject value = EnumFromOtherProject.SecondFromOtherProject) { }
    public void OptionalStructParameter(StructFromOtherProject value = default) { }
    public void OptionalClassParameter(PublicClassFromOtherProject? value = null) { }
    public void OptionalParameterWithOtherProjectConst(int value = StaticClassFromOtherProject.ConstantFromOtherProject) { }
    public void ArrayParameter(PublicClassFromOtherProject[] values) { }
    public void GenericParameters(List<PublicClassFromOtherProject> list, Dictionary<EnumFromOtherProject, PublicClassFromOtherProject> dictionary) { }
    public void TupleParameter((PublicClassFromOtherProject Class, EnumFromOtherProject Kind) value) { }
    public void CustomDelegateParameter(DelegateFromOtherProject callback) { }
    public void FrameworkDelegateOfCustomTypesParameter(Func<PublicClassFromOtherProject, StructFromOtherProject> selector, Action<RecordFromOtherProject> action) { }
    public void AttributedParameter([AttributeFromOtherProject(typeof(StructFromOtherProject))] PublicClassFromOtherProject value) { }
    internal void InternalTypeParameter(InternalClassVisibleViaInternalsVisibleTo value) { }

    [return: AttributeFromOtherProject(typeof(EnumFromOtherProject))]
    public PublicClassFromOtherProject AttributedReturn() => ClassField;

    // Generics.
    public T ConstrainedToClass<T>(T value) where T : PublicClassFromOtherProject => value;
    public T ConstrainedToInterface<T>(T value) where T : IInterfaceFromOtherProject => value;
    public T ConstrainedToGenericInterface<T>(T value) where T : IGenericInterfaceFromOtherProject<PublicClassFromOtherProject> => value;
    public T ConstrainedToAbstractClass<T>(T value) where T : AbstractBaseClassFromOtherProject => value;

    public void ExplicitTypeArguments()
    {
        _ = ConstrainedToClass<PublicClassFromOtherProject>(new());
        _ = Enumerable.Empty<PublicClassFromOtherProject>();
        _ = new List<StructFromOtherProject>();
        _ = new GenericClassFromOtherProject<EnumFromOtherProject>();
        _ = default(StructFromOtherProject);
    }

    // Operators and conversions.
    public static OtherProjectTypeUsage operator +(OtherProjectTypeUsage left, StructFromOtherProject right) => left;
    public static implicit operator PublicClassFromOtherProject(OtherProjectTypeUsage value) => value.ClassField;
    public static explicit operator OtherProjectTypeUsage(PublicClassFromOtherProject value) => new(value, EnumFromOtherProject.FirstFromOtherProject) { RequiredProperty = value };

    // Body-level use.
    public void BodyLevelUse(object input)
    {
        PublicClassFromOtherProject localVariable = new();
        var inferredLocalVariable = new StructFromOtherProject();
        PublicClassFromOtherProject[] arrayCreation = new PublicClassFromOtherProject[1];
        List<RecordFromOtherProject> collectionExpression = [];
        object boxed = localVariable;
        PublicClassFromOtherProject cast = (PublicClassFromOtherProject)boxed;
        PublicClassFromOtherProject? asCast = boxed as PublicClassFromOtherProject;
        bool typeTest = boxed is PublicClassFromOtherProject;
        bool patternTest = boxed is RecordFromOtherProject { ValueFromOtherProject: 1 } matched && matched.ValueFromOtherProject == 1;
        string switchOnType = boxed switch
        {
            PublicClassFromOtherProject => nameof(PublicClassFromOtherProject),
            StructFromOtherProject => nameof(StructFromOtherProject),
            _ => "",
        };
        Type typeOf = typeof(PublicClassFromOtherProject);
        Type openGenericTypeOf = typeof(GenericClassFromOtherProject<>);
        string nameOf = nameof(PublicClassFromOtherProject);
        Func<PublicClassFromOtherProject, EnumFromOtherProject> typedLambda = (PublicClassFromOtherProject value) => EnumFromOtherProject.FirstFromOtherProject;
        StructFromOtherProject LocalFunction(PublicClassFromOtherProject value, in StructFromOtherProject other) => other;
        foreach (PublicClassFromOtherProject item in GenericCollectionField) { }
        using (DisposableFromOtherProject disposable = new()) { }
        using DisposableFromOtherProject disposableDeclaration = new();
        try
        {
            throw new ExceptionFromOtherProject();
        }
        catch (ExceptionFromOtherProject exception) when (exception.Message.Length >= 0)
        {
        }
        RecordFromOtherProject withExpression = RecordField with { ValueFromOtherProject = 2 };
        CustomDelegateEvent += static _ => { };
        EventWithCustomArgs?.Invoke(this, new EventArgsFromOtherProject());
        int propertyOfOtherProjectType = localVariable.PublicPropertyFromOtherProject;
        string methodOfOtherProjectType = localVariable.PublicMethodFromOtherProject();
        int fieldOfOtherProjectStruct = StructField.ValueFromOtherProject;
        RecordField.Deconstruct(out int deconstructed);

        _ = (inferredLocalVariable, arrayCreation, collectionExpression, cast, asCast, typeTest, patternTest,
            switchOnType, typeOf, openGenericTypeOf, nameOf, typedLambda, LocalFunction(localVariable, in inferredLocalVariable),
            disposableDeclaration, withExpression, propertyOfOtherProjectType, methodOfOtherProjectType, fieldOfOtherProjectStruct,
            deconstructed);
    }

    // Interface and base-class members whose signatures carry other-project types.
    public override void AbstractMethodFromOtherProject() { }
    public void MethodFromOtherProjectInterface() { }
    public PublicClassFromOtherProject GenericMethodFromOtherProjectInterface(PublicClassFromOtherProject value) => value;
    public int Compare(RecordFromOtherProject? x, RecordFromOtherProject? y) => 0;

    public class NestedClassWithOtherProjectTypes
    {
        public PublicClassFromOtherProject FieldInNestedClass = new();
    }
}

public struct StructWithOtherProjectTypeMembers
{
    public PublicClassFromOtherProject ClassFieldInStruct;
    public StructFromOtherProject? NullableStructFieldInStruct;
    public EnumFromOtherProject EnumPropertyInStruct { get; set; }
}

public record RecordWithOtherProjectTypeMembers(PublicClassFromOtherProject Positional, StructFromOtherProject PositionalStruct, EnumFromOtherProject PositionalEnum = EnumFromOtherProject.FirstFromOtherProject)
    : RecordFromOtherProject(1)
{
    public RecordFromOtherProject? NestedRecordProperty { get; init; }
}

public record struct RecordStructWithOtherProjectTypeMembers(PublicClassFromOtherProject Positional, EnumFromOtherProject Kind);

public interface IInterfaceWithOtherProjectTypeMembers : IInterfaceFromOtherProject
{
    PublicClassFromOtherProject PropertyOfOtherProjectType { get; }
    StructFromOtherProject MethodWithOtherProjectTypes(EnumFromOtherProject kind, IInterfaceFromOtherProject other);
    event DelegateFromOtherProject? EventOfOtherProjectDelegateType;
    PublicClassFromOtherProject this[EnumFromOtherProject key] { get; }
}

public delegate StructFromOtherProject DelegateWithOtherProjectTypes(PublicClassFromOtherProject argument, ref EnumFromOtherProject kind, out RecordFromOtherProject record);

public class GenericClassConstrainedToOtherProjectTypes<TClass, TInterface, TRecord>
    where TClass : PublicClassFromOtherProject, new()
    where TInterface : IGenericInterfaceFromOtherProject<PublicClassFromOtherProject>
    where TRecord : RecordFromOtherProject
{
    public TClass ConstrainedField = new();
}

public class DerivedFromGenericOfOtherProjectType : List<PublicClassFromOtherProject>, IGenericInterfaceFromOtherProject<StructFromOtherProject>
{
    public StructFromOtherProject GenericMethodFromOtherProjectInterface(StructFromOtherProject value) => value;
}

public class DerivedFromOtherProjectGenericClassOfOwnType : GenericClassFromOtherProject<OtherProjectTypeUsage>;

public static class ExtensionsOnOtherProjectTypes
{
    public static EnumFromOtherProject ClassicExtensionOnOtherProjectType(this PublicClassFromOtherProject receiver) => EnumFromOtherProject.FirstFromOtherProject;

    public static StructFromOtherProject ClassicExtensionOnOtherProjectStruct(this in StructFromOtherProject receiver) => receiver;

    extension(RecordFromOtherProject receiver)
    {
        public PublicClassFromOtherProject ExtensionMemberOnOtherProjectType => new();

        public StructFromOtherProject ExtensionMethodOnOtherProjectType(EnumFromOtherProject kind) => default;
    }

    extension<T>(T receiver) where T : IInterfaceFromOtherProject
    {
        public EnumFromOtherProject GenericExtensionConstrainedToOtherProjectType => EnumFromOtherProject.FirstFromOtherProject;
    }
}
