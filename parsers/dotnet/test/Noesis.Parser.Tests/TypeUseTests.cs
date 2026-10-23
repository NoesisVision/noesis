using Noesis.Parser.Model;
using Noesis.Parser.Tests.Infrastructure;

namespace Noesis.Parser.Tests;

public class TypeUseTests(ParsedFixture parsed)
{
    private const string Own = "M:CSharpSyntax.TypeUsage.OwnProjectTypeUsage#BodyLevelUse(object)";
    private const string NuGet = "M:CSharpSyntax.TypeUsage.NuGetPackageTypeUsage#BodyLevelUse(object)";
    private const string PublicClass = "CSharpSyntax.Types.PublicClass";

    [Fact]
    public void CreationsCastsAndTypeTestsAreTheOnlyBodyLevelTypeUses()
    {
        var uses = parsed.Main.UsesTypes(Own).ToList();
        var invokes = parsed.Main.Invokes(Own).ToList();
        Expect.One(invokes, edge => edge.To.Value.StartsWith("M:" + PublicClass + "#.ctor(", StringComparison.Ordinal), "target-typed new");
        Expect.One(invokes, edge => edge.To.Value.StartsWith("M:CSharpSyntax.Types.PlainStruct#.ctor(", StringComparison.Ordinal), "struct creation");
        Expect.One(uses, edge => edge.Role == TypeUseRole.Creation && edge.To.Canonical == PublicClass + "[]", "array creation");
        Expect.One(invokes, edge => edge.To.Value.StartsWith("M:CSharpSyntax.Types.ClassDerivedFromException#.ctor(", StringComparison.Ordinal), "exception creation");
        Expect.One(uses, edge => edge.Role == TypeUseRole.Cast && edge.To.Canonical == PublicClass, "(PublicClass)boxed");
        Expect.One(uses, edge => edge.Role == TypeUseRole.Cast && edge.To.Canonical == PublicClass + "?", "boxed as PublicClass");
        Assert.Equal(2, uses.Count(edge => edge.Role == TypeUseRole.TypeTest && edge.To.Canonical == PublicClass));
        Expect.One(uses, edge => edge.Role == TypeUseRole.TypeTest && edge.To.Canonical == "CSharpSyntax.Types.PositionalRecord", "recursive pattern");
        Expect.One(uses, edge => edge.Role == TypeUseRole.TypeTest && edge.To.Canonical == "CSharpSyntax.Types.PlainStruct", "switch type pattern");
        Assert.Equal(2, invokes.Count(edge => edge.To.Value.StartsWith("M:CSharpSyntax.LocalVariables.DisposableForLocals#.ctor(", StringComparison.Ordinal)));
        Assert.Equal([PublicClass + "[]"], uses.Where(edge => edge.Role == TypeUseRole.Creation).Select(edge => edge.To.Canonical));
        Assert.DoesNotContain(uses, edge => edge.To.Canonical == "System.Collections.Generic.List`1[CSharpSyntax.Types.PositionalRecord]");
        Assert.DoesNotContain(uses, edge => edge.To.Canonical == "CSharpSyntax.Types.PlainEnum");
        Assert.All(uses, edge => Assert.False(edge.Site.ViaClosure));
        Assert.All(uses, edge => Assert.Equal("parsers/dotnet/test/fixtures/CSharpSyntax/TypeUsage/OwnProjectTypeUsage.cs", edge.Site.Location.File));
    }

    [Fact]
    public void OtherBodyFactsOfTheOwnProjectUsage()
    {
        var invokes = parsed.Main.Invokes(Own).ToList();
        Expect.One(invokes, edge => edge.To.Value == "M:CSharpSyntax.Types.ClassDerivedFromException#.ctor()", "exception constructor");
        Expect.One(invokes, edge => edge.To.Value == "M:System.Object#Equals(object)" || edge.To.Value == "P:System.Exception.Message" || edge.To.Value == "M:CSharpSyntax.Types.PublicClass#.ctor()", "some call");
        Assert.DoesNotContain(invokes, edge => edge.To.Value.Contains("LocalFunction"));
        Assert.DoesNotContain(invokes, edge => edge.To.Value.Contains("<Clone>$"));
        Assert.DoesNotContain(invokes, edge => edge.To.Value.Contains("Dispose"));
        var accesses = parsed.Main.Accesses(Own).ToList();
        Expect.One(accesses, edge => edge.To.Value == "P:CSharpSyntax.Types.PositionalRecord.First" && edge.Access == AccessKind.Write && edge.Receiver == ExpressionKind.Other, "with-expression initializer");
        Expect.One(accesses, edge => edge.To.Value == "P:CSharpSyntax.Types.PositionalRecord.First" && edge.Access == AccessKind.Read && edge.Receiver == ExpressionKind.Other, "property pattern");
        Expect.One(accesses, edge => edge.To.Value == "P:CSharpSyntax.TypeUsage.OwnProjectTypeUsage.CustomDelegateEvent" && edge.Access == AccessKind.ReadWrite && edge.Site.Bag("csharp.eventAccessor") is "add" && edge.Receiver == ExpressionKind.This, "event add");
        Expect.One(accesses, edge => edge.To.Value == "P:CSharpSyntax.TypeUsage.OwnProjectTypeUsage.EventWithCustomArgs" && edge.Access == AccessKind.Read, "event read before invoke");
        Expect.One(accesses, edge => edge.To.Value == "F:CSharpSyntax.TypeUsage.OwnProjectTypeUsage.RecordField" && edge.Access == AccessKind.Read, "record field read");
        Expect.One(accesses, edge => edge.To.Value == "P:System.Exception.Message" && edge.Receiver == ExpressionKind.Local, "exception filter property");
    }

    [Fact]
    public void NuGetTypesAreUsedLikeOwnTypesAndStubbed()
    {
        var uses = parsed.Main.UsesTypes(NuGet).ToList();
        Expect.One(uses, edge => edge.Role == TypeUseRole.Creation && edge.To.Canonical == "NodaTime.Instant[]", "Instant array creation");
        Expect.One(uses, edge => edge.Role == TypeUseRole.Cast && edge.To.Canonical == "NodaTime.Instant", "(Instant)boxed");
        Expect.One(uses, edge => edge.Role == TypeUseRole.Cast && edge.To.Canonical == "NodaTime.DateTimeZone?", "as DateTimeZone");
        Assert.Equal(2, uses.Count(edge => edge.Role == TypeUseRole.TypeTest && edge.To.Canonical == "NodaTime.Instant"));
        Expect.One(uses, edge => edge.Role == TypeUseRole.TypeTest && edge.To.Canonical == "NodaTime.LocalDate" && edge.Site.Location.StartLine == 136, "LocalDate recursive pattern");
        Assert.Equal(["NodaTime.Instant[]"], uses.Where(edge => edge.Role == TypeUseRole.Creation).Select(edge => edge.To.Canonical));
        Assert.DoesNotContain(uses, edge => edge.To.Canonical.Contains("UnparsableValueException"));

        var invokes = parsed.Main.Invokes(NuGet).ToList();
        Expect.One(invokes, edge => edge.To.Value == "M:NodaTime.Instant#FromUtc(int,int,int,int,int)" && edge.Receiver == ExpressionKind.Type, "static factory on a struct");
        Expect.One(invokes, edge => edge.To.Value == "M:NodaTime.LocalDate#.ctor(int,int,int)" && edge.Receiver is null, "struct constructor");
        Expect.One(invokes, edge => edge.To.Value.StartsWith("M:NodaTime.TimeZones.DateTimeZoneNotFoundException#.ctor(", StringComparison.Ordinal), "exception constructor");
        Expect.One(invokes, edge => edge.To.Value == "M:NodaTime.IClock#GetCurrentInstant()" && edge.Receiver == ExpressionKind.Field, "interface method");
        Expect.One(invokes, edge => edge.To.Value == "M:NodaTime.Instant#FromUnixTimeSeconds(long)" && edge.Receiver == ExpressionKind.Type, "static method with a long parameter");
        Expect.One(invokes, edge => edge.To.Value == "M:NodaTime.Instant#InZone(NodaTime.DateTimeZone)" && edge.Receiver == ExpressionKind.Local, "instance method");
        Expect.One(invokes, edge => edge.To.Value == "M:NodaTime.Text.LocalDatePattern#Parse(string)" && edge.Receiver == ExpressionKind.Property, "pattern parse");
        Expect.One(invokes, edge => edge.To.Value == "M:NodaTime.Instant#Max(NodaTime.Instant,NodaTime.Instant)" && edge.Receiver == ExpressionKind.Type, "Instant.Max");
        Expect.One(invokes, edge => edge.To.Value == "M:NodaTime.Period#FromDays(int)" && edge.Receiver == ExpressionKind.Type, "Period.FromDays");
        Expect.One(invokes, edge => edge.To.Value == "M:NodaTime.TimeZones.DateTimeZoneNotFoundException#.ctor(string)", "exception constructor");
        Expect.One(invokes, edge => edge.To.Value == "M:CSharpSyntax.TypeUsage.ExtensionsOnNuGetTypes#ClassicExtensionOnNuGetType(NodaTime.Instant)" && edge.InvocationKind == InvocationKind.Extension && edge.Receiver == ExpressionKind.Local, "own extension on a NuGet struct");
        Expect.One(invokes, edge => edge.To.Value == "M:NodaTime.Instant#ToDateTimeOffset()", "conversion to a framework type");
        Assert.DoesNotContain(invokes, edge => edge.To.Value.Contains("#op_"));
        Assert.DoesNotContain(invokes, edge => edge.To.Value.Contains("Deconstruct"));

        var accesses = parsed.Main.Accesses(NuGet).ToList();
        Expect.One(accesses, edge => edge.To.Value == "P:NodaTime.ZonedDateTime.Date" && edge.Receiver == ExpressionKind.Local, "property of a NuGet struct");
        Expect.One(accesses, edge => edge.To.Value == "P:NodaTime.Period.Zero" && edge.Receiver == ExpressionKind.Type, "static property");
        Expect.One(accesses, edge => edge.To.Value == "P:NodaTime.Period.Days" && edge.Receiver == ExpressionKind.Property, "property on a static property");
        Expect.One(accesses, edge => edge.To.Value == "P:NodaTime.IDateTimeZoneProvider.this[string]" && edge.Receiver == ExpressionKind.Field && edge.Access == AccessKind.Read, "indexer of a NuGet interface");
        Expect.One(accesses, edge => edge.To.Value == "P:NodaTime.Text.LocalDatePattern.Iso" && edge.Receiver == ExpressionKind.Type, "static pattern property");
        Expect.One(accesses, edge => edge.To.Value == "P:NodaTime.ZonedDateTime.DayOfWeek" && edge.Site.ViaClosure, "property inside the typed lambda");
        Expect.One(accesses, edge => edge.To.Value == "P:NodaTime.LocalDate.Year" && edge.Access == AccessKind.Read, "Year in the pattern or the condition");
    }

    [Fact]
    public void StubsCoverEveryReachedExternalSymbolWithContainersAndBases()
    {
        var instant = parsed.Main.Stub("T:NodaTime.Instant");
        Assert.Equal((StubKind.Type, "Instant", TypeKind.Struct, "A:NodaTime@3.3.2.0"), (instant.Kind, instant.Name, instant.TypeKind, instant.Artifact!.Value.Value));
        var ns = parsed.Main.Stub("N:NodaTime");
        Assert.Equal((StubKind.Namespace, "NodaTime", (TypeKind?)null, "A:NodaTime@3.3.2.0"), (ns.Kind, ns.Name, ns.TypeKind, ns.Artifact!.Value.Value));
        parsed.Main.Stub("N:NodaTime.Text");
        Assert.Equal(TypeKind.Interface, parsed.Main.Stub("T:NodaTime.Text.IPattern`1").TypeKind);
        Assert.Equal(TypeKind.Class, parsed.Main.Stub("T:NodaTime.DateTimeZone").TypeKind);
        Assert.Equal(TypeKind.Enum, parsed.Main.Stub("T:NodaTime.IsoDayOfWeek").TypeKind);
        var method = parsed.Main.Stub("M:NodaTime.IClock#GetCurrentInstant()");
        Assert.Equal((StubKind.Method, "GetCurrentInstant", (TypeKind?)null), (method.Kind, method.Name, method.TypeKind));
        Assert.Equal(StubKind.Property, parsed.Main.Stub("P:NodaTime.Period.Zero").Kind);
        Assert.Equal("this[]", parsed.Main.Stub("P:NodaTime.IDateTimeZoneProvider.this[string]").Name);
        Assert.Equal(StubKind.Field, parsed.Main.Stub("F:NodaTime.IsoDayOfWeek.Monday").Kind);
        Assert.Contains(parsed.Main.ImplementsOf("T:NodaTime.DateTimeZone"), canonical => canonical == "NodaTime.TimeZones.IZoneIntervalMap");
        Assert.Single(parsed.Main.ExtendsOf("T:NodaTime.TimeZones.DateTimeZoneNotFoundException"));
        Assert.True(parsed.Main.HasStub("T:System.Exception"));
        Assert.Empty(parsed.Main.ExtendsOf("T:System.Exception"));
        Assert.Contains(parsed.Main.ImplementsOf("T:NodaTime.Instant"), canonical => canonical == "System.IEquatable`1[NodaTime.Instant]");
        Assert.DoesNotContain(parsed.Main.Stubs, stub => stub.Id.Value.StartsWith("T:CSharpSyntax.", StringComparison.Ordinal));
        Assert.DoesNotContain(parsed.Main.Stubs, stub => stub.Artifact is null);
        Assert.All(parsed.Main.Stubs, stub => Assert.Contains(parsed.Main.Artifact.Dependencies, dependency => dependency.Id == stub.Artifact!.Value));
        Assert.Equal(parsed.Main.Stubs.Select(stub => stub.Id).Order(), parsed.Main.Stubs.Select(stub => stub.Id));
        Assert.DoesNotContain(parsed.Main.Stubs, stub => stub.Id.Value.StartsWith("M:NodaTime.DateTimeZone#", StringComparison.Ordinal) && stub.Name == "MinOffset");
    }

    [Fact]
    public void NuGetMembersInSignaturesAndEdgesPointAtStubs()
    {
        const string Type = "CSharpSyntax.TypeUsage.NuGetPackageTypeUsage";
        Assert.Equal(["NodaTime.DateTimeZone"], parsed.Main.ExtendsOf("T:" + Type));
        Assert.Equal(["NodaTime.IClock", "NodaTime.Text.IPattern`1[NodaTime.LocalDate]", "System.Collections.Generic.IComparer`1[NodaTime.ZonedDateTime]"], parsed.Main.ImplementsOf("T:" + Type).Order());
        Expect.One(parsed.Main.Invokes("M:" + Type + "#.ctor(NodaTime.IClock,NodaTime.Instant)"), edge => edge.To.Value == "M:NodaTime.DateTimeZone#.ctor(string,bool,NodaTime.Offset,NodaTime.Offset)" && edge.Receiver == ExpressionKind.Base, "NuGet base constructor from the primary constructor");
        Expect.One(parsed.Main.Accesses("M:" + Type + "#.ctor(NodaTime.IClock,NodaTime.Instant)"), edge => edge.To.Value == "F:NodaTime.Offset.Zero" || edge.To.Value == "P:NodaTime.Offset.Zero", "Offset.Zero argument");
        var parse = Assert.Single(parsed.Main.ImplementsMembersOf("M:" + Type + "#Parse(string)"));
        Assert.Equal("M:NodaTime.Text.IPattern`1#Parse(string)", parse.To.Value);
        Assert.Equal("NodaTime.Text.IPattern`1[NodaTime.LocalDate]", parse.Interface.Canonical);
        Assert.Equal(["M:NodaTime.DateTimeZone#GetZoneInterval(NodaTime.Instant)"], parsed.Main.OverridesOf("M:" + Type + "#GetZoneInterval(NodaTime.Instant)"));
        Assert.Equal("M:NodaTime.IClock#GetCurrentInstant()", Assert.Single(parsed.Main.ImplementsMembersOf("M:" + Type + "#GetCurrentInstant()")).To.Value);
        Assert.Equal("NodaTime.Text.IPattern`1[NodaTime.LocalDate]", Assert.IsType<TypeConstraint>(Assert.Single(parsed.Main.Method(Type + "#ConstrainedToGenericInterface`1(!!0)").TypeParameters[0].Constraints)).Type.Canonical);
        Assert.Equal("IsoDayOfWeek.Monday", parsed.Main.Field(Type + ".ConstEnumField").ConstantValue);
        Assert.Equal("IsoDayOfWeek.Sunday", Assert.Single(parsed.Main.Method(Type + "#OptionalEnumParameter(NodaTime.IsoDayOfWeek)").Signature.Parameters).DefaultValue);
        Expect.TypeRef("NodaTime.Offset", parsed.Main.Field(Type + ".FullyQualifiedField").Type);
        Expect.TypeRef("System.Func`2[NodaTime.Instant,NodaTime.LocalDate]", parsed.Main.Field(Type + ".FrameworkDelegateOfNuGetTypesField").Type);
        var usedImplicitly = parsed.Main.AnnotationsOf("T:" + Type).ToList();
        Assert.Contains(usedImplicitly, annotation => annotation.Type.Canonical == "JetBrains.Annotations.UsedImplicitlyAttribute");
        var baseTypeRequired = Assert.Single(usedImplicitly, annotation => annotation.Type.Canonical == "JetBrains.Annotations.BaseTypeRequiredAttribute");
        Assert.Equal("NodaTime.IClock", Assert.IsType<TypeAnnotationValue>(Assert.Single(baseTypeRequired.Arguments).Value).Type.Canonical);
        Assert.Equal("A:JetBrains.Annotations@4242.42.42.42", parsed.Main.Stub("T:JetBrains.Annotations.UsedImplicitlyAttribute").Artifact!.Value.Value);
        Assert.Equal(["System.Attribute"], parsed.Main.ExtendsOf("T:JetBrains.Annotations.UsedImplicitlyAttribute"));
        var valueRange = Assert.Single(parsed.Main.Method(Type + "#AttributedParameter(NodaTime.DateTimeZone,int,System.Collections.Generic.IEnumerable`1[NodaTime.Instant])").Parameter("dayNumber").Annotations);
        Assert.Equal("JetBrains.Annotations.ValueRangeAttribute", valueRange.Type.Canonical);
        Assert.Equal(["from", "to"], valueRange.Arguments.Select(argument => argument.Name));
        Assert.Equal("1", Assert.IsType<LiteralAnnotationValue>(valueRange.Arguments[0].Value).Text);
    }

    [Fact]
    public void OtherProjectTypesAreNeverStubbedAndAliasesLeaveNoTrace()
    {
        const string Type = "CSharpSyntax.TypeUsage.OtherProjectTypeUsage";
        const string Other = "CSharpSyntax.OtherProject.PublicClassFromOtherProject";
        Expect.TypeRef(Other, parsed.Main.Field(Type + ".ClassField").Type);
        Expect.TypeRef(Other, parsed.Main.Field(Type + ".ExternAliasField").Type);
        Expect.TypeRef(Other, parsed.Main.Field(Type + ".FullyQualifiedField").Type);
        Expect.TypeRef("CSharpSyntax.OtherProject.InternalClassVisibleViaInternalsVisibleTo", parsed.Main.Field(Type + ".InternalTypeField").Type);
        Expect.TypeRef("CSharpSyntax.OtherProject.PublicClassFromOtherProject+NestedClassFromOtherProject", parsed.Main.Field(Type + ".NestedTypeField").Type);
        Assert.DoesNotContain(parsed.Main.Stubs, stub => stub.Id.Value.Contains("CSharpSyntax.OtherProject"));
        Assert.Equal("StaticClassFromOtherProject.ConstantFromOtherProject + 1", parsed.Main.Field(Type + ".ConstFromOtherProjectConst").ConstantValue);
        Assert.Equal("EnumFromOtherProject.SecondFromOtherProject", Assert.Single(parsed.Main.Method(Type + "#OptionalEnumParameter(CSharpSyntax.OtherProject.EnumFromOtherProject)").Signature.Parameters).DefaultValue);
        var attribute = Assert.Single(parsed.Main.Type(Type).Annotations);
        Assert.Equal("CSharpSyntax.OtherProject.AttributeFromOtherProject", attribute.Type.Canonical);
        Assert.Equal(Other, Assert.IsType<TypeAnnotationValue>(attribute.Arguments[0].Value).Type.Canonical);
        var named = Assert.IsType<EnumAnnotationValue>(attribute.Arguments[1].Value);
        Assert.Equal(("CSharpSyntax.OtherProject.EnumFromOtherProject", "SecondFromOtherProject", "NamedEnumArgument"), (named.Type.Canonical, named.Member, attribute.Arguments[1].Name));
        Expect.One(parsed.Main.Invokes("M:CSharpSyntax.TypeUsage.RecordWithOtherProjectTypeMembers#.ctor(" + Other + ",CSharpSyntax.OtherProject.StructFromOtherProject,CSharpSyntax.OtherProject.EnumFromOtherProject)"), edge => edge.To.Value == "M:CSharpSyntax.OtherProject.RecordFromOtherProject#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "base record constructor from the other project");
        var body = "M:" + Type + "#BodyLevelUse(object)";
        Expect.One(parsed.Main.Accesses(body), edge => edge.To.Value == "P:" + Other + ".PublicPropertyFromOtherProject" && edge.Receiver == ExpressionKind.Local, "property of the other project");
        Expect.One(parsed.Main.Invokes(body), edge => edge.To.Value == "M:" + Other + "#PublicMethodFromOtherProject()", "method of the other project");
        Expect.One(parsed.Main.Accesses(body), edge => edge.To.Value == "F:CSharpSyntax.OtherProject.StructFromOtherProject.ValueFromOtherProject" && edge.Receiver == ExpressionKind.Field, "field of a struct field");
        Expect.One(parsed.Main.Invokes(body), edge => edge.To.Value == "M:CSharpSyntax.OtherProject.RecordFromOtherProject#Deconstruct(int)" && edge.Receiver == ExpressionKind.Field, "explicit Deconstruct call");
        Expect.One(parsed.Main.UsesTypes(body), edge => edge.Role == TypeUseRole.TypeTest && edge.To.Canonical == "CSharpSyntax.OtherProject.RecordFromOtherProject", "pattern on an other-project record");
        Assert.Equal(["M:CSharpSyntax.OtherProject.AbstractBaseClassFromOtherProject#AbstractMethodFromOtherProject()"], parsed.Main.OverridesOf("M:" + Type + "#AbstractMethodFromOtherProject()"));
    }

    [Fact]
    public void ProjectReferenceModelsDeclareWhatTheOtherArtifactReferences()
    {
        Assert.True(parsed.Other.Has("T:CSharpSyntax.OtherProject.PublicClassFromOtherProject"));
        Assert.True(parsed.Other.Has("M:CSharpSyntax.OtherProject.PublicClassFromOtherProject#PublicMethodFromOtherProject()"));
        Assert.True(parsed.Other.Has("M:CSharpSyntax.OtherProject.RecordFromOtherProject#Deconstruct(int)"));
        Assert.True(parsed.Other.Has("F:CSharpSyntax.OtherProject.StaticClassFromOtherProject.ConstantFromOtherProject"));
        Assert.Equal("42", parsed.Other.Field("CSharpSyntax.OtherProject.StaticClassFromOtherProject.ConstantFromOtherProject").ConstantValue);
        Assert.Equal(Visibility.Artifact, parsed.Other.Type("CSharpSyntax.OtherProject.InternalClassVisibleViaInternalsVisibleTo").Visibility);
        Expect.TypeRef("int", parsed.Other.Property("CSharpSyntax.OtherProject.StaticClassFromOtherProject.ExtensionMemberPropertyFromOtherProject").ExtensionReceiver!);
        Assert.Equal(["System.Exception"], parsed.Other.ExtendsOf("T:CSharpSyntax.OtherProject.ExceptionFromOtherProject"));
        Assert.True(parsed.Other.HasStub("T:System.Exception"));
    }
}
