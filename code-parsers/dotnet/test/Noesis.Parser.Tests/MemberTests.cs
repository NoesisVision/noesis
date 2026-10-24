using Noesis.Parser.Model;
using Noesis.Parser.Tests.Infrastructure;

namespace Noesis.Parser.Tests;

public class MemberTests(ParsedFixture parsed)
{
    private const string Fields = "CSharpSyntax.FieldsAndProperties.FieldDeclarations.";
    private const string Properties = "CSharpSyntax.FieldsAndProperties.PropertyDeclarations.";
    private const string Events = "CSharpSyntax.FieldsAndProperties.EventDeclarations.";

    [Theory]
    [InlineData("PublicField", Visibility.Public)]
    [InlineData("_privateField", Visibility.Private)]
    [InlineData("InternalField", Visibility.Artifact)]
    [InlineData("ProtectedField", Visibility.Protected)]
    [InlineData("ProtectedInternalField", Visibility.ProtectedOrArtifact)]
    [InlineData("PrivateProtectedField", Visibility.ProtectedAndArtifact)]
    [InlineData("FieldWithoutAccessModifier", Visibility.Private)]
    public void FieldVisibility(string name, Visibility expected) => Assert.Equal(expected, parsed.Main.Field(Fields + name).Visibility);

    [Fact]
    public void FieldModifiersAndConstants()
    {
        Expect.Modifiers(parsed.Main.Field(Fields + "PublicField").Modifiers);
        Expect.Modifiers(parsed.Main.Field(Fields + "StaticField").Modifiers, Modifier.Static);
        Expect.Modifiers(parsed.Main.Field(Fields + "ReadonlyField").Modifiers, Modifier.Readonly);
        Expect.Modifiers(parsed.Main.Field(Fields + "StaticReadonlyField").Modifiers, Modifier.Static, Modifier.Readonly);
        Expect.Modifiers(parsed.Main.Field(Fields + "VolatileField").Modifiers, Modifier.Volatile);
        Expect.Modifiers(parsed.Main.Field(Fields + "StaticVolatileField").Modifiers, Modifier.Static, Modifier.Volatile);

        var constant = parsed.Main.Field(Fields + "ConstField");
        Expect.Modifiers(constant.Modifiers, Modifier.Static, Modifier.Readonly);
        Assert.Equal("1", constant.ConstantValue);
        Assert.Equal(FieldKind.Field, constant.FieldKind);
        Assert.Equal("\"constant\"", parsed.Main.Field(Fields + "ConstStringField").ConstantValue);
        Assert.Equal("PlainEnumForFields.Member", parsed.Main.Field(Fields + "ConstEnumField").ConstantValue);
        Expect.TypeRef("CSharpSyntax.FieldsAndProperties.PlainEnumForFields", parsed.Main.Field(Fields + "ConstEnumField").Type);
        Assert.Equal("ConstField * 2", parsed.Main.Field(Fields + "ConstFieldComputedFromOtherConst").ConstantValue);
        Assert.Null(parsed.Main.Field(Fields + "FieldWithInitializer").ConstantValue);
        Assert.Null(parsed.Main.Field(Fields + "StaticReadonlyField").ConstantValue);
        Assert.Equal("1", parsed.Main.Field("CSharpSyntax.FieldsAndProperties.IFieldsInInterface.ConstFieldInInterface").ConstantValue);
    }

    [Fact]
    public void FieldFactsInTheBagAndAnnotations()
    {
        Assert.Equal(true, parsed.Main.Field(Fields + "RequiredField").Bag("csharp.required"));
        Assert.Null(parsed.Main.Field(Fields + "PublicField").Bag("csharp.required"));
        Assert.Contains(parsed.Main.Field(Fields + "ThreadStaticField").Annotations, annotation => annotation.Type.Canonical == "System.ThreadStaticAttribute");
        Assert.Contains(parsed.Main.Field(Fields + "FieldWithTargetedAttribute").Annotations, annotation => annotation.Type.Canonical == "System.NonSerializedAttribute");
        Assert.Contains(parsed.Main.AnnotationsOf("F:" + Fields + "FieldWithAttribute"), annotation => annotation.Type.Canonical == "System.ObsoleteAttribute");
    }

    [Fact]
    public void EveryDeclaratorAndTypeShapeIsAField()
    {
        foreach (var name in new[] { "FirstDeclarator", "SecondDeclarator", "ThirdDeclarator", "PointerField", "FunctionPointerField", "DelegateField", "BoxedField" })
            parsed.Main.Field(Fields + name);
        Expect.TypeRef("System.Nullable`1[int]", parsed.Main.Field(Fields + "NullableValueField").Type);
        Expect.TypeRef("string?", parsed.Main.Field(Fields + "NullableReferenceField").Type);
        Expect.TypeRef("string", parsed.Main.Field(Fields + "NonNullableReferenceFieldInitializedToDefault").Type);
        Expect.TypeRef("(int,string)", parsed.Main.Field(Fields + "NamedTupleField").Type);
        Expect.TypeRef("dynamic", parsed.Main.Field(Fields + "DynamicField").Type);
        Expect.TypeRef("delegate*<void>", parsed.Main.Field(Fields + "FunctionPointerField").Type);
        Assert.True(parsed.Main.Contains("T:CSharpSyntax.FieldsAndProperties.FieldDeclarations", "F:" + Fields + "PublicField"));
    }

    [Fact]
    public void FieldLikeEventsArePropertiesWithAddAndRemove()
    {
        var fieldLike = parsed.Main.Property(Fields + "FieldLikeEvent");
        Assert.Equal([Accessor.Add, Accessor.Remove], fieldLike.Accessors);
        Expect.TypeRef("System.EventHandler?", fieldLike.Type);
        Expect.Modifiers(parsed.Main.Property(Fields + "StaticFieldLikeEvent").Modifiers, Modifier.Static);
        Assert.False(parsed.Main.Has("F:" + Fields + "FieldLikeEvent"));
        Expect.TypeRef("System.Action`1[int]?", parsed.Main.Property(Fields + "GenericDelegateEvent").Type);
    }

    [Fact]
    public void RefFieldsCarryPassingAndReadonlyRef()
    {
        const string RefStruct = "CSharpSyntax.FieldsAndProperties.FieldsInRefStruct.";
        Assert.Equal(Passing.Ref, parsed.Main.Field(RefStruct + "RefField").Passing);
        Assert.Null(parsed.Main.Field(RefStruct + "RefField").Bag("csharp.readonlyRef"));
        Assert.Equal(Passing.Ref, parsed.Main.Field(RefStruct + "RefReadonlyField").Passing);
        Assert.Equal(true, parsed.Main.Field(RefStruct + "RefReadonlyField").Bag("csharp.readonlyRef"));
        Expect.Modifiers(parsed.Main.Field(RefStruct + "ReadonlyRefField").Modifiers, Modifier.Readonly);
        Assert.Equal(Passing.Ref, parsed.Main.Field(RefStruct + "ReadonlyRefField").Passing);
        Assert.Equal(Passing.Value, parsed.Main.Field(RefStruct + "SpanField").Passing);
    }

    [Fact]
    public void FieldInitializersAndConstructorsAreBodies()
    {
        var initializer = Assert.Single(parsed.Main.Invokes("F:" + Fields + "FieldInitializedFromStaticMethod"));
        Assert.Equal("M:CSharpSyntax.FieldsAndProperties.FieldDeclarations#ComputeInitialValue()", initializer.To.Value);
        Assert.Equal(ExpressionKind.Type, initializer.Receiver);

        var constructor = parsed.Main.Accesses("M:CSharpSyntax.FieldsAndProperties.FieldDeclarations#.ctor()").ToList();
        Expect.One(constructor, edge => edge.To.Value == "F:" + Fields + "ReadonlyField" && edge.Access == AccessKind.Write && edge.Receiver == ExpressionKind.This, "write of ReadonlyField");
        Expect.One(constructor, edge => edge.To.Value == "F:" + Fields + "FieldWithInitializer" && edge.Access == AccessKind.Read, "read of FieldWithInitializer");
        Expect.One(parsed.Main.Accesses("M:CSharpSyntax.FieldsAndProperties.FieldDeclarations#.cctor()"), edge => edge.To.Value == "F:" + Fields + "StaticFieldInitializedInStaticConstructor" && edge.Access == AccessKind.Write && edge.Receiver == ExpressionKind.Type, "static write");
        Assert.Empty(parsed.Main.Invokes("F:" + Fields + "DelegateFieldWithMethodGroupInitializer"));
        Assert.Empty(parsed.Main.Accesses("F:" + Fields + "ConstFieldComputedFromOtherConst"));

        const string Closure = "CSharpSyntax.FieldsAndProperties.FieldsWithInitializersReferencingMembers";
        var closureConstructor = parsed.Main.Accesses("M:" + Closure + "#.ctor()").ToList();
        Expect.One(closureConstructor, edge => edge.To.Value == "F:" + Closure + "._second" && edge.Access == AccessKind.Write && !edge.Site.ViaClosure, "direct write");
        Expect.One(closureConstructor, edge => edge.To.Value == "F:" + Closure + "._first" && edge.Access == AccessKind.Read && edge.Site.ViaClosure, "read inside the lambda");
        Expect.One(closureConstructor, edge => edge.To.Value == "F:" + Closure + "._closure" && edge.Access == AccessKind.Write, "write of the closure field");
    }

    [Fact]
    public void PropertyAccessorsAndVisibility()
    {
        Assert.Equal([Accessor.Get, Accessor.Set], parsed.Main.Property(Properties + "AutoProperty").Accessors);
        Assert.Equal([Accessor.Get], parsed.Main.Property(Properties + "AutoPropertyGetOnly").Accessors);
        Assert.Equal([Accessor.Get, Accessor.Init], parsed.Main.Property(Properties + "AutoPropertyWithInit").Accessors);
        Assert.Equal([Accessor.Set], parsed.Main.Property(Properties + "SetOnlyProperty").Accessors);
        Assert.Equal([Accessor.Init], parsed.Main.Property(Properties + "InitOnlyProperty").Accessors);
        Assert.Equal([Accessor.Get, Accessor.Set], parsed.Main.Property(Properties + "AutoPropertyWithPrivateSetter").Accessors);
        Assert.Equal([Accessor.Get], parsed.Main.Property(Properties + "ExpressionBodiedProperty").Accessors);
        Assert.Equal([Accessor.Get, Accessor.Set], parsed.Main.Property(Properties + "FieldKeywordProperty").Accessors);
        Expect.Modifiers(parsed.Main.Property(Properties + "StaticAutoProperty").Modifiers, Modifier.Static);
        Assert.Equal(Visibility.Private, parsed.Main.Property(Properties + "PrivateProperty").Visibility);
        Assert.Equal(Visibility.ProtectedAndArtifact, parsed.Main.Property(Properties + "PrivateProtectedProperty").Visibility);
        Assert.Equal(Visibility.Public, parsed.Main.Property(Properties + "AutoPropertyWithPrivateSetter").Visibility);
        Assert.Empty(parsed.Main.Property(Properties + "AutoProperty").Parameters);
        Assert.Null(parsed.Main.Property(Properties + "AutoProperty").ExtensionReceiver);
        Assert.Equal(Passing.Value, parsed.Main.Property(Properties + "AutoProperty").ReturnPassing);
    }

    [Fact]
    public void PropertyFactsRefReturnsAndAttributes()
    {
        Assert.Equal(true, parsed.Main.Property(Properties + "RequiredProperty").Bag("csharp.required"));
        Assert.Equal(true, parsed.Main.Property(Properties + "RequiredInitProperty").Bag("csharp.required"));
        Assert.Equal(Passing.Ref, parsed.Main.Property(Properties + "RefReturningProperty").ReturnPassing);
        Assert.Equal(Passing.Ref, parsed.Main.Property(Properties + "RefReadonlyReturningProperty").ReturnPassing);
        Assert.Equal(true, parsed.Main.Property(Properties + "RefReadonlyReturningProperty").Bag("csharp.readonlyRef"));
        Assert.Null(parsed.Main.Property(Properties + "RefReturningProperty").Bag("csharp.readonlyRef"));

        var attributed = Assert.Single(parsed.Main.Property(Properties + "PropertyWithAttribute").Annotations);
        Assert.Equal("System.ObsoleteAttribute", attributed.Type.Canonical);
        Assert.Empty(parsed.Main.Property(Properties + "PropertyWithAttributeOnAccessor").Annotations);
        Assert.Equal(new[] { "T:System.NonSerializedAttribute" }, parsed.Main.Property(Properties + "PropertyWithAttributeOnBackingField").Bag("csharp.backingFieldAnnotations"));
        Assert.Empty(parsed.Main.Property(Properties + "PropertyWithAttributeOnBackingField").Annotations);
        Assert.Contains(parsed.Main.Property(Properties + "PropertyWithNullabilityAttribute").Annotations, annotation => annotation.Type.Canonical == "System.Diagnostics.CodeAnalysis.MemberNotNullWhenAttribute");
        Expect.TypeRef("int*", parsed.Main.Property(Properties + "PointerProperty").Type);
        Expect.TypeRef("(int,string)", parsed.Main.Property(Properties + "NamedTupleProperty").Type);
        Expect.TypeRef("dynamic", parsed.Main.Property(Properties + "DynamicProperty").Type);
    }

    [Fact]
    public void IndexersArePropertiesWithParameters()
    {
        var byInt = parsed.Main.Property(Properties + "this[int]");
        Assert.Equal("this[]", byInt.Name);
        Assert.Equal("index", Assert.Single(byInt.Parameters).Name);
        Assert.Equal([Accessor.Get, Accessor.Set], byInt.Accessors);
        Expect.TypeRef("int", byInt.Type);
        parsed.Main.Property(Properties + "this[string]");
        parsed.Main.Property(Properties + "this[int,int]");
        Assert.True(parsed.Main.Property(Properties + "this[int[]]").Parameters[0].Variadic);
        Assert.Equal(Visibility.Private, parsed.Main.Property(Properties + "this[int,bool]").Visibility);
        Assert.Equal([Accessor.Get, Accessor.Init], parsed.Main.Property(Properties + "this[System.Index]").Accessors);
        Expect.TypeRef("int[]", parsed.Main.Property(Properties + "this[System.Range]").Type);
        Assert.True(parsed.Main.Contains("T:CSharpSyntax.FieldsAndProperties.PropertyDeclarations", "P:" + Properties + "this[int]"));
    }

    [Fact]
    public void BackingFieldsAreNeverEmittedAndFieldKeywordAccessesAreDropped()
    {
        Assert.DoesNotContain(parsed.Main.Nodes, node => node.Id.Value.StartsWith("F:" + Properties, StringComparison.Ordinal) && node.Name.Contains("k__BackingField"));
        Assert.Empty(parsed.Main.Accesses("P:" + Properties + "FieldKeywordProperty"));
        var lazy = Assert.Single(parsed.Main.Invokes("P:" + Properties + "FieldKeywordLazyProperty"));
        Assert.Equal("M:CSharpSyntax.FieldsAndProperties.PropertyDeclarations#ComputeLazyValue()", lazy.To.Value);
        var setter = parsed.Main.Accesses("P:" + Properties + "PropertyWithPrivateBackingAndValidation").ToList();
        Expect.One(setter, edge => edge.To.Value == "F:" + Properties + "_backingField" && edge.Access == AccessKind.Write, "write of the backing field");
        Expect.One(setter, edge => edge.To.Value == "F:" + Properties + "_backingField" && edge.Access == AccessKind.Read, "read of the backing field");
        Expect.One(parsed.Main.Invokes("P:" + Properties + "PropertyWithPrivateBackingAndValidation"), edge => edge.To.Value == "M:System.ArgumentOutOfRangeException#.ctor(string)" && edge.Receiver is null, "exception creation");
        Expect.One(parsed.Main.Accesses("P:" + Properties + "this[int]"), edge => edge.To.Value == "F:" + Properties + "_array" && edge.Access == AccessKind.Read, "array read in indexer");
    }

    [Fact]
    public void PropertyModifiersAndOverrides()
    {
        const string Modifiers = "CSharpSyntax.FieldsAndProperties.PropertyModifiers.";
        const string Derived = "CSharpSyntax.FieldsAndProperties.PropertyModifiersDerived.";
        Expect.Modifiers(parsed.Main.Property(Modifiers + "AbstractProperty").Modifiers, Modifier.Abstract);
        Expect.Modifiers(parsed.Main.Property(Modifiers + "VirtualProperty").Modifiers, Modifier.Virtual);
        Expect.Modifiers(parsed.Main.Property(Derived + "AbstractProperty").Modifiers, Modifier.Virtual);
        Expect.Modifiers(parsed.Main.Property(Derived + "VirtualExpressionBodiedProperty").Modifiers, Modifier.Final);
        Assert.Equal(["P:" + Modifiers + "AbstractProperty"], parsed.Main.OverridesOf("P:" + Derived + "AbstractProperty"));
        Assert.Equal(["P:" + Modifiers + "this[int]"], parsed.Main.OverridesOf("P:" + Derived + "this[int]"));
        Expect.Modifiers(parsed.Main.Property("CSharpSyntax.FieldsAndProperties.PropertyHiding.VirtualProperty").Modifiers, Modifier.Hiding);
        var viaBase = parsed.Main.Accesses("P:" + Derived + "VirtualProperty").ToList();
        Expect.One(viaBase, edge => edge.To.Value == "P:" + Modifiers + "VirtualProperty" && edge.Access == AccessKind.Read && edge.Receiver == ExpressionKind.Base, "base read");
        Expect.One(viaBase, edge => edge.To.Value == "P:" + Modifiers + "VirtualProperty" && edge.Access == AccessKind.Write && edge.Receiver == ExpressionKind.Base, "base write");
    }

    [Fact]
    public void PartialReadonlyRecordAndInterfaceProperties()
    {
        var partial = parsed.Main.Property("CSharpSyntax.FieldsAndProperties.PartialProperties.PartialProperty");
        Assert.Equal(true, partial.Bag("csharp.partial"));
        Assert.Equal(2, partial.Locations.Count);
        Assert.Equal([Accessor.Get, Accessor.Set], partial.Accessors);
        Assert.Equal(2, parsed.Main.Property("CSharpSyntax.FieldsAndProperties.PartialProperties.this[int]").Locations.Count);
        Assert.Equal(true, parsed.Main.Property("CSharpSyntax.FieldsAndProperties.PropertiesInStruct.ReadonlyPropertyInStruct").Bag("csharp.readonlyMember"));
        Assert.Null(parsed.Main.Property("CSharpSyntax.FieldsAndProperties.PropertiesInStruct.AutoPropertyInStruct").Bag("csharp.readonlyMember"));
        Assert.Null(parsed.Main.Property("CSharpSyntax.FieldsAndProperties.PropertiesInRecord.PositionalProperty").Bag("csharp.positional"));
        Assert.Equal(true, parsed.Main.Property("CSharpSyntax.FieldsAndProperties.PropertiesInRecord.PositionalPropertyWithDefault").Bag("csharp.positional"));
        Assert.Equal("\"\"", parsed.Main.Method("CSharpSyntax.FieldsAndProperties.PropertiesInRecord#.ctor(int,string)").Parameter("PositionalPropertyWithDefault").DefaultValue);
        Expect.Modifiers(parsed.Main.Property("CSharpSyntax.FieldsAndProperties.IPropertiesInInterface.StaticAbstractPropertyInInterface").Modifiers, Modifier.Static, Modifier.Abstract);
        var explicitProperty = parsed.Main.Property("CSharpSyntax.FieldsAndProperties.PropertiesWithExplicitInterfaceImplementation.CSharpSyntax.FieldsAndProperties.IPropertiesInInterface.GetOnlyPropertyInInterface");
        Assert.Equal("GetOnlyPropertyInInterface", explicitProperty.Name);
        Assert.Equal(true, explicitProperty.Bag("csharp.explicitInterfaceImplementation"));
    }

    [Fact]
    public void EventsWithAccessorsOverridesAndPartialParts()
    {
        Assert.Equal([Accessor.Add, Accessor.Remove], parsed.Main.Property(Events + "EventWithCustomAccessors").Accessors);
        Expect.One(parsed.Main.Accesses("P:" + Events + "EventWithCustomAccessors"), edge => edge.To.Value == "F:" + Events + "_customBacking" && edge.Access == AccessKind.ReadWrite, "compound assignment of the backing delegate");
        Expect.Modifiers(parsed.Main.Property(Events + "VirtualEvent").Modifiers, Modifier.Virtual);
        Assert.Equal(Visibility.Protected, parsed.Main.Property(Events + "ProtectedEvent").Visibility);
        Assert.Contains(parsed.Main.Property(Events + "EventWithAttribute").Annotations, annotation => annotation.Type.Canonical == "System.ObsoleteAttribute");
        Assert.Equal(["P:" + Events + "VirtualEvent"], parsed.Main.OverridesOf("P:CSharpSyntax.FieldsAndProperties.EventOverrides.VirtualEvent"));
        var partial = parsed.Main.Property("CSharpSyntax.FieldsAndProperties.PartialEvents.PartialEvent");
        Assert.Equal(true, partial.Bag("csharp.partial"));
        Assert.Equal(2, partial.Locations.Count);
        var raise = parsed.Main.Accesses("M:CSharpSyntax.FieldsAndProperties.EventDeclarations#RaiseAll()").ToList();
        Expect.One(raise, edge => edge.To.Value == "P:" + Events + "FieldLikeEvent" && edge.Access == AccessKind.Read && edge.Receiver == ExpressionKind.This, "event read");
        Expect.One(raise, edge => edge.To.Value == "P:" + Events + "StaticEvent" && edge.Receiver == ExpressionKind.Type, "static event read");
        Assert.Empty(parsed.Main.Invokes("M:CSharpSyntax.FieldsAndProperties.EventDeclarations#RaiseAll()"));
        var explicitEvent = parsed.Main.Property("CSharpSyntax.FieldsAndProperties.ExplicitEventImplementation.CSharpSyntax.FieldsAndProperties.IEventsInInterface.EventInInterface");
        Assert.Equal([Accessor.Add, Accessor.Remove], explicitEvent.Accessors);
        Expect.Single(parsed.Main.ImplementsMembersOf(explicitEvent.Id.Value), edge => edge.To.Value == "P:CSharpSyntax.FieldsAndProperties.IEventsInInterface.EventInInterface", "event implementation");
    }
}
