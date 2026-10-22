package vision.noesis.scanner.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static vision.noesis.scanner.core.Models.SYNTAX;
import static vision.noesis.scanner.core.Models.access;
import static vision.noesis.scanner.core.Models.count;
import static vision.noesis.scanner.core.Models.one;
import static vision.noesis.scanner.core.Models.to;
import static vision.noesis.scanner.model.AccessKind.READ;
import static vision.noesis.scanner.model.AccessKind.READ_WRITE;
import static vision.noesis.scanner.model.AccessKind.WRITE;
import static vision.noesis.scanner.model.ExpressionKind.FIELD;
import static vision.noesis.scanner.model.ExpressionKind.LOCAL;
import static vision.noesis.scanner.model.ExpressionKind.PARAMETER;
import static vision.noesis.scanner.model.ExpressionKind.RETURN_VALUE;
import static vision.noesis.scanner.model.ExpressionKind.THIS;
import static vision.noesis.scanner.model.ExpressionKind.TYPE;

import java.util.List;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.Edge;
import vision.noesis.scanner.model.TypeRef;
import vision.noesis.scanner.model.TypeUseRole;

/** Field accesses and body-level type uses: what each engine reads, writes, casts, tests and creates. */
class BodyFactsTest {

    private static final String FORMS = SYNTAX + "invocations.InvocationForms";
    private static final String LOCALS = SYNTAX + "localvariables.LocalVariableForms";
    private static final String ACCESSES = "M:" + FORMS + "#accesses(" + FORMS + ")";
    private static final String ALL_LOCALS = "M:" + LOCALS + "#allLocalVariableForms()";
    private static final String FIELD_ID = "F:" + FORMS + ".field";

    private static Predicate<Edge.UsesType> use(TypeUseRole role, String canonical) {
        return edge -> edge.role() == role && edge.to().canonical().equals(canonical);
    }

    @Test
    void fieldAccessesAreClassifiedBySpelling() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        List<Edge.Accesses> accesses = Models.accesses(model, ACCESSES);
        assertEquals(2, count(accesses, access(FIELD_ID, WRITE).and(edge -> edge.receiver() == THIS)));
        assertEquals(3, count(accesses, access(FIELD_ID, READ_WRITE).and(edge -> edge.receiver() == THIS)));
        one(accesses, access(FIELD_ID, READ).and(edge -> edge.receiver() == THIS), "field read");
        one(accesses, access(FIELD_ID, READ).and(edge -> edge.receiver() == PARAMETER), "other.field");
        one(accesses, access("F:" + FORMS + ".held", READ).and(edge -> edge.receiver() == PARAMETER), "other.held");
        assertEquals(2, count(accesses, access("F:" + FORMS + ".staticField", WRITE).and(edge -> edge.receiver() == TYPE)));
        one(accesses, access("F:" + FORMS + ".staticField", READ).and(edge -> edge.receiver() == TYPE), "staticField read");
        one(accesses, access("F:" + SYNTAX + "inheritance.ClassInheritance+Base.baseField", WRITE).and(edge -> edge.receiver() == THIS), "inherited field write");
        one(accesses, access("F:" + FORMS + ".numbers", READ), "numbers.length reads the array field only");
        List<Edge.Invokes> calls = Models.invokes(model, ACCESSES);
        one(calls, to("M:" + SYNTAX + "inheritance.ClassInheritance+Base#overridable()", FIELD), "other.held.overridable()");
        one(calls, to("M:java.lang.String#length()", FIELD), "LABEL.length()");
        assertTrue(accesses.stream().noneMatch(edge -> edge.to().value().contains("LABEL")), "a constant is inlined, not read");
    }

    @Test
    void compoundAssignmentsAndIncrementsAreTwoAccessesInBytecode() {
        List<Edge.Accesses> accesses = Models.accesses(Models.syntax(EngineKind.BYTECODE), ACCESSES);
        assertEquals(5, count(accesses, access(FIELD_ID, READ)));
        assertEquals(5, count(accesses, access(FIELD_ID, WRITE)));
        assertEquals(0, count(accesses, access(FIELD_ID, READ_WRITE)));
        assertEquals(2, count(accesses, access("F:" + FORMS + ".staticField", WRITE)));
        one(accesses, access("F:" + FORMS + ".staticField", READ), "staticField read");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void accessedFieldsAgreeAcrossEngines(EngineKind engine) {
        List<String> targets = Models.accesses(Models.syntax(engine), ACCESSES).stream().map(edge -> edge.to().value()).distinct().sorted().collect(Collectors.toList());
        assertEquals(List.of("F:java.lang.System.out", "F:" + SYNTAX + "inheritance.ClassInheritance+Base.baseField", "F:" + FORMS + ".field", "F:" + FORMS + ".held",
                "F:" + FORMS + ".numbers", "F:" + FORMS + ".staticField"), targets);
    }

    @Test
    void enumCaseLabelsReadTheConstantInSourceOnly() {
        String switches = "M:" + FORMS + "#switches(" + SYNTAX + "types.EnumKinds+PlainEnum,java.lang.String)";
        List<Edge.Accesses> source = Models.accesses(Models.syntax(EngineKind.SOURCE), switches);
        assertEquals(2, source.size());
        one(source, access("F:" + SYNTAX + "types.EnumKinds+PlainEnum.FIRST", READ).and(edge -> edge.receiver() == TYPE), "case FIRST");
        one(source, access("F:" + SYNTAX + "types.EnumKinds+PlainEnum.SECOND", READ).and(edge -> edge.receiver() == TYPE), "case SECOND");
        assertTrue(Models.accesses(Models.syntax(EngineKind.BYTECODE), switches).isEmpty());
        assertTrue(Models.invokes(Models.syntax(EngineKind.SOURCE), switches).isEmpty());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void localVariableFormsReadTheFieldsTheyIndexLockAndIterate(EngineKind engine) {
        List<Edge.Accesses> accesses = Models.accesses(Models.syntax(engine), ALL_LOCALS);
        assertEquals(10, count(accesses, access("F:" + LOCALS + ".array", READ)));
        one(accesses, access("F:" + LOCALS + ".lock", READ), "synchronized (lock)");
        assertEquals(2, count(accesses, access("F:" + SYNTAX + "localvariables.ClassWithFieldsForLocals.first", READ)));
        one(accesses, access("F:" + SYNTAX + "localvariables.NestedClassForInitializer.first", WRITE), "getNested().first = 1");
        one(accesses, access("F:" + LOCALS + "+2.count", READ), "anonymousObject.count");
        one(accesses, access("F:java.nio.charset.StandardCharsets.UTF_8", READ).and(edge -> edge.receiver() == TYPE), "static-imported field");
        one(accesses, access("F:java.lang.System.out", READ).and(edge -> edge.site().viaClosure()), "System.out inside the lambda");
        one(accesses, access("F:" + SYNTAX + "types.EnumKinds+PlainEnum.FIRST", READ).and(edge -> edge.site().location().startLine() == 41), "enum constant initializer");
    }

    @Test
    void localVariableFormsReceiversAndReadWritesInSource() {
        List<Edge.Accesses> accesses = Models.accesses(Models.syntax(EngineKind.SOURCE), ALL_LOCALS);
        assertEquals(3, count(accesses, access("F:" + LOCALS + ".field", READ_WRITE).and(edge -> edge.receiver() == THIS)));
        assertTrue(accesses.stream().filter(access("F:" + LOCALS + ".array", READ)).allMatch(edge -> edge.receiver() == THIS));
        one(accesses, access("F:" + SYNTAX + "localvariables.NestedClassForInitializer.first", WRITE).and(edge -> edge.receiver() == RETURN_VALUE), "write through a call result");
        one(accesses, access("F:" + LOCALS + "+2.count", READ).and(edge -> edge.receiver() == LOCAL), "anonymous object member");
        assertEquals(2, count(accesses, access("F:" + SYNTAX + "localvariables.ClassWithFieldsForLocals.first", READ).and(edge -> edge.receiver() == LOCAL)));
        assertEquals(2, count(accesses, edge -> edge.to().value().equals("F:" + SYNTAX + "types.EnumKinds+PlainEnum.FIRST")));
        one(accesses, access("F:" + SYNTAX + "types.EnumKinds+PlainEnum.SECOND", READ), "switch expression case label");
    }

    @Test
    void finallyBodiesAreCompiledOncePerExitPathInBytecode() {
        List<Edge.Accesses> accesses = Models.accesses(Models.syntax(EngineKind.BYTECODE), ALL_LOCALS);
        assertEquals(3, count(accesses, access("F:" + LOCALS + ".field", READ).and(edge -> edge.site().location().startLine() == 180)));
        assertEquals(3, count(accesses, access("F:" + LOCALS + ".field", WRITE).and(edge -> edge.site().location().startLine() == 180)));
        assertEquals(5, count(accesses, access("F:" + LOCALS + ".field", READ)));
        assertEquals(5, count(accesses, access("F:" + LOCALS + ".field", WRITE)));
        assertEquals(0, count(accesses, edge -> edge.to().value().equals("F:" + SYNTAX + "types.EnumKinds+PlainEnum.SECOND")));
    }

    @Test
    void castsAreTypeUsesInSource() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        one(Models.usesTypes(model, ALL_LOCALS), use(TypeUseRole.CAST, "int"), "(int) 3.5");
        one(Models.usesTypes(model, "M:" + FORMS + "#argumentForms()"), use(TypeUseRole.CAST, "int"), "(int) 1.5");
        List<Edge.UsesType> receivers = Models.usesTypes(model, "M:" + FORMS + "#instanceReceivers(java.lang.Object)");
        one(receivers, use(TypeUseRole.CAST, SYNTAX + "invocations.InvocationTarget"), "(InvocationTarget) objectReference");
        one(receivers, use(TypeUseRole.CAST, SYNTAX + "types.InterfaceKinds+PlainInterface"), "(PlainInterface) new InvocationTargets()");
        one(Models.usesTypes(model, "M:" + FORMS + "#functionalInterfaceInvocations()"), use(TypeUseRole.CAST, "java.util.function.Supplier`1[java.lang.Integer]"), "cast lambda");
        List<Edge.UsesType> lambdas = Models.usesTypes(model, "M:" + SYNTAX + "members.LocalFunctionsAndLambdas#methodWithLambdas()");
        assertEquals(3, count(lambdas, use(TypeUseRole.CAST, "java.lang.Runnable")));
        Edge.UsesType intersection = one(lambdas, use(TypeUseRole.CAST, "java.lang.Runnable&java.io.Serializable"), "intersection cast");
        assertTrue(intersection.to() instanceof TypeRef.Intersection);
        assertEquals(4, lambdas.size());
        one(Models.usesTypes(model, "M:" + FORMS + "#typeUses(java.lang.Object)"), use(TypeUseRole.CAST, SYNTAX + "inheritance.ClassInheritance+Base"), "(Base) value");
    }

    @Test
    void onlyArraysAreCreationTypeUsesInSource() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        assertTrue(Models.edges(model, Edge.UsesType.class).filter(edge -> edge.role() == TypeUseRole.CREATION).allMatch(edge -> edge.to() instanceof TypeRef.Array));
        List<Edge.UsesType> locals = Models.usesTypes(model, ALL_LOCALS);
        assertEquals(7, count(locals, use(TypeUseRole.CREATION, "int[]")));
        assertEquals(4, count(locals, use(TypeUseRole.CREATION, "int[][]")));
        one(locals, use(TypeUseRole.CREATION, "int[]").and(edge -> edge.site().location().startLine() == 99), "{1, 2, 3} initializer");
        one(locals, use(TypeUseRole.CREATION, "int[][]").and(edge -> edge.site().location().startLine() == 103), "new int[2][]");
        List<Edge.UsesType> typeUses = Models.usesTypes(model, "M:" + FORMS + "#typeUses(java.lang.Object)");
        one(typeUses, use(TypeUseRole.CREATION, "java.lang.String[]"), "new String[2]");
        one(typeUses, use(TypeUseRole.CREATION, "int[][]"), "new int[2][2]");
        assertEquals(5, typeUses.size());
        one(Models.usesTypes(model, "M:" + FORMS + "#arrayMembers()"), use(TypeUseRole.CREATION, "java.lang.String[]"), "new String[1]");
        one(Models.usesTypes(model, "M:" + FORMS + "#instanceReceivers(java.lang.Object)"), use(TypeUseRole.CREATION, "int[]"), "new int[]{1}");
        one(Models.usesTypes(model, "M:" + SYNTAX + "typeusage.OwnModuleTypeUsage#bodyLevelUse(java.lang.Object)"), use(TypeUseRole.CREATION, SYNTAX + "typeusage.UsedType[]"), "new UsedType[1]");
        assertTrue(Models.edges(model, Edge.UsesType.class).noneMatch(edge -> edge.site().viaClosure()));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void typeTestsAreInBothEngines(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        List<Edge.UsesType> locals = Models.usesTypes(model, ALL_LOCALS);
        assertEquals(2, count(locals, use(TypeUseRole.TYPE_TEST, "java.lang.Integer")));
        one(locals, use(TypeUseRole.TYPE_TEST, "java.lang.String"), "!(boxed instanceof String s)");
        one(locals, use(TypeUseRole.TYPE_TEST, SYNTAX + "localvariables.ClassWithFieldsForLocals"), "pattern with a condition");
        List<Edge.UsesType> typeUses = Models.usesTypes(model, "M:" + FORMS + "#typeUses(java.lang.Object)");
        one(typeUses, use(TypeUseRole.TYPE_TEST, SYNTAX + "inheritance.ClassInheritance+Base"), "value instanceof Base");
        one(typeUses, use(TypeUseRole.TYPE_TEST, SYNTAX + "inheritance.ClassInheritance+Derived"), "value instanceof Derived derived");
        for (String[] usage : new String[][] {
                {"OwnModuleTypeUsage", SYNTAX + "typeusage.UsedType", SYNTAX + "typeusage.UsedRecord", SYNTAX + "typeusage.UsedEnum"},
                {"OtherModuleTypeUsage", Models.OTHER + "OtherUsedType", Models.OTHER + "OtherRecord", Models.OTHER + "OtherEnum"},
                {"LibraryTypeUsage", "com.google.common.util.concurrent.AtomicDouble", "com.google.common.net.HostAndPort", "com.google.common.collect.BoundType"}}) {
            List<Edge.UsesType> body = Models.usesTypes(model, "M:" + SYNTAX + "typeusage." + usage[0] + "#bodyLevelUse(java.lang.Object)");
            assertEquals(2, count(body, use(TypeUseRole.TYPE_TEST, usage[1])), usage[0]);
            one(body, use(TypeUseRole.TYPE_TEST, usage[2]), usage[0] + " record pattern");
            one(body, use(TypeUseRole.TYPE_TEST, usage[3]), usage[0] + " enum test");
            assertEquals(4, count(body, edge -> edge.role() == TypeUseRole.TYPE_TEST), usage[0]);
        }
    }

    @Test
    void bytecodeHoldsOnlyTypeTests() {
        assertTrue(Models.edges(Models.syntax(EngineKind.BYTECODE), Edge.UsesType.class).allMatch(edge -> edge.role() == TypeUseRole.TYPE_TEST));
    }

    @Test
    void classLiteralsAreNoTypeUseInSourceAndReadIntegerTypeInBytecode() {
        CodeModelFile source = Models.syntax(EngineKind.SOURCE);
        assertTrue(Models.usesTypes(source, ALL_LOCALS).stream().noneMatch(edge -> edge.to().canonical().startsWith("java.lang.Class")));
        assertTrue(Models.accesses(source, ALL_LOCALS).stream().noneMatch(edge -> edge.to().value().equals("F:java.lang.Integer.TYPE")));
        assertTrue(Models.usesTypes(source, "M:" + FORMS + "#typeUses(java.lang.Object)").stream().noneMatch(edge -> edge.to().canonical().startsWith("java.lang.Class")));
        one(Models.accesses(Models.syntax(EngineKind.BYTECODE), ALL_LOCALS), access("F:java.lang.Integer.TYPE", READ).and(edge -> edge.receiver() == TYPE), "int.class");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void constantsAreInlinedAndNeverRead(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertTrue(Models.edges(model, Edge.Accesses.class).noneMatch(edge -> edge.to().value().equals("F:" + Models.OTHER + "OtherConstants.CONSTANT")));
        assertTrue(Models.edges(model, Edge.Accesses.class).noneMatch(edge -> edge.to().value().equals("F:java.lang.Math.PI")));
        assertTrue(Models.edges(model, Edge.Accesses.class).noneMatch(edge -> edge.to().value().equals("F:" + SYNTAX + "typeusage.UsedType.CONSTANT")));
        one(Models.accesses(model, "M:" + SYNTAX + "typeusage.OwnModuleTypeUsage#bodyLevelUse(java.lang.Object)"), access("F:" + SYNTAX + "typeusage.UsedType.DEFAULT", READ).and(edge -> edge.receiver() == TYPE), "a static non-constant field is read");
    }
}
