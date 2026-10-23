package vision.noesis.fixture.syntax.invocations;

import static vision.noesis.fixture.syntax.invocations.InvocationTarget.STATIC_FIELD;
import static vision.noesis.fixture.syntax.invocations.InvocationTarget.staticFactory;

import java.io.StringReader;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import vision.noesis.fixture.other.OtherClass;
import vision.noesis.fixture.other.OtherConstants;
import vision.noesis.fixture.syntax.generics.GenericTypes;
import vision.noesis.fixture.syntax.inheritance.ClassInheritance;
import vision.noesis.fixture.syntax.members.MethodDeclarations;
import vision.noesis.fixture.syntax.types.EnumKinds;
import vision.noesis.fixture.syntax.types.InterfaceKinds;
import vision.noesis.fixture.syntax.types.RecordKinds;

/** Every receiver kind, every body-level fact: calls, accesses, casts, instanceof, creations, lambdas, switches. */
public class InvocationForms extends ClassInheritance.Base {

    private static int staticField;
    private int field;
    private final ClassInheritance.Base held = new ClassInheritance.Derived();
    private int[] numbers = new int[3];

    public void receivers(ClassInheritance.Base parameter) {
        ClassInheritance.Base local = new ClassInheritance.Derived("local");
        this.overridable();
        overridable();
        super.overridable();
        parameter.overridable();
        local.overridable();
        held.overridable();
        this.held.overridable();
        ClassInheritance.Base.staticMethod();
        staticMethod();
        new ClassInheritance.Derived().overridable();
        covariant().toString();
        "literal".length();
        ((ClassInheritance.Base) local).overridable();
        (local).overridable();
    }

    public void accesses(InvocationForms other) {
        field = 1;
        this.field = 2;
        field += 1;
        field++;
        --field;
        int read = field + other.field;
        staticField = read;
        InvocationForms.staticField = staticField + 1;
        other.held.overridable();
        baseField = numbers.length;
        int constant = EnumKinds.EnumWithFieldsAndConstructor.LABEL.length();
        System.out.println(constant);
    }

    public Supplier<Integer> lambda() {
        Runnable runnable = () -> {
            field++;
            overridable();
        };
        runnable.run();
        return () -> field + staticField;
    }

    public Runnable methodReference() {
        Runnable fromInstance = this::overridable;
        Runnable fromStatic = ClassInheritance.Base::staticMethod;
        Supplier<ClassInheritance.Derived> constructor = ClassInheritance.Derived::new;
        fromInstance.run();
        fromStatic.run();
        return constructor.get()::overridable;
    }

    public Object anonymousBody() {
        return new Runnable() {
            @Override
            public void run() {
                overridable();
                field++;
            }
        };
    }

    public void typeUses(Object value) {
        if (value instanceof ClassInheritance.Base) {
            ClassInheritance.Base cast = (ClassInheritance.Base) value;
            cast.overridable();
        }
        if (value instanceof ClassInheritance.Derived derived) {
            derived.covariant();
        }
        String[] created = new String[2];
        int[][] matrix = new int[2][2];
        List<String> list = List.of("a", "b");
        Class<?> literal = ClassInheritance.Base.class;
        System.out.println(created.length + matrix.length + list.size() + literal.getName());
    }

    public String switches(EnumKinds.PlainEnum kind, String text) {
        switch (kind) {
            case FIRST:
                return "first";
            case SECOND:
                return "second";
            default:
                break;
        }
        switch (text) {
            case "a":
                return "A";
            default:
                return text;
        }
    }

    public int loopsAndResources(List<Integer> values) throws Exception {
        int total = 0;
        for (Integer value : values) {
            total += value;
        }
        try (StringReader reader = new StringReader(text(total))) {
            total += reader.read();
        }
        Integer boxed = total;
        int unboxed = boxed;
        return unboxed;
    }

    private String text(int value) {
        return Integer.toString(value);
    }

    private final InvocationTarget targetField = new InvocationTarget();
    private final InvocationTarget[] arrayField = {new InvocationTarget()};
    private final List<InvocationTarget> listField = List.of(new InvocationTarget());
    private final Map<String, InvocationTarget> mapField = Map.of("key", new InvocationTarget());
    private final Supplier<Integer> supplierField = InvocationTarget::staticMethod;
    private static final InvocationTarget STATIC_TARGET_FIELD = new InvocationTarget();
    private int counter;

    public int instanceMethodOnThisClass() {
        return 1;
    }

    public static int staticMethodOnThisClass() {
        return 1;
    }

    public int methodWithOverloads(int value) {
        return value;
    }

    public int methodWithOverloads(String value) {
        return value.length();
    }

    public int methodWithOverloads(int first, int second) {
        return first + second;
    }

    public void allInvocationForms() throws Exception {
        staticInvocations();
        instanceReceivers(new InvocationTarget());
        argumentForms();
        streamPipelines();
        functionalInterfaceInvocations();
        otherExpressionContexts();
        reflectionInvocations();
        localClassInvocations();
        constructorInvocations();
        statementContexts();
        asyncInvocations();
        expressionBodiedMemberInvokingOthers();
        arrayMembers();
        new InvocationsFromInitializers(new InvocationTarget()).fromConstructorParameter();
    }

    public void staticInvocations() {
        int viaType = InvocationTarget.staticMethod();
        int inferredGeneric = InvocationTarget.staticGenericMethod(1);
        String explicitGeneric = InvocationTarget.<String>staticGenericMethod("");
        InvocationTarget viaStaticImport = staticFactory();
        int fullyQualified = vision.noesis.fixture.syntax.invocations.InvocationTarget.staticMethod();
        int onNestedType = InvocationTarget.NestedStaticHolder.nestedStaticMethod();
        int onDoublyNestedType = InvocationTarget.NestedStaticHolder.DoublyNested.doublyNestedStaticMethod();
        int onOwnClassUnqualified = staticMethodOnThisClass();
        int onOwnClassQualified = InvocationForms.staticMethodOnThisClass();
        staticMethod();
        ClassInheritance.Base.staticMethod();
        InterfaceKinds.PlainInterface.staticMethod();
        int onGenericClass = InvocationTarget.GenericStaticClassForInvocations.staticOnGenericClass();
        int fromOtherModule = OtherConstants.staticMethodFromOtherModule();
        OtherClass otherModuleFactory = OtherClass.create();
        int fromPlatform = Math.max(1, 2);
        int onBoxedKeywordType = Integer.parseInt("1");
        String joined = String.join(",", "1", "2");
        System.out.println(viaType + inferredGeneric + explicitGeneric + viaStaticImport.instanceMethod() + fullyQualified
                + onNestedType + onDoublyNestedType + onOwnClassUnqualified + onOwnClassQualified + onGenericClass
                + fromOtherModule + otherModuleFactory.value + fromPlatform + onBoxedKeywordType + joined);
    }

    public void instanceReceivers(Object objectReference) {
        InvocationTarget local = new InvocationTarget();
        InterfaceKinds.PlainInterface interfaceReference = new InvocationTarget.InvocationDerived();
        ClassInheritance.Base baseReference = new InvocationTarget.InvocationDerived();
        Integer boxed = 1;
        int implicitThis = instanceMethodOnThisClass();
        int explicitThis = this.instanceMethodOnThisClass();
        super.overridable();
        overridable();
        finalMethod();
        protectedMethod();
        int onLocal = local.instanceMethod();
        int onField = targetField.instanceMethod();
        int onThisField = this.targetField.instanceMethod();
        int onStaticField = STATIC_TARGET_FIELD.instanceMethod();
        int onStaticFieldOfType = InvocationTarget.STATIC_FIELD.instanceMethod();
        int onStaticImportedField = STATIC_FIELD.instanceMethod();
        int onFieldOfLocal = local.fieldHoldingSelf.instanceMethod();
        int onFieldChain = local.fieldHoldingSelf.fieldHoldingSelf.instanceMethod();
        int onCreation = new InvocationTarget().instanceMethod();
        int onCreationWithArguments = new InvocationTarget(1).instanceMethod();
        new InvocationTarget.InvocationDerived("x").overridable();
        int onStaticFactory = InvocationTarget.staticFactory().instanceMethod();
        int onReturnValue = local.returnsSelf().instanceMethod();
        int chained = local.returnsSelf().returnsSelf().returnsSelf().instanceMethod();
        String onReturnedArrayElement = String.valueOf(local.returnsArray()[0]);
        int onArrayElement = arrayField[0].instanceMethod();
        int onListElement = listField.get(0).instanceMethod();
        int onMapElement = mapField.get("key").instanceMethod();
        int onCast = ((InvocationTarget) objectReference).instanceMethod();
        ((InterfaceKinds.PlainInterface) new InvocationTargets()).defaultMethod();
        interfaceReference.abstractMethod();
        interfaceReference.defaultMethod();
        baseReference.overridable();
        String onBoxedLocal = boxed.toString();
        String onLiteral = "literal".toUpperCase();
        String onEnumConstant = EnumKinds.PlainEnum.FIRST.name();
        String onClassLiteral = Integer.class.getName().toLowerCase();
        String onParenthesized = String.valueOf(1 + 2);
        int onTernary = (boxed > 0 ? local : local).instanceMethod();
        String onArrayCreation = String.valueOf(new int[]{1}.length);
        int inConcatenation = ("" + local.instanceMethod()).length();
        String onRecordAccessor = new RecordKinds.PlainRecord(1, "").name().toUpperCase();
        String onObject = objectReference.toString();
        String onExplicitThis = this.toString();
        String onImplicitThis = toString();
        String onGetClass = getClass().getName();
        int onToStringOfCreation = new InvocationTarget().toString().length();
        System.out.println(implicitThis + explicitThis + onLocal + onField + onThisField + onStaticField + onStaticFieldOfType
                + onStaticImportedField + onFieldOfLocal + onFieldChain + onCreation + onCreationWithArguments + onStaticFactory
                + onReturnValue + chained + onReturnedArrayElement + onArrayElement + onListElement + onMapElement + onCast
                + onBoxedLocal + onLiteral + onEnumConstant + onClassLiteral + onParenthesized + onTernary + onArrayCreation
                + inConcatenation + onRecordAccessor + onObject + onExplicitThis + onImplicitThis + onGetClass + onToStringOfCreation);
    }

    public void argumentForms() {
        InvocationTarget local = new InvocationTarget();
        MethodDeclarations declarations = new MethodDeclarations();
        int sideEffectLocal = 1;
        int overloadByArity = local.instanceMethodWithArguments(1);
        int withSecondArgument = local.instanceMethodWithArguments(1, "");
        int varargsInline = local.instanceMethodWithArguments(1, "", 2, 3);
        int varargsAsArray = local.instanceMethodWithArguments(1, "", new int[]{2, 3});
        int argumentSources = local.instanceMethodWithArguments(targetField.instanceMethod(), "constant", sideEffectLocal, staticMethodOnThisClass(), local.supplierField.get());
        int inferredGeneric = local.genericInstanceMethod(1);
        int explicitGeneric = local.<Integer>genericInstanceMethod(1);
        int ownOverloadByType = methodWithOverloads(1) + methodWithOverloads("");
        int ownOverloadByArity = methodWithOverloads(1, 2);
        int declaredOverloads = declarations.add(1) + declarations.add(1, 2) + declarations.add(new String[0]) + declarations.add(List.of(1));
        int invocationAsArgument = local.instanceMethodWithArguments(local.instanceMethod(), "");
        int staticAsArgument = local.instanceMethodWithArguments(InvocationTarget.staticMethod(), "");
        int genericInferredFromArgument = local.genericInstanceMethod(local.returnsSelf()).instanceMethod();
        List<Integer> methodReferenceAsArgument = listField.stream().map(InvocationTarget::instanceMethod).collect(Collectors.toList());
        int lambdaAsArgument = listField.stream().map(target -> target.instanceMethod()).mapToInt(Integer::intValue).sum();
        Object lambdaReturningAnonymous = listField.stream().map(target -> new Object() {
            final int value = target.instanceMethod();
        }).findFirst().orElseThrow();
        int[] viaArraysStream = Arrays.stream(arrayField).mapToInt(target -> target.instanceMethod()).toArray();
        int sideEffectingArgument = local.instanceMethodWithArguments(sideEffectLocal++, "");
        int castArgument = local.instanceMethodWithArguments((int) 1.5, "");
        int exactArgument = local.instanceMethodWithArguments(Math.addExact(1, 1), "");
        System.out.println(overloadByArity + withSecondArgument + varargsInline + varargsAsArray + argumentSources + inferredGeneric
                + explicitGeneric + ownOverloadByType + ownOverloadByArity + declaredOverloads + invocationAsArgument + staticAsArgument
                + genericInferredFromArgument + methodReferenceAsArgument.size() + lambdaAsArgument + lambdaReturningAnonymous.hashCode()
                + viaArraysStream.length + sideEffectingArgument + castArgument + exactArgument);
    }

    public int streamPipelines() {
        List<Integer> filteredAndMapped = listField.stream()
                .filter(target -> target.instanceMethod() > 0)
                .map(InvocationTarget::instanceMethod)
                .collect(Collectors.toList());
        int summed = listField.stream().mapToInt(target -> target.instanceMethod()).sum();
        long counted = Stream.of(targetField, STATIC_TARGET_FIELD).filter(Objects::nonNull).count();
        return filteredAndMapped.size() + summed + (int) counted;
    }

    public int functionalInterfaceInvocations() {
        InvocationTarget local = new InvocationTarget();
        int viaSupplierField = supplierField.get();
        int viaSupplierFieldOfLocal = local.supplierField.get();
        int viaFunctionField = local.functionField.apply(1);
        int viaReturnedSupplier = local.returnsSupplier().get();
        int curried = local.returnsCurried().apply(1).apply(2);
        Supplier<Integer> localSupplier = local::instanceMethod;
        int viaLocalSupplier = localSupplier.get();
        int immediatelyInvokedLambda = ((Supplier<Integer>) () -> 1).get();
        Function<Integer, Integer> composed = local.functionField.andThen(local.functionField);
        int viaComposed = composed.apply(1);
        return viaSupplierField + viaSupplierFieldOfLocal + viaFunctionField + viaReturnedSupplier + curried + viaLocalSupplier
                + immediatelyInvokedLambda + viaComposed;
    }

    public int otherExpressionContexts() {
        InvocationTarget local = new InvocationTarget();
        Supplier<Integer> viaThisInLambda = () -> this.instanceMethodOnThisClass();
        int[] inArrayInitializer = {local.instanceMethod(), InvocationTarget.staticMethod()};
        int inTernary = counter > 0 ? local.instanceMethod() : InvocationTarget.staticMethod();
        return viaThisInLambda.get() + inArrayInitializer.length + inTernary;
    }

    public Object reflectionInvocations() throws Exception {
        InvocationTarget local = new InvocationTarget();
        Object viaGetMethod = InvocationTarget.class.getMethod("instanceMethod").invoke(local);
        Method methodInfo = InvocationTarget.class.getMethod("staticMethod");
        Object viaMethodInfo = methodInfo.invoke(null);
        int viaNewInstance = InvocationTarget.class.getDeclaredConstructor().newInstance().instanceMethod();
        return List.of(viaGetMethod, viaMethodInfo, viaNewInstance);
    }

    public int localClassInvocations() {
        class LocalFunctions {
            int localFunction() {
                return 1;
            }

            int localFunctionWithParameter(int value) {
                return value;
            }

            <T> T genericLocalFunction(T value) {
                return value;
            }

            int recursiveLocalFunction(int depth) {
                return depth <= 0 ? 0 : recursiveLocalFunction(depth - 1);
            }

            int callingStaticFromLocalClass() {
                return InvocationTarget.staticMethod();
            }
        }
        LocalFunctions functions = new LocalFunctions();
        int plain = functions.localFunction();
        int withParameter = functions.localFunctionWithParameter(1);
        int inferredGeneric = functions.genericLocalFunction(1);
        String explicitGeneric = functions.<String>genericLocalFunction("");
        Supplier<Integer> asSupplier = functions::localFunction;
        int viaSupplier = asSupplier.get();
        int recursive = functions.recursiveLocalFunction(2);
        int declaredLater = localFunctionDeclaredLater();
        return plain + withParameter + inferredGeneric + explicitGeneric.length() + viaSupplier + recursive + declaredLater
                + functions.callingStaticFromLocalClass();
    }

    public void constructorInvocations() {
        InvocationTarget plain = new InvocationTarget();
        InvocationTarget withArguments = new InvocationTarget(1);
        var inferred = new InvocationTarget();
        InvocationTarget.GenericStaticClassForInvocations.NestedInstantiable nestedOfGeneric =
                new InvocationTarget.GenericStaticClassForInvocations.NestedInstantiable();
        List<InvocationTarget> frameworkGeneric = new ArrayList<InvocationTarget>(1);
        GenericTypes.GenericClassWithOneParameter.StaticNestedGeneric<Integer> staticNestedGeneric =
                new GenericTypes.GenericClassWithOneParameter.StaticNestedGeneric<Integer>();
        GenericTypes.GenericClassWithOneParameter<Integer> outer = new GenericTypes.GenericClassWithOneParameter<>();
        GenericTypes.GenericClassWithOneParameter<Integer>.NestedGenericClass<String> innerOfOuter = outer.new NestedGenericClass<String>();
        InvocationTarget viaSupplier = createViaSupplier(InvocationTarget::new);
        ChainedConstructors chained = new ChainedConstructors();
        SuperChainedConstructor superChained = new SuperChainedConstructor();
        System.out.println(List.of(plain, withArguments, inferred, nestedOfGeneric, frameworkGeneric, staticNestedGeneric, innerOfOuter,
                viaSupplier, chained, superChained).size());
    }

    public void statementContexts() throws Exception {
        InvocationTarget local = new InvocationTarget();
        local.instanceMethod();
        if (local.instanceMethod() > 0 && Objects.equals(local, local)) {
            counter++;
        }
        while (local.instanceMethod() < 0) {
            local = local.returnsSelf();
        }
        for (int i = local.instanceMethod(); i < local.instanceMethod(); i += local.instanceMethod()) {
            counter++;
        }
        for (var item : local.returnsList()) {
            item.instanceMethod();
        }
        for (String text : local.returnsList().stream().map(InvocationTarget::toString).collect(Collectors.toList())) {
            counter += text.length();
        }
        switch (local.instanceMethod()) {
            case 1:
                break;
            default:
                break;
        }
        int viaSwitchExpression = switch (local.instanceMethod()) {
            case 1 -> local.instanceMethod();
            default -> InvocationTarget.staticMethod();
        };
        boolean relational = local.instanceMethod() > 0;
        boolean typeTest = local.returnsSelf() instanceof InvocationTarget;
        try (AutoCloseable resource = createResource()) {
            counter++;
        }
        synchronized (local) {
            local.instanceMethod();
        }
        try {
            throwingMethod();
        } catch (IllegalStateException exception) {
            exception.getClass();
        }
        try {
            throw createException();
        } catch (IllegalStateException exception) {
            counter--;
        }
        counter += local.instanceMethod();
        System.out.println(viaSwitchExpression + (relational ? 1 : 0) + (typeTest ? 1 : 0));
    }

    public int asyncInvocations() {
        InvocationTarget local = new InvocationTarget();
        InvocationTarget joined = local.returnsFuture().join();
        int onJoined = local.returnsFuture().join().instanceMethod();
        CompletableFuture<Integer> supplied = CompletableFuture.supplyAsync(local::instanceMethod);
        CompletableFuture<Integer> thenApplied = local.returnsFuture().thenApply(target -> target.instanceMethod());
        CompletableFuture<Void> all = CompletableFuture.allOf(local.returnsFuture(), local.returnsFuture());
        all.join();
        CompletableFuture.runAsync(() -> local.instanceMethod()).join();
        return joined.instanceMethod() + onJoined + supplied.join() + thenApplied.join();
    }

    public int expressionBodiedMemberInvokingOthers() {
        return targetField.instanceMethod() + InvocationTarget.staticMethod() + instanceMethodOnThisClass();
    }

    private int localFunctionDeclaredLater() {
        return 1;
    }

    private static <T> T createViaSupplier(Supplier<T> factory) {
        return factory.get();
    }

    /** The members every array has: {@code length} is no field and {@code clone()} overrides {@code Object.clone()}. */
    public int arrayMembers() {
        int[] cloned = numbers.clone();
        Object[] objects = new String[1];
        Object[] clonedObjects = objects.clone();
        return cloned.length + clonedObjects.length + numbers.length;
    }

    private static AutoCloseable createResource() {
        return new CloseableForInvocations();
    }

    private static void throwingMethod() {
        throw new IllegalStateException();
    }

    private static RuntimeException createException() {
        return new IllegalStateException();
    }

    public static class ChainedConstructors {
        private final int value;

        public ChainedConstructors() {
            this(InvocationTarget.staticMethod());
        }

        public ChainedConstructors(int value) {
            this.value = value;
        }
    }

    public static class SuperChainedConstructor extends ClassInheritance.Base {
        public SuperChainedConstructor() {
            super(InvocationTarget.staticMethod());
        }
    }

    public static final class CloseableForInvocations implements AutoCloseable {
        @Override
        public void close() {
        }
    }

    public static class InvocationsFromInitializers {
        private final int fromFieldInitializer = InvocationTarget.staticMethod();
        private final InvocationTarget constructorParameter;

        public InvocationsFromInitializers(InvocationTarget constructorParameter) {
            this.constructorParameter = constructorParameter;
        }

        public int fromConstructorParameter() {
            return constructorParameter.returnsSelf().instanceMethod();
        }

        public int fromField() {
            return fromFieldInitializer;
        }

        public record RecordInvokingOnComponent(InvocationTarget target) {
            public int fromComponent() {
                return target.returnsSelf().instanceMethod();
            }
        }
    }
}
