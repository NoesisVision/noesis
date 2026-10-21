using System.Text.RegularExpressions;
using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

public class TypeTests(FixtureScan scan)
{
    private const string Types = "CSharpSyntax.Types.";

    [Fact]
    public void AClassIsDeclaredWithItsLocationVisibilityAndNoModifiers()
    {
        var type = scan.Main.Type(Types + "PublicClass");
        Assert.Equal("PublicClass", type.Name);
        Assert.Equal(TypeKind.Class, type.TypeKind);
        Assert.Equal(Visibility.Public, type.Visibility);
        Assert.Empty(type.Modifiers);
        Assert.Equal(Origin.Declared, type.Origin);
        var location = Assert.Single(type.Locations);
        Assert.Equal("scanners/dotnet/test/fixtures/CSharpSyntax/Types/ClassKinds.cs", location.File);
        Assert.Equal(3, location.StartLine);
        Assert.Null(type.UnderlyingType);
        Assert.Null(type.DelegateSignature);
        Assert.Null(type.AliasOf);
        Assert.True(scan.Main.Contains("N:CSharpSyntax.Types", type.Id.Value));
    }

    [Theory]
    [InlineData("InternalClass", Visibility.Artifact)]
    [InlineData("ClassWithoutAccessModifierIsInternal", Visibility.Artifact)]
    [InlineData("OuterClassWithNestedTypes+PublicNestedClass", Visibility.Public)]
    [InlineData("OuterClassWithNestedTypes+PrivateNestedClass", Visibility.Private)]
    [InlineData("OuterClassWithNestedTypes+ProtectedNestedClass", Visibility.Protected)]
    [InlineData("OuterClassWithNestedTypes+InternalNestedClass", Visibility.Artifact)]
    [InlineData("OuterClassWithNestedTypes+ProtectedInternalNestedClass", Visibility.ProtectedOrArtifact)]
    [InlineData("OuterClassWithNestedTypes+PrivateProtectedNestedClass", Visibility.ProtectedAndArtifact)]
    public void VisibilityNamesTheScope(string path, Visibility expected) =>
        Assert.Equal(expected, scan.Main.Type(Types + path).Visibility);

    [Fact]
    public void ModifiersAreFacts()
    {
        Expect.Modifiers(scan.Main.Type(Types + "StaticClass").Modifiers, Modifier.Static);
        Expect.Modifiers(scan.Main.Type(Types + "AbstractClass").Modifiers, Modifier.Abstract);
        Expect.Modifiers(scan.Main.Type(Types + "SealedClass").Modifiers, Modifier.Final);
        Expect.Modifiers(scan.Main.Type(Types + "PositionalRecord").Modifiers, Modifier.Record);
        Expect.Modifiers(scan.Main.Type(Types + "SealedRecord").Modifiers, Modifier.Final, Modifier.Record);
        Expect.Modifiers(scan.Main.Type(Types + "AbstractRecord").Modifiers, Modifier.Abstract, Modifier.Record);
        Expect.Modifiers(scan.Main.Type(Types + "IPlainInterface").Modifiers);
        Expect.Modifiers(scan.Main.Type(Types + "PlainStruct").Modifiers);
        Expect.Modifiers(scan.Main.Type(Types + "PlainEnum").Modifiers);
    }

    [Fact]
    public void PartialTypesAreOneNodeWithSeveralLocations()
    {
        var partial = scan.Main.Type(Types + "PartialClass");
        Assert.Equal(2, partial.Locations.Count);
        Assert.Equal(true, partial.Bag("csharp.partial"));
        Assert.Null(scan.Main.Type(Types + "PublicClass").Bag("csharp.partial"));
        Assert.True(scan.Main.Has("M:" + Types + "PartialClass#MethodInFirstPart()"));
        Assert.True(scan.Main.Has("M:" + Types + "PartialClass#MethodInSecondPart()"));
        Assert.Equal(2, scan.Main.Type(Types + "SealedPartialClass").Locations.Count);
    }

    [Fact]
    public void LanguageOnlyTypeFactsGoToTheBag()
    {
        Assert.Equal(true, scan.Main.Type(Types + "UnsafeClass").Bag("csharp.unsafe"));
        Assert.Equal(true, scan.Main.Type(Types + "RefStruct").Bag("csharp.isRefStruct"));
        Assert.Equal(true, scan.Main.Type(Types + "ReadonlyStruct").Bag("csharp.isReadonlyStruct"));
        Assert.Equal(true, scan.Main.Type(Types + "ReadonlyRefStruct").Bag("csharp.isRefStruct"));
        Assert.Equal(true, scan.Main.Type(Types + "ReadonlyRefStruct").Bag("csharp.isReadonlyStruct"));
        Assert.Equal(true, scan.Main.Type(Types + "ClassWithPrimaryConstructor").Bag("csharp.primaryConstructor"));
        Assert.Null(scan.Main.Type(Types + "PublicClass").Bag("csharp.primaryConstructor"));
    }

    [Fact]
    public void APrimaryConstructorIsAConstructorFlaggedInTheBag()
    {
        var constructor = scan.Main.Method(Types + "ClassWithPrimaryConstructor#.ctor(int)");
        Assert.Equal(MethodKind.Constructor, constructor.MethodKind);
        Assert.Equal(true, constructor.Bag("csharp.primaryConstructor"));
        Assert.Equal("primaryConstructorParameter", Assert.Single(constructor.Signature.Parameters).Name);
        Assert.Equal(Origin.Declared, constructor.Origin);
        Assert.NotEmpty(constructor.Locations);
    }

    [Fact]
    public void FileLocalTypesAreFileVisibleAndHashedInTheirId()
    {
        var fileLocal = scan.Main.Nodes.OfType<TypeNode>().Single(type => type.Name == "FileLocalClass");
        Assert.Matches(new Regex("^T:CSharpSyntax\\.Types\\.FileLocalClass@[0-9a-f]{8}$"), fileLocal.Id.Value);
        Assert.Equal(Visibility.File, fileLocal.Visibility);
        Assert.Equal(true, fileLocal.Bag("csharp.isFileLocal"));
        var creation = Assert.Single(scan.Main.Invokes("F:" + Types + "ClassUsingFileLocalClass._fileLocalInstance"));
        Assert.Equal(fileLocal.Id.Value + "#.ctor()", creation.To.Value.Replace("M:", "T:"));
        foreach (var name in new[] { "FileLocalStruct", "IFileLocalInterface", "FileLocalEnum", "FileLocalRecord", "FileLocalStaticClass" })
            Assert.Contains(scan.Main.Nodes.OfType<TypeNode>(), type => type.Name == name && type.Visibility == Visibility.File);
    }

    [Fact]
    public void NestedTypesUsePlusInTheirIdAndAreContainedByTheOuterType()
    {
        var outer = "T:" + Types + "OuterClassWithNestedTypes";
        Assert.True(scan.Main.Contains(outer, outer + "+PublicNestedClass"));
        Assert.True(scan.Main.Contains(outer + "+NestedClassWithNestedClass", outer + "+NestedClassWithNestedClass+DoublyNestedClass"));
        Assert.Equal(TypeKind.Struct, scan.Main.Type(Types + "OuterClassWithNestedTypes+NestedStruct").TypeKind);
        Assert.Equal(TypeKind.Interface, scan.Main.Type(Types + "OuterClassWithNestedTypes+INestedInterface").TypeKind);
        Assert.Equal(TypeKind.Enum, scan.Main.Type(Types + "OuterClassWithNestedTypes+NestedEnum").TypeKind);
        Assert.Equal(TypeKind.Delegate, scan.Main.Type(Types + "OuterClassWithNestedTypes+NestedDelegate").TypeKind);
        Expect.Modifiers(scan.Main.Type(Types + "OuterClassWithNestedTypes+NestedRecordStruct").Modifiers, Modifier.Record);
        Assert.Equal(TypeKind.Struct, scan.Main.Type(Types + "OuterClassWithNestedTypes+NestedRecordStruct").TypeKind);
        scan.Main.Type(Types + "OuterClassWithNestedTypes+GenericNestedClass`1");
        scan.Main.Type(Types + "StructWithNestedTypes+ClassNestedInStruct");
        scan.Main.Type(Types + "IInterfaceWithNestedTypes+EnumNestedInInterface");
    }

    [Fact]
    public void ObjectBaseIsNeverAnEdgeAndStructsEnumsAndDelegatesHaveNoBase()
    {
        Assert.Empty(scan.Main.ExtendsOf("T:" + Types + "ClassWithExplicitObjectBase"));
        Assert.Empty(scan.Main.ExtendsOf("T:" + Types + "PublicClass"));
        Assert.Empty(scan.Main.ExtendsOf("T:" + Types + "PlainStruct"));
        Assert.Empty(scan.Main.ExtendsOf("T:" + Types + "PlainEnum"));
        Assert.Empty(scan.Main.ExtendsOf("T:" + Types + "DelegateWithReturnValue"));
        Assert.Empty(scan.Main.ExtendsOf("T:" + Types + "PositionalRecord"));
        Assert.Equal(["System.Attribute"], scan.Main.ExtendsOf("T:" + Types + "ClassDerivedFromAttribute"));
    }

    [Fact]
    public void RecordsSynthesiseGeneratedMembersAndDeclarePositionalProperties()
    {
        var record = "T:" + Types + "PositionalRecord";
        Assert.Equal(TypeKind.Class, scan.Main.Type(Types + "PositionalRecord").TypeKind);
        foreach (var generated in new[] { "#Equals(CSharpSyntax.Types.PositionalRecord)", "#Equals(object)", "#GetHashCode()", "#ToString()", "#Deconstruct(int,string)", "#<Clone>$()", "#PrintMembers(System.Text.StringBuilder)", "#op_Equality(CSharpSyntax.Types.PositionalRecord,CSharpSyntax.Types.PositionalRecord)", "#.ctor(CSharpSyntax.Types.PositionalRecord)" })
        {
            var member = scan.Main.Method(Types + "PositionalRecord" + generated);
            Assert.Equal(Origin.Generated, member.Origin);
            Assert.Empty(member.Locations);
        }
        var equalityContract = scan.Main.Property(Types + "PositionalRecord.EqualityContract");
        Assert.Equal(Origin.Generated, equalityContract.Origin);
        var constructor = scan.Main.Method(Types + "PositionalRecord#.ctor(int,string)");
        Assert.Equal(Origin.Declared, constructor.Origin);
        Assert.Equal(true, constructor.Bag("csharp.primaryConstructor"));

        var first = scan.Main.Property(Types + "PositionalRecord.First");
        Assert.Equal(Origin.Declared, first.Origin);
        Assert.Equal(true, first.Bag("csharp.positional"));
        Assert.Equal([Accessor.Get, Accessor.Init], first.Accessors);
        Expect.TypeRef("int", first.Type);
        Assert.Equal(3, Assert.Single(first.Locations).StartLine);
        Assert.Equal(["System.Object#Equals(object)", "System.Object#GetHashCode()", "System.Object#ToString()"],
            scan.Main.Edges<OverridesEdge>().Where(e => e.From.Value.StartsWith(record.Replace("T:", "M:") + "#", StringComparison.Ordinal)).Select(e => e.To.Value.Replace("M:", "")).Order());
        Assert.True(scan.Main.Contains(record, record.Replace("T:", "P:") + ".First"));
        Assert.DoesNotContain(scan.Main.Nodes, node => node.Id.Value.Contains("k__BackingField"));
    }

    [Fact]
    public void RecordStructsAreStructsWithTheRecordModifier()
    {
        var recordStruct = scan.Main.Type(Types + "PositionalRecordStruct");
        Assert.Equal(TypeKind.Struct, recordStruct.TypeKind);
        Expect.Modifiers(recordStruct.Modifiers, Modifier.Record);
        Assert.Equal(true, scan.Main.Type(Types + "ReadonlyRecordStruct").Bag("csharp.isReadonlyStruct"));
        Assert.Equal(2, scan.Main.Type(Types + "PartialRecordStruct").Locations.Count);
        Assert.Equal(Origin.Generated, scan.Main.Method(Types + "PositionalRecordStruct#Deconstruct(int,string)").Origin);
    }

    [Fact]
    public void APositionalPropertyAttributeLandsOnTheProperty()
    {
        var value = scan.Main.Property(Types + "RecordWithPositionalFieldAttribute.Value");
        Assert.Contains(value.Annotations, annotation => annotation.Type.Canonical == "System.ObsoleteAttribute");
    }

    [Fact]
    public void InterfaceMembersAreAbstractUnlessTheyHaveABody()
    {
        var abstractMethod = scan.Main.Method(Types + "IPlainInterface#MethodInInterface()");
        Expect.Modifiers(abstractMethod.Modifiers, Modifier.Abstract);
        Assert.True(abstractMethod.Bodiless);
        var defaultMethod = scan.Main.Method(Types + "IInterfaceWithDefaultMethod#MethodWithDefaultBody()");
        Expect.Modifiers(defaultMethod.Modifiers, Modifier.Virtual);
        Assert.False(defaultMethod.Bodiless);
        Expect.Modifiers(scan.Main.Method(Types + "IInterfaceWithStaticAbstractMembers`1#StaticAbstractFactory()").Modifiers, Modifier.Static, Modifier.Abstract);
        Expect.Modifiers(scan.Main.Method(Types + "IInterfaceWithStaticAbstractMembers`1#StaticVirtualMethod()").Modifiers, Modifier.Static, Modifier.Virtual);
        Expect.Modifiers(scan.Main.Method(Types + "IInterfaceWithStaticMembers#StaticMethodInInterface()").Modifiers, Modifier.Static);
        Assert.Equal(MethodKind.Operator, scan.Main.Method(Types + "IInterfaceWithStaticAbstractMembers`1#op_Addition(!0,!0)").MethodKind);
        Assert.Equal(Visibility.Private, scan.Main.Method(Types + "IInterfaceWithAccessibilityOnDefaultMembers#PrivateHelperMethod()").Visibility);
        Expect.Modifiers(scan.Main.Method(Types + "IInterfaceWithAccessibilityOnDefaultMembers#SealedDefaultMethod()").Modifiers, Modifier.Final);
        Assert.Equal([Accessor.Get], scan.Main.Property(Types + "IInterfaceWithProperty.GetOnlyProperty").Accessors);
        Assert.Equal([Accessor.Get, Accessor.Init], scan.Main.Property(Types + "IInterfaceWithProperty.GetInitProperty").Accessors);
        Assert.Equal([Accessor.Add, Accessor.Remove], scan.Main.Property(Types + "IInterfaceWithEvent.EventInInterface").Accessors);
        Assert.Equal(2, scan.Main.Type(Types + "IPartialInterface").Locations.Count);
    }

    [Fact]
    public void EnumsCarryTheirUnderlyingTypeAndMembersWithConstantText()
    {
        var plain = scan.Main.Type(Types + "PlainEnum");
        Assert.Equal(TypeKind.Enum, plain.TypeKind);
        Expect.TypeRef("int", plain.UnderlyingType!);
        Expect.TypeRef("byte", scan.Main.Type(Types + "EnumWithByteUnderlyingType").UnderlyingType!);
        Expect.TypeRef("ulong", scan.Main.Type(Types + "EnumWithUnsignedLongUnderlyingType").UnderlyingType!);

        var first = scan.Main.Field(Types + "PlainEnum.First");
        Assert.Equal(FieldKind.EnumMember, first.FieldKind);
        Assert.Equal("0", first.ConstantValue);
        Expect.TypeRef("CSharpSyntax.Types.PlainEnum", first.Type);
        Expect.Modifiers(first.Modifiers, Modifier.Static, Modifier.Readonly);
        Assert.Equal("2", scan.Main.Field(Types + "PlainEnum.Third").ConstantValue);
        Assert.Equal("10", scan.Main.Field(Types + "EnumWithExplicitValues.Ten").ConstantValue);
        Assert.Equal("21", scan.Main.Field(Types + "EnumWithExplicitValues.TwentyOne").ConstantValue);
        Assert.Equal("Ten", scan.Main.Field(Types + "EnumWithExplicitValues.SameAsTen").ConstantValue);
        Assert.Equal("Read | Write", scan.Main.Field(Types + "FlagsEnum.ReadWrite").ConstantValue);
        Assert.Equal("1L << 40", scan.Main.Field(Types + "EnumWithLongUnderlyingType.Big").ConstantValue);
        Assert.True(scan.Main.Contains("T:" + Types + "PlainEnum", "F:" + Types + "PlainEnum.First"));
        Assert.Contains(scan.Main.AnnotationsOf("T:" + Types + "FlagsEnum"), annotation => annotation.Type.Canonical == "System.FlagsAttribute");
        Assert.Contains(scan.Main.Field(Types + "EnumWithAttributedMembers.ObsoleteMember").Annotations, annotation => annotation.Type.Canonical == "System.ObsoleteAttribute");
        Assert.DoesNotContain(scan.Main.Nodes, node => node.Id.Value.StartsWith("M:" + Types + "PlainEnum#", StringComparison.Ordinal));
    }

    [Fact]
    public void DelegatesCarryTheirSignatureAndGeneratedInvoke()
    {
        var withReturn = scan.Main.Type(Types + "DelegateWithReturnValue");
        Assert.Equal(TypeKind.Delegate, withReturn.TypeKind);
        Expect.TypeRef("int", withReturn.DelegateSignature!.ReturnType);
        Assert.Equal("argument", Assert.Single(withReturn.DelegateSignature.Parameters).Name);
        var invoke = scan.Main.Method(Types + "DelegateWithReturnValue#Invoke(int)");
        Assert.Equal(Origin.Generated, invoke.Origin);
        Assert.True(scan.Main.Has("M:" + Types + "DelegateWithReturnValue#BeginInvoke(int,System.AsyncCallback,object)"));
        Assert.False(scan.Main.Has("M:" + Types + "DelegateWithReturnValue#.ctor(object,nint)"));

        var generic = scan.Main.Type(Types + "GenericDelegate`2");
        Assert.Equal([Variance.Contravariant, Variance.Covariant], generic.TypeParameters.Select(parameter => parameter.Variance));
        Expect.TypeRef("!1", generic.DelegateSignature!.ReturnType);

        var refOutIn = scan.Main.Type(Types + "DelegateWithRefOutIn").DelegateSignature!;
        Assert.Equal([Passing.Ref, Passing.Ref, Passing.Ref], refOutIn.Parameters.Select(parameter => parameter.Passing));
        Assert.Equal([null, "out", "in"], refOutIn.Parameters.Select(parameter => parameter.Bag("csharp.refKind")));
        Assert.Equal(Passing.Ref, scan.Main.Type(Types + "RefReturningDelegate").DelegateSignature!.ReturnPassing);
        Assert.Equal(true, scan.Main.Type(Types + "RefReadonlyReturningDelegate").Bag("csharp.readonlyRef"));
        Assert.True(scan.Main.Type(Types + "DelegateWithParamsArray").DelegateSignature!.Parameters[0].Variadic);
        Assert.Equal("null", scan.Main.Type(Types + "DelegateWithOptionalParameter").DelegateSignature!.Parameters[1].DefaultValue);
        Expect.TypeRef("(int,int)", scan.Main.Type(Types + "TupleReturningDelegate").DelegateSignature!.ReturnType);
        Assert.Equal(Visibility.Artifact, scan.Main.Type(Types + "InternalDelegate").Visibility);
    }

    [Theory]
    [InlineData("BoolField", "bool")]
    [InlineData("ByteField", "byte")]
    [InlineData("SignedByteField", "sbyte")]
    [InlineData("CharField", "char")]
    [InlineData("DecimalField", "decimal")]
    [InlineData("DoubleField", "double")]
    [InlineData("FloatField", "float")]
    [InlineData("IntField", "int")]
    [InlineData("UnsignedIntField", "uint")]
    [InlineData("NativeIntField", "nint")]
    [InlineData("NativeUnsignedIntField", "nuint")]
    [InlineData("LongField", "long")]
    [InlineData("UnsignedLongField", "ulong")]
    [InlineData("ShortField", "short")]
    [InlineData("UnsignedShortField", "ushort")]
    [InlineData("ObjectField", "object")]
    [InlineData("StringField", "string")]
    [InlineData("DynamicField", "dynamic")]
    [InlineData("IntFieldViaSystemName", "int")]
    [InlineData("StringFieldViaSystemName", "string")]
    [InlineData("BoolFieldViaSystemName", "bool")]
    [InlineData("IntPtrField", "nint")]
    [InlineData("UIntPtrField", "nuint")]
    [InlineData("NullableIntField", "System.Nullable`1[int]")]
    [InlineData("NullableIntFieldViaGenericName", "System.Nullable`1[int]")]
    [InlineData("NullableStringField", "string?")]
    [InlineData("NullableObjectField", "object?")]
    [InlineData("SingleDimensionalArrayField", "int[]")]
    [InlineData("TwoDimensionalArrayField", "int[,]")]
    [InlineData("ThreeDimensionalArrayField", "int[,,]")]
    [InlineData("JaggedArrayField", "int[][]")]
    [InlineData("JaggedArrayOfTwoDimensionalArraysField", "int[,][]")]
    [InlineData("ArrayOfNullableStringsField", "string?[]")]
    [InlineData("ArrayOfNullableIntsField", "System.Nullable`1[int][]")]
    [InlineData("NonGenericArrayField", "System.Array")]
    [InlineData("UnnamedTupleField", "(int,string)")]
    [InlineData("NamedTupleField", "(int,string)")]
    [InlineData("NestedTupleField", "(int,(string,bool))")]
    [InlineData("TupleFieldViaGenericName", "(int,string)")]
    [InlineData("ReferenceTupleField", "System.Tuple`2[int,string]")]
    [InlineData("IntPointerField", "int*")]
    [InlineData("VoidPointerField", "void*")]
    [InlineData("PointerToPointerField", "int**")]
    [InlineData("ManagedFunctionPointerField", "delegate*<int,int>")]
    [InlineData("UnmanagedFunctionPointerField", "delegate* unmanaged<int,int>")]
    [InlineData("UnmanagedFunctionPointerWithCallingConventionField", "delegate* unmanaged[Cdecl]<int,void>")]
    [InlineData("GenericListField", "System.Collections.Generic.List`1[int]")]
    [InlineData("NestedGenericField", "System.Collections.Generic.Dictionary`2[string,System.Collections.Generic.List`1[int]]")]
    [InlineData("GenericInterfaceField", "System.Collections.Generic.IEnumerable`1[System.Collections.Generic.KeyValuePair`2[string,int[]]]")]
    [InlineData("FuncField", "System.Func`2[int,string]")]
    [InlineData("ValueTypeBaseTypeField", "System.ValueType")]
    [InlineData("NestedTypeField", "CSharpSyntax.Types.OuterClassWithNestedTypes+PublicNestedClass")]
    [InlineData("GenericNestedTypeField", "CSharpSyntax.Types.OuterClassWithNestedTypes+GenericNestedClass`1[string]")]
    [InlineData("DeeplyNestedGenericField", "CSharpSyntax.Types.GenericStruct`1[CSharpSyntax.Types.GenericRecord`1[CSharpSyntax.Types.PositionalRecordStruct]]")]
    [InlineData("FullyQualifiedObjectField", "object")]
    [InlineData("LockField", "System.Threading.Lock")]
    public void BuiltInAndSpecialTypesHaveOneCanonicalForm(string field, string canonical) =>
        Expect.TypeRef(canonical, scan.Main.Field(Types + "BuiltInTypesAsFields." + field).Type);

    [Fact]
    public void TypeReferenceShapesCarryNullabilityNamesAndConventions()
    {
        var named = Assert.IsType<NamedTypeRef>(scan.Main.Field(Types + "BuiltInTypesAsFields.NullableIntField").Type);
        Assert.False(named.Nullable);
        Assert.False(named.Unbound);
        Assert.True(Assert.IsType<PrimitiveTypeRef>(scan.Main.Field(Types + "BuiltInTypesAsFields.NullableStringField").Type) is not null);
        var tuple = Assert.IsType<TupleTypeRef>(scan.Main.Field(Types + "BuiltInTypesAsFields.NamedTupleField").Type);
        Assert.Equal(["Count", "Name"], tuple.Elements.Select(element => element.Name));
        Assert.All(Assert.IsType<TupleTypeRef>(scan.Main.Field(Types + "BuiltInTypesAsFields.UnnamedTupleField").Type).Elements, element => Assert.Null(element.Name));
        var function = Assert.IsType<FunctionTypeRef>(scan.Main.Field(Types + "BuiltInTypesAsFields.UnmanagedFunctionPointerWithCallingConventionField").Type);
        Assert.Equal("unmanaged[Cdecl]", function.CallingConvention);
        Assert.Null(Assert.IsType<FunctionTypeRef>(scan.Main.Field(Types + "BuiltInTypesAsFields.ManagedFunctionPointerField").Type).CallingConvention);
        var array = Assert.IsType<ArrayTypeRef>(scan.Main.Field(Types + "BuiltInTypesAsFields.TwoDimensionalArrayField").Type);
        Assert.Equal(2, array.Rank);
        Assert.Equal(true, scan.Main.Type(Types + "SpanTypesAsFields").Bag("csharp.isRefStruct"));
    }

    [Fact]
    public void AnonymousTypesAreStructuralCreationsAndNeverNodes()
    {
        var creation = Expect.One(scan.Main.UsesTypes("M:" + Types + "AnonymousAndImplicitTypes#CreateAnonymousType()"), edge => edge.Role == TypeUseRole.Creation && edge.To is StructuralTypeRef, "structural creation");
        Assert.Equal("{AnonymousProperty:int,AnonymousNested:{Inner:string}}", creation.To.Canonical);
        Assert.Empty(scan.Main.Invokes("M:" + Types + "AnonymousAndImplicitTypes#CreateAnonymousType()"));
        Assert.Empty(scan.Main.Accesses("M:" + Types + "AnonymousAndImplicitTypes#CreateAnonymousType()"));
        Assert.DoesNotContain(scan.Main.Nodes, node => node.Name.Contains("<>f__AnonymousType"));
    }

    [Fact]
    public void StructsWithSpecialMembers()
    {
        var buffer = scan.Main.Field(Types + "StructWithFixedSizeBuffer.FixedSizeBuffer");
        Expect.TypeRef("byte", buffer.Type);
        Assert.Equal(16L, buffer.Bag("csharp.fixedSize"));
        Assert.Equal(4L, scan.Main.Field(Types + "StructWithFixedSizeBuffer.FixedSizeIntBuffer").Bag("csharp.fixedSize"));
        var intView = scan.Main.Field(Types + "StructWithExplicitLayout.IntView");
        Assert.Contains(intView.Annotations, annotation => annotation.Type.Canonical == "System.Runtime.InteropServices.FieldOffsetAttribute");
        var layout = Assert.Single(scan.Main.Type(Types + "StructWithSequentialLayout").Annotations);
        Assert.Equal("System.Runtime.InteropServices.StructLayoutAttribute", layout.Type.Canonical);
        Assert.Equal(["layoutKind", "Pack"], layout.Arguments.Select(argument => argument.Name));
        var kind = Assert.IsType<EnumAnnotationValue>(layout.Arguments[0].Value);
        Assert.Equal("System.Runtime.InteropServices.LayoutKind", kind.Type.Canonical);
        Assert.Equal("Sequential", kind.Member);
        Assert.False(layout.Arguments[1].Positional);
        Assert.Equal("1", Assert.IsType<LiteralAnnotationValue>(layout.Arguments[1].Value).Text);
        Assert.Equal(true, scan.Main.Method(Types + "StructWithReadonlyMembers#ReadonlyMethodInStruct()").Bag("csharp.readonlyMember"));
        Assert.Equal(true, scan.Main.Property(Types + "StructWithReadonlyMembers.ReadonlyPropertyInStruct").Bag("csharp.readonlyMember"));
        Assert.Null(scan.Main.Method(Types + "StructWithReadonlyMembers#MutatingMethodInStruct()").Bag("csharp.readonlyMember"));
        Assert.Equal(Passing.Ref, scan.Main.Field(Types + "RefStructWithRefField.RefField").Passing);
        Assert.Equal(true, scan.Main.Field(Types + "RefStructWithRefField.RefReadonlyField").Bag("csharp.readonlyRef"));
    }

    [Fact]
    public void TopLevelStatementsYieldAGeneratedProgram()
    {
        var program = scan.Main.Type("Program");
        Assert.Equal(Origin.Generated, program.Origin);
        Assert.Equal(TypeKind.Class, program.TypeKind);
        var main = scan.Main.Method("Program#<Main>$(string[])");
        Assert.Equal(Origin.Generated, main.Origin);
        Assert.Contains(Modifier.Static, main.Modifiers);
        Assert.Single(main.Locations);
        Assert.DoesNotContain(scan.Main.Nodes, node => node.Name == "LocalFunctionInTopLevelStatements");
        var invokes = scan.Main.Invokes(main.Id.Value).ToList();
        Expect.One(invokes, edge => edge.To.Value == "M:System.Console#WriteLine(string)" && edge.Receiver == ExpressionKind.Type, "Console.WriteLine call");
        Expect.One(invokes, edge => edge.To.Value == "M:CSharpSyntax.Invocations.InvocationForms#.ctor()" && edge.Receiver is null, "InvocationForms creation");
        Expect.One(invokes, edge => edge.To.Value == "M:CSharpSyntax.Invocations.InvocationForms#AllInvocationForms()" && edge.Receiver == ExpressionKind.Local, "AllInvocationForms call");
        Expect.One(invokes, edge => edge.To.Value == "M:CSharpSyntax.LocalVariables.LocalVariableForms#AsyncLocalVariableFormsAsync()", "awaited call");
        Assert.All(invokes, edge => Assert.False(edge.Site.ViaClosure));
    }

    [Fact]
    public void AttributesOnTypesAreAnnotations()
    {
        var type = scan.Main.Type(Types + "ClassWithAttributes");
        Assert.Equal(4, type.Annotations.Count);

        var obsolete = type.Annotations[0];
        Assert.Equal("System.ObsoleteAttribute", obsolete.Type.Canonical);
        var message = Assert.Single(obsolete.Arguments);
        Assert.Equal("message", message.Name);
        Assert.True(message.Positional);
        Assert.Equal("\"Attributed\"", Assert.IsType<LiteralAnnotationValue>(message.Value).Text);

        var custom = type.Annotations[1];
        Assert.Equal("CSharpSyntax.Types.CustomAttributeWithUsage", custom.Type.Canonical);
        Assert.Equal(["positionalArgument", "NamedArgument"], custom.Arguments.Select(argument => argument.Name));
        Assert.Equal([true, false], custom.Arguments.Select(argument => argument.Positional));
        Assert.Equal("1", Assert.IsType<LiteralAnnotationValue>(custom.Arguments[1].Value).Text);
        Assert.Equal("CSharpSyntax.Types.GenericAttribute`1[int]", type.Annotations[3].Type.Canonical);

        var usage = Assert.Single(scan.Main.Type(Types + "CustomAttributeWithUsage").Annotations);
        Assert.Equal("System.AttributeUsageAttribute", usage.Type.Canonical);
        Assert.Equal(["validOn", "AllowMultiple", "Inherited"], usage.Arguments.Select(argument => argument.Name));
        Assert.Equal("All", Assert.IsType<EnumAnnotationValue>(usage.Arguments[0].Value).Member);
        Assert.Equal("true", Assert.IsType<LiteralAnnotationValue>(usage.Arguments[1].Value).Text);
    }
}
