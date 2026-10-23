package vision.noesis.fixture.syntax.typeusage;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.function.Function;
import vision.noesis.fixture.syntax.annotations.OwnAnnotation;
import vision.noesis.fixture.syntax.generics.GenericTypes;
import vision.noesis.fixture.syntax.types.InterfaceKinds;

/** The same uses of a type declared in this module; differs from its siblings only in the ids referenced. */
@InterfaceKinds.AnnotationWithDefaults(required = 1L, type = UsedType.class)
public class OwnModuleTypeUsage extends UsedAbstractClass
        implements UsedInterface, InterfaceKinds.GenericInterface<UsedType>, Comparator<UsedRecord> {

    public UsedType field = new UsedType();

    public List<UsedType> listField;

    public UsedType[] arrayField;

    public UsedType pass(UsedType parameter) {
        UsedType local = new UsedType(1.0);
        Object erased = local;
        if (erased instanceof UsedType) {
            UsedType cast = (UsedType) erased;
            return cast;
        }
        return parameter;
    }

    public double use() {
        return field.get() + pass(field).get();
    }

    public static UsedType staticClassField = new UsedType();
    public final UsedType finalClassField = new UsedType();
    public static final UsedEnum CONST_ENUM_FIELD = UsedEnum.SECOND;
    public UsedType[][] jaggedArrayField = new UsedType[0][];
    public Map<UsedEnum, List<UsedType>> nestedGenericField = new HashMap<>();
    public UsedFunction customFunctionalInterfaceField = value -> value;
    public Function<UsedType, UsedEnum> frameworkFunctionOfCustomTypesField = value -> UsedEnum.FIRST;
    public UsedInterface interfaceField = this;
    public InterfaceKinds.GenericInterface<UsedType> genericInterfaceField = this;
    public GenericTypes.GenericClassWithOneParameter<UsedType> genericClassField = new GenericTypes.GenericClassWithOneParameter<>();
    public UsedRecord recordField = new UsedRecord("name", 1);
    public UsedType.Nested nestedTypeField = new UsedType.Nested();
    public vision.noesis.fixture.syntax.typeusage.UsedType fullyQualifiedField = new UsedType();
    public final UsedType constructorParameterField;
    @OwnAnnotation("field")
    public UsedType attributedField;

    public OwnModuleTypeUsage() {
        this(new UsedType(), UsedEnum.FIRST);
    }

    public OwnModuleTypeUsage(UsedType value, UsedEnum kind) {
        constructorParameterField = value;
    }

    public UsedType classReturn() {
        return field;
    }

    public UsedEnum enumReturn() {
        return UsedEnum.FIRST;
    }

    public UsedRecord recordReturn() {
        return recordField;
    }

    public UsedInterface interfaceReturn() {
        return this;
    }

    public UsedType[] arrayReturn() {
        return new UsedType[0];
    }

    public List<UsedType> genericReturn() {
        return new ArrayList<>();
    }

    public UsedFunction functionalInterfaceReturn() {
        return customFunctionalInterfaceField;
    }

    public CompletableFuture<UsedType> asyncReturn() {
        return CompletableFuture.completedFuture(field);
    }

    public Iterable<UsedType> iteratorReturn() {
        return List.of(field);
    }

    public Optional<UsedType> optionalReturn() {
        return Optional.of(field);
    }

    @OwnAnnotation("return")
    public UsedType attributedReturn() {
        return field;
    }

    public void classParameter(UsedType value) {
    }

    public void enumParameter(UsedEnum value) {
    }

    public void recordParameter(UsedRecord value) {
    }

    public void interfaceParameter(UsedInterface value) {
    }

    public void varargsParameter(UsedType... values) {
    }

    public void arrayParameter(UsedType[] values) {
    }

    public void genericParameters(List<UsedType> list, Map<UsedEnum, UsedType> map) {
    }

    public void customFunctionalInterfaceParameter(UsedFunction callback) {
    }

    public void frameworkFunctionOfCustomTypesParameter(Function<UsedType, UsedEnum> selector, Consumer<UsedRecord> action) {
    }

    public void attributedParameter(@OwnAnnotation("parameter") UsedType value) {
    }

    public void finalParameter(final UsedType value) {
    }

    public <T extends UsedType> T constrainedToClass(T value) {
        return value;
    }

    public <T extends UsedInterface> T constrainedToInterface(T value) {
        return value;
    }

    public <T extends InterfaceKinds.GenericInterface<UsedType>> T constrainedToGenericInterface(T value) {
        return value;
    }

    public void explicitTypeArguments() {
        UsedType viaExplicitMethodTypeArgument = this.<UsedType>constrainedToClass(new UsedType());
        List<UsedType> emptyList = Collections.<UsedType>emptyList();
        List<UsedType> list = new ArrayList<UsedType>();
        Map<UsedEnum, UsedType> map = new HashMap<UsedEnum, UsedType>();
        System.out.println(viaExplicitMethodTypeArgument.get() + emptyList.size() + list.size() + map.size());
    }

    public void bodyLevelUse(Object input) throws Exception {
        UsedType localVariable = new UsedType();
        var inferredLocalVariable = new UsedType(1.0);
        UsedType[] arrayCreation = new UsedType[1];
        List<UsedRecord> genericCreation = new ArrayList<UsedRecord>();
        Object boxed = localVariable;
        UsedType cast = (UsedType) boxed;
        boolean typeTest = boxed instanceof UsedType;
        boolean patternTest = input instanceof UsedRecord matched && matched.count() == 1;
        String switchOnType;
        if (input instanceof UsedType) {
            switchOnType = "class";
        } else if (input instanceof UsedEnum) {
            switchOnType = "enum";
        } else {
            switchOnType = "";
        }
        Class<?> classLiteral = UsedType.class;
        Function<UsedType, UsedEnum> typedLambda = (UsedType value) -> UsedEnum.FIRST;
        class LocalFunction {
            UsedEnum apply(UsedType value, UsedEnum other) {
                return other;
            }
        }
        UsedEnum fromLocalClass = new LocalFunction().apply(localVariable, UsedEnum.SECOND);
        for (UsedType item : listField) {
            item.get();
        }
        try (UsedCloseable closeable = new UsedCloseable()) {
            closeable.hashCode();
        }
        try {
            throw new UsedException("fixture");
        } catch (UsedException exception) {
            exception.getMessage();
        }
        int recordAccessor = recordField.count();
        UsedType staticFieldRead = UsedType.DEFAULT;
        UsedType staticCall = UsedType.create();
        int constantReference = UsedType.CONSTANT;
        int nestedCall = nestedTypeField.nestedValue();
        System.out.println(inferredLocalVariable.get() + arrayCreation.length + genericCreation.size() + cast.get() + (typeTest ? 1 : 0)
                + (patternTest ? 1 : 0) + switchOnType + classLiteral.getName() + typedLambda.apply(localVariable).name() + fromLocalClass.name()
                + recordAccessor + staticFieldRead.get() + staticCall.get() + constantReference + nestedCall);
    }

    @Override
    public int abstractMethodInAbstractClass() {
        return 0;
    }

    @Override
    public void methodInInterface() {
    }

    @Override
    public UsedType get() {
        return field;
    }

    @Override
    public void put(UsedType value) {
        field = value;
    }

    @Override
    public int compare(UsedRecord left, UsedRecord right) {
        return 0;
    }

    public static class NestedClassWithCustomTypes {
        public UsedType fieldInNestedClass = new UsedType();
    }

    public record RecordWithCustomTypeMembers(UsedType positional, UsedEnum positionalEnum) {}

    public interface InterfaceWithCustomTypeMembers {
        UsedType propertyOfCustomType();

        UsedType methodWithCustomTypes(UsedEnum kind, UsedInterface other);
    }

    @FunctionalInterface
    public interface FunctionalInterfaceWithCustomTypes {
        UsedRecord apply(UsedType argument, UsedEnum kind);
    }

    public static class GenericClassConstrainedToCustomTypes<TClass extends UsedType, TInterface extends InterfaceKinds.GenericInterface<UsedType>> {
        public TClass constrainedField;
    }

    public static class DerivedFromGenericOfOwnType extends ArrayList<UsedType> implements InterfaceKinds.GenericInterface<UsedType> {
        private static final long serialVersionUID = 1L;

        @Override
        public UsedType get() {
            return isEmpty() ? null : get(0);
        }

        @Override
        public void put(UsedType value) {
            add(value);
        }
    }

    public enum EnumInTypeUsage {
        MEMBER
    }

    public static class DerivedFromGenericClassOfOrigin extends GenericTypes.GenericClassWithOneParameter<OwnModuleTypeUsage> {
    }
}
