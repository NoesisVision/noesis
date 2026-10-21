using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

public class MemberTests(FixtureScan scan)
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
    public void FieldVisibility(string name, Visibility expected) => Assert.Equal(expected, scan.Main.Field(Fields + name).Visibility);

    [Fact]
    public void FieldModifiersAndConstants()
    {
        Expect.Modifiers(scan.Main.Field(Fields + "PublicField").Modifiers);
        Expect.Modifiers(scan.Main.Field(Fields + "StaticField").Modifiers, Modifier.Static);
        Expect.Modifiers(scan.Main.Field(Fields + "ReadonlyField").Modifiers, Modifier.Readonly);
        Expect.Modifiers(scan.Main.Field(Fields + "StaticReadonlyField").Modifiers, Modifier.Static, Modifier.Readonly);
        Expect.Modifiers(scan.Main.Field(Fields + "VolatileField").Modifiers, Modifier.Volatile);
        Expect.Modifiers(scan.Main.Field(Fields + "StaticVolatileField").Modifiers, Modifier.Static, Modifier.Volatile);

        var constant = scan.Main.Field(Fields + "ConstField");
        Expect.Modifiers(constant.Modifiers, Modifier.Static, Modifier.Readonly);
        Assert.Equal("1", constant.ConstantValue);
        Assert.Equal(FieldKind.Field, constant.FieldKind);
        Assert.Equal("\"constant\"", scan.Main.Field(Fields + "ConstStringField").ConstantValue);
        Assert.Equal("PlainEnumForFields.Member", scan.Main.Field(Fields + "ConstEnumField").ConstantValue);
        Expect.TypeRef("CSharpSyntax.FieldsAndProperties.PlainEnumForFields", scan.Main.Field(Fields + "ConstEnumField").Type);
        Assert.Equal("ConstField * 2", scan.Main.Field(Fields + "ConstFieldComputedFromOtherConst").ConstantValue);
        Assert.Null(scan.Main.Field(Fields + "FieldWithInitializer").ConstantValue);
        Assert.Null(scan.Main.Field(Fields + "StaticReadonlyField").ConstantValue);
        Assert.Equal("1", scan.Main.Field("CSharpSyntax.FieldsAndProperties.IFieldsInInterface.ConstFieldInInterface").ConstantValue);
    }

    [Fact]
    public void FieldFactsInTheBagAndAnnotations()
    {
        Assert.Equal(true, scan.Main.Field(Fields + "RequiredField").Bag("csharp.required"));
        Assert.Null(scan.Main.Field(Fields + "PublicField").Bag("csharp.required"));
        Assert.Contains(scan.Main.Field(Fields + "ThreadStaticField").Annotations, annotation => annotation.Type.Canonical == "System.ThreadStaticAttribute");
        Assert.Contains(scan.Main.Field(Fields + "FieldWithTargetedAttribute").Annotations, annotation => annotation.Type.Canonical == "System.NonSerializedAttribute");
        Assert.Contains(scan.Main.AnnotationsOf("csharp:F:" + Fields + "FieldWithAttribute"), annotation => annotation.Type.Canonical == "System.ObsoleteAttribute");
    }

    [Fact]
    public void EveryDeclaratorAndTypeShapeIsAField()
    {
        foreach (var name in new[] { "FirstDeclarator", "SecondDeclarator", "ThirdDeclarator", "PointerField", "FunctionPointerField", "DelegateField", "BoxedField" })
            scan.Main.Field(Fields + name);
        Expect.TypeRef("System.Nullable`1[int]", scan.Main.Field(Fields + "NullableValueField").Type);
        Expect.TypeRef("string?", scan.Main.Field(Fields + "NullableReferenceField").Type);
        Expect.TypeRef("string", scan.Main.Field(Fields + "NonNullableReferenceFieldInitializedToDefault").Type);
        Expect.TypeRef("(int,string)", scan.Main.Field(Fields + "NamedTupleField").Type);
        Expect.TypeRef("dynamic", scan.Main.Field(Fields + "DynamicField").Type);
        Expect.TypeRef("delegate*<void>", scan.Main.Field(Fields + "FunctionPointerField").Type);
        Assert.True(scan.Main.Contains("csharp:T:CSharpSyntax.FieldsAndProperties.FieldDeclarations", "csharp:F:" + Fields + "PublicField"));
    }

    [Fact]
    public void FieldLikeEventsArePropertiesWithAddAndRemove()
    {
        var fieldLike = scan.Main.Property(Fields + "FieldLikeEvent");
        Assert.Equal([Accessor.Add, Accessor.Remove], fieldLike.Accessors);
        Expect.TypeRef("System.EventHandler?", fieldLike.Type);
        Expect.Modifiers(scan.Main.Property(Fields + "StaticFieldLikeEvent").Modifiers, Modifier.Static);
        Assert.False(scan.Main.Has("csharp:F:" + Fields + "FieldLikeEvent"));
        Expect.TypeRef("System.Action`1[int]?", scan.Main.Property(Fields + "GenericDelegateEvent").Type);
    }

    [Fact]
    public void RefFieldsCarryPassingAndReadonlyRef()
    {
        const string RefStruct = "CSharpSyntax.FieldsAndProperties.FieldsInRefStruct.";
        Assert.Equal(Passing.Ref, scan.Main.Field(RefStruct + "RefField").Passing);
        Assert.Null(scan.Main.Field(RefStruct + "RefField").Bag("csharp.readonlyRef"));
        Assert.Equal(Passing.Ref, scan.Main.Field(RefStruct + "RefReadonlyField").Passing);
        Assert.Equal(true, scan.Main.Field(RefStruct + "RefReadonlyField").Bag("csharp.readonlyRef"));
        Expect.Modifiers(scan.Main.Field(RefStruct + "ReadonlyRefField").Modifiers, Modifier.Readonly);
        Assert.Equal(Passing.Ref, scan.Main.Field(RefStruct + "ReadonlyRefField").Passing);
        Assert.Equal(Passing.Value, scan.Main.Field(RefStruct + "SpanField").Passing);
    }

    [Fact]
    public void FieldInitializersAndConstructorsAreBodies()
    {
        var initializer = Assert.Single(scan.Main.Invokes("csharp:F:" + Fields + "FieldInitializedFromStaticMethod"));
        Assert.Equal("csharp:M:CSharpSyntax.FieldsAndProperties.FieldDeclarations#ComputeInitialValue()", initializer.To.Value);
        Assert.Equal(ExpressionKind.Type, initializer.Receiver);

        var constructor = scan.Main.Accesses("csharp:M:CSharpSyntax.FieldsAndProperties.FieldDeclarations#.ctor()").ToList();
        Expect.One(constructor, edge => edge.To.Value == "csharp:F:" + Fields + "ReadonlyField" && edge.Access == AccessKind.Write && edge.Receiver == ExpressionKind.This, "write of ReadonlyField");
        Expect.One(constructor, edge => edge.To.Value == "csharp:F:" + Fields + "FieldWithInitializer" && edge.Access == AccessKind.Read, "read of FieldWithInitializer");
        Expect.One(scan.Main.Accesses("csharp:M:CSharpSyntax.FieldsAndProperties.FieldDeclarations#.cctor()"), edge => edge.To.Value == "csharp:F:" + Fields + "StaticFieldInitializedInStaticConstructor" && edge.Access == AccessKind.Write && edge.Receiver == ExpressionKind.Type, "static write");
        Assert.Empty(scan.Main.Invokes("csharp:F:" + Fields + "DelegateFieldWithMethodGroupInitializer"));
        Assert.Empty(scan.Main.Accesses("csharp:F:" + Fields + "ConstFieldComputedFromOtherConst"));

        const string Closure = "CSharpSyntax.FieldsAndProperties.FieldsWithInitializersReferencingMembers";
        var closureConstructor = scan.Main.Accesses("csharp:M:" + Closure + "#.ctor()").ToList();
        Expect.One(closureConstructor, edge => edge.To.Value == "csharp:F:" + Closure + "._second" && edge.Access == AccessKind.Write && !edge.Site.ViaClosure, "direct write");
        Expect.One(closureConstructor, edge => edge.To.Value == "csharp:F:" + Closure + "._first" && edge.Access == AccessKind.Read && edge.Site.ViaClosure, "read inside the lambda");
        Expect.One(closureConstructor, edge => edge.To.Value == "csharp:F:" + Closure + "._closure" && edge.Access == AccessKind.Write, "write of the closure field");
    }

    [Fact]
    public void PropertyAccessorsAndVisibility()
    {
        Assert.Equal([Accessor.Get, Accessor.Set], scan.Main.Property(Properties + "AutoProperty").Accessors);
        Assert.Equal([Accessor.Get], scan.Main.Property(Properties + "AutoPropertyGetOnly").Accessors);
        Assert.Equal([Accessor.Get, Accessor.Init], scan.Main.Property(Properties + "AutoPropertyWithInit").Accessors);
        Assert.Equal([Accessor.Set], scan.Main.Property(Properties + "SetOnlyProperty").Accessors);
        Assert.Equal([Accessor.Init], scan.Main.Property(Properties + "InitOnlyProperty").Accessors);
        Assert.Equal([Accessor.Get, Accessor.Set], scan.Main.Property(Properties + "AutoPropertyWithPrivateSetter").Accessors);
        Assert.Equal([Accessor.Get], scan.Main.Property(Properties + "ExpressionBodiedProperty").Accessors);
        Assert.Equal([Accessor.Get, Accessor.Set], scan.Main.Property(Properties + "FieldKeywordProperty").Accessors);
        Expect.Modifiers(scan.Main.Property(Properties + "StaticAutoProperty").Modifiers, Modifier.Static);
        Assert.Equal(Visibility.Private, scan.Main.Property(Properties + "PrivateProperty").Visibility);
        Assert.Equal(Visibility.ProtectedAndArtifact, scan.Main.Property(Properties + "PrivateProtectedProperty").Visibility);
        Assert.Equal(Visibility.Public, scan.Main.Property(Properties + "AutoPropertyWithPrivateSetter").Visibility);
        Assert.Empty(scan.Main.Property(Properties + "AutoProperty").Parameters);
        Assert.Null(scan.Main.Property(Properties + "AutoProperty").ExtensionReceiver);
        Assert.Equal(Passing.Value, scan.Main.Property(Properties + "AutoProperty").ReturnPassing);
    }

    [Fact]
    public void PropertyFactsRefReturnsAndAttributes()
    {
        Assert.Equal(true, scan.Main.Property(Properties + "RequiredProperty").Bag("csharp.required"));
        Assert.Equal(true, scan.Main.Property(Properties + "RequiredInitProperty").Bag("csharp.required"));
        Assert.Equal(Passing.Ref, scan.Main.Property(Properties + "RefReturningProperty").ReturnPassing);
        Assert.Equal(Passing.Ref, scan.Main.Property(Properties + "RefReadonlyReturningProperty").ReturnPassing);
        Assert.Equal(true, scan.Main.Property(Properties + "RefReadonlyReturningProperty").Bag("csharp.readonlyRef"));
        Assert.Null(scan.Main.Property(Properties + "RefReturningProperty").Bag("csharp.readonlyRef"));

        var attributed = Assert.Single(scan.Main.Property(Properties + "PropertyWithAttribute").Annotations);
        Assert.Equal("System.ObsoleteAttribute", attributed.Type.Canonical);
        Assert.Empty(scan.Main.Property(Properties + "PropertyWithAttributeOnAccessor").Annotations);
        Assert.Equal(new[] { "csharp:T:System.NonSerializedAttribute" }, scan.Main.Property(Properties + "PropertyWithAttributeOnBackingField").Bag("csharp.backingFieldAnnotations"));
        Assert.Empty(scan.Main.Property(Properties + "PropertyWithAttributeOnBackingField").Annotations);
        Assert.Contains(scan.Main.Property(Properties + "PropertyWithNullabilityAttribute").Annotations, annotation => annotation.Type.Canonical == "System.Diagnostics.CodeAnalysis.MemberNotNullWhenAttribute");
        Expect.TypeRef("int*", scan.Main.Property(Properties + "PointerProperty").Type);
        Expect.TypeRef("(int,string)", scan.Main.Property(Properties + "NamedTupleProperty").Type);
        Expect.TypeRef("dynamic", scan.Main.Property(Properties + "DynamicProperty").Type);
    }

    [Fact]
    public void IndexersArePropertiesWithParameters()
    {
        var byInt = scan.Main.Property(Properties + "this[int]");
        Assert.Equal("this[]", byInt.Name);
        Assert.Equal("index", Assert.Single(byInt.Parameters).Name);
        Assert.Equal([Accessor.Get, Accessor.Set], byInt.Accessors);
        Expect.TypeRef("int", byInt.Type);
        scan.Main.Property(Properties + "this[string]");
        scan.Main.Property(Properties + "this[int,int]");
        Assert.True(scan.Main.Property(Properties + "this[int[]]").Parameters[0].Variadic);
        Assert.Equal(Visibility.Private, scan.Main.Property(Properties + "this[int,bool]").Visibility);
        Assert.Equal([Accessor.Get, Accessor.Init], scan.Main.Property(Properties + "this[System.Index]").Accessors);
        Expect.TypeRef("int[]", scan.Main.Property(Properties + "this[System.Range]").Type);
        Assert.True(scan.Main.Contains("csharp:T:CSharpSyntax.FieldsAndProperties.PropertyDeclarations", "csharp:R:" + Properties + "this[int]"));
    }

    [Fact]
    public void BackingFieldsAreNeverEmittedAndFieldKeywordAccessesAreDropped()
    {
        Assert.DoesNotContain(scan.Main.Nodes, node => node.Id.Value.StartsWith("csharp:F:" + Properties, StringComparison.Ordinal) && node.Name.Contains("k__BackingField"));
        Assert.Empty(scan.Main.Accesses("csharp:R:" + Properties + "FieldKeywordProperty"));
        var lazy = Assert.Single(scan.Main.Invokes("csharp:R:" + Properties + "FieldKeywordLazyProperty"));
        Assert.Equal("csharp:M:CSharpSyntax.FieldsAndProperties.PropertyDeclarations#ComputeLazyValue()", lazy.To.Value);
        var setter = scan.Main.Accesses("csharp:R:" + Properties + "PropertyWithPrivateBackingAndValidation").ToList();
        Expect.One(setter, edge => edge.To.Value == "csharp:F:" + Properties + "_backingField" && edge.Access == AccessKind.Write, "write of the backing field");
        Expect.One(setter, edge => edge.To.Value == "csharp:F:" + Properties + "_backingField" && edge.Access == AccessKind.Read, "read of the backing field");
        Expect.One(scan.Main.Invokes("csharp:R:" + Properties + "PropertyWithPrivateBackingAndValidation"), edge => edge.To.Value == "csharp:M:System.ArgumentOutOfRangeException#.ctor(string)" && edge.Receiver is null, "exception creation");
        Expect.One(scan.Main.Accesses("csharp:R:" + Properties + "this[int]"), edge => edge.To.Value == "csharp:F:" + Properties + "_array" && edge.Access == AccessKind.Read, "array read in indexer");
    }

    [Fact]
    public void PropertyModifiersAndOverrides()
    {
        const string Modifiers = "CSharpSyntax.FieldsAndProperties.PropertyModifiers.";
        const string Derived = "CSharpSyntax.FieldsAndProperties.PropertyModifiersDerived.";
        Expect.Modifiers(scan.Main.Property(Modifiers + "AbstractProperty").Modifiers, Modifier.Abstract);
        Expect.Modifiers(scan.Main.Property(Modifiers + "VirtualProperty").Modifiers, Modifier.Virtual);
        Expect.Modifiers(scan.Main.Property(Derived + "AbstractProperty").Modifiers, Modifier.Virtual);
        Expect.Modifiers(scan.Main.Property(Derived + "VirtualExpressionBodiedProperty").Modifiers, Modifier.Final);
        Assert.Equal(["csharp:R:" + Modifiers + "AbstractProperty"], scan.Main.OverridesOf("csharp:R:" + Derived + "AbstractProperty"));
        Assert.Equal(["csharp:R:" + Modifiers + "this[int]"], scan.Main.OverridesOf("csharp:R:" + Derived + "this[int]"));
        Expect.Modifiers(scan.Main.Property("CSharpSyntax.FieldsAndProperties.PropertyHiding.VirtualProperty").Modifiers, Modifier.Hiding);
        var viaBase = scan.Main.Accesses("csharp:R:" + Derived + "VirtualProperty").ToList();
        Expect.One(viaBase, edge => edge.To.Value == "csharp:R:" + Modifiers + "VirtualProperty" && edge.Access == AccessKind.Read && edge.Receiver == ExpressionKind.Base, "base read");
        Expect.One(viaBase, edge => edge.To.Value == "csharp:R:" + Modifiers + "VirtualProperty" && edge.Access == AccessKind.Write && edge.Receiver == ExpressionKind.Base, "base write");
    }

    [Fact]
    public void PartialReadonlyRecordAndInterfaceProperties()
    {
        var partial = scan.Main.Property("CSharpSyntax.FieldsAndProperties.PartialProperties.PartialProperty");
        Assert.Equal(true, partial.Bag("csharp.partial"));
        Assert.Equal(2, partial.Locations.Count);
        Assert.Equal([Accessor.Get, Accessor.Set], partial.Accessors);
        Assert.Equal(2, scan.Main.Property("CSharpSyntax.FieldsAndProperties.PartialProperties.this[int]").Locations.Count);
        Assert.Equal(true, scan.Main.Property("CSharpSyntax.FieldsAndProperties.PropertiesInStruct.ReadonlyPropertyInStruct").Bag("csharp.readonlyMember"));
        Assert.Null(scan.Main.Property("CSharpSyntax.FieldsAndProperties.PropertiesInStruct.AutoPropertyInStruct").Bag("csharp.readonlyMember"));
        Assert.Null(scan.Main.Property("CSharpSyntax.FieldsAndProperties.PropertiesInRecord.PositionalProperty").Bag("csharp.positional"));
        Assert.Equal(true, scan.Main.Property("CSharpSyntax.FieldsAndProperties.PropertiesInRecord.PositionalPropertyWithDefault").Bag("csharp.positional"));
        Assert.Equal("\"\"", scan.Main.Method("CSharpSyntax.FieldsAndProperties.PropertiesInRecord#.ctor(int,string)").Parameter("PositionalPropertyWithDefault").DefaultValue);
        Expect.Modifiers(scan.Main.Property("CSharpSyntax.FieldsAndProperties.IPropertiesInInterface.StaticAbstractPropertyInInterface").Modifiers, Modifier.Static, Modifier.Abstract);
        var explicitProperty = scan.Main.Property("CSharpSyntax.FieldsAndProperties.PropertiesWithExplicitInterfaceImplementation.CSharpSyntax.FieldsAndProperties.IPropertiesInInterface.GetOnlyPropertyInInterface");
        Assert.Equal("GetOnlyPropertyInInterface", explicitProperty.Name);
        Assert.Equal(true, explicitProperty.Bag("csharp.explicitInterfaceImplementation"));
    }

    [Fact]
    public void EventsWithAccessorsOverridesAndPartialParts()
    {
        Assert.Equal([Accessor.Add, Accessor.Remove], scan.Main.Property(Events + "EventWithCustomAccessors").Accessors);
        Expect.One(scan.Main.Accesses("csharp:R:" + Events + "EventWithCustomAccessors"), edge => edge.To.Value == "csharp:F:" + Events + "_customBacking" && edge.Access == AccessKind.ReadWrite, "compound assignment of the backing delegate");
        Expect.Modifiers(scan.Main.Property(Events + "VirtualEvent").Modifiers, Modifier.Virtual);
        Assert.Equal(Visibility.Protected, scan.Main.Property(Events + "ProtectedEvent").Visibility);
        Assert.Contains(scan.Main.Property(Events + "EventWithAttribute").Annotations, annotation => annotation.Type.Canonical == "System.ObsoleteAttribute");
        Assert.Equal(["csharp:R:" + Events + "VirtualEvent"], scan.Main.OverridesOf("csharp:R:CSharpSyntax.FieldsAndProperties.EventOverrides.VirtualEvent"));
        var partial = scan.Main.Property("CSharpSyntax.FieldsAndProperties.PartialEvents.PartialEvent");
        Assert.Equal(true, partial.Bag("csharp.partial"));
        Assert.Equal(2, partial.Locations.Count);
        var raise = scan.Main.Accesses("csharp:M:CSharpSyntax.FieldsAndProperties.EventDeclarations#RaiseAll()").ToList();
        Expect.One(raise, edge => edge.To.Value == "csharp:R:" + Events + "FieldLikeEvent" && edge.Access == AccessKind.Read && edge.Receiver == ExpressionKind.This, "event read");
        Expect.One(raise, edge => edge.To.Value == "csharp:R:" + Events + "StaticEvent" && edge.Receiver == ExpressionKind.Type, "static event read");
        Assert.Empty(scan.Main.Invokes("csharp:M:CSharpSyntax.FieldsAndProperties.EventDeclarations#RaiseAll()"));
        var explicitEvent = scan.Main.Property("CSharpSyntax.FieldsAndProperties.ExplicitEventImplementation.CSharpSyntax.FieldsAndProperties.IEventsInInterface.EventInInterface");
        Assert.Equal([Accessor.Add, Accessor.Remove], explicitEvent.Accessors);
        Expect.Single(scan.Main.ImplementsMembersOf(explicitEvent.Id.Value), edge => edge.To.Value == "csharp:R:CSharpSyntax.FieldsAndProperties.IEventsInInterface.EventInInterface", "event implementation");
    }
}
