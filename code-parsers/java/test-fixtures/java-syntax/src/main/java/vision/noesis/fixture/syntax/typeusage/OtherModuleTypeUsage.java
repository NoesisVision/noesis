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
import vision.noesis.fixture.other.OtherAbstractClass;
import vision.noesis.fixture.other.OtherAnnotation;
import vision.noesis.fixture.other.OtherClass;
import vision.noesis.fixture.other.OtherCloseable;
import vision.noesis.fixture.other.OtherConstants;
import vision.noesis.fixture.other.OtherEnum;
import vision.noesis.fixture.other.OtherException;
import vision.noesis.fixture.other.OtherFunction;
import vision.noesis.fixture.other.OtherGeneric;
import vision.noesis.fixture.other.OtherInterface;
import vision.noesis.fixture.other.OtherPlainInterface;
import vision.noesis.fixture.other.OtherRecord;
import vision.noesis.fixture.other.OtherUsedType;

/** The same uses of a type declared in the other module; differs from its siblings only in the ids referenced. */
@OtherAnnotation(value = "other module", type = OtherUsedType.class, kind = OtherEnum.BETA)
public class OtherModuleTypeUsage extends OtherAbstractClass
        implements OtherPlainInterface, OtherInterface<OtherUsedType>, Comparator<OtherRecord> {

    public OtherUsedType field = new OtherUsedType();

    public List<OtherUsedType> listField;

    public OtherUsedType[] arrayField;

    public OtherUsedType pass(OtherUsedType parameter) {
        OtherUsedType local = new OtherUsedType(1.0);
        Object erased = local;
        if (erased instanceof OtherUsedType) {
            OtherUsedType cast = (OtherUsedType) erased;
            return cast;
        }
        return parameter;
    }

    public double use() {
        return field.get() + pass(field).get();
    }

    public static OtherUsedType staticClassField = new OtherUsedType();
    public final OtherUsedType finalClassField = new OtherUsedType();
    public static final OtherEnum CONST_ENUM_FIELD = OtherEnum.BETA;
    public OtherUsedType[][] jaggedArrayField = new OtherUsedType[0][];
    public Map<OtherEnum, List<OtherUsedType>> nestedGenericField = new HashMap<>();
    public OtherFunction customFunctionalInterfaceField = value -> value;
    public Function<OtherUsedType, OtherEnum> frameworkFunctionOfCustomTypesField = value -> OtherEnum.ALPHA;
    public OtherPlainInterface interfaceField = this;
    public OtherInterface<OtherUsedType> genericInterfaceField = this;
    public OtherGeneric<OtherUsedType> genericClassField = new OtherGeneric<>();
    public OtherRecord recordField = new OtherRecord("name", 1);
    public OtherClass.Nested nestedTypeField = new OtherClass.Nested();
    public vision.noesis.fixture.other.OtherUsedType fullyQualifiedField = new OtherUsedType();
    public final OtherUsedType constructorParameterField;
    @OtherAnnotation("field")
    public OtherUsedType attributedField;

    public OtherModuleTypeUsage() {
        this(new OtherUsedType(), OtherEnum.ALPHA);
    }

    public OtherModuleTypeUsage(OtherUsedType value, OtherEnum kind) {
        constructorParameterField = value;
    }

    public OtherUsedType classReturn() {
        return field;
    }

    public OtherEnum enumReturn() {
        return OtherEnum.ALPHA;
    }

    public OtherRecord recordReturn() {
        return recordField;
    }

    public OtherPlainInterface interfaceReturn() {
        return this;
    }

    public OtherUsedType[] arrayReturn() {
        return new OtherUsedType[0];
    }

    public List<OtherUsedType> genericReturn() {
        return new ArrayList<>();
    }

    public OtherFunction functionalInterfaceReturn() {
        return customFunctionalInterfaceField;
    }

    public CompletableFuture<OtherUsedType> asyncReturn() {
        return CompletableFuture.completedFuture(field);
    }

    public Iterable<OtherUsedType> iteratorReturn() {
        return List.of(field);
    }

    public Optional<OtherUsedType> optionalReturn() {
        return Optional.of(field);
    }

    @OtherAnnotation("return")
    public OtherUsedType attributedReturn() {
        return field;
    }

    public void classParameter(OtherUsedType value) {
    }

    public void enumParameter(OtherEnum value) {
    }

    public void recordParameter(OtherRecord value) {
    }

    public void interfaceParameter(OtherPlainInterface value) {
    }

    public void varargsParameter(OtherUsedType... values) {
    }

    public void arrayParameter(OtherUsedType[] values) {
    }

    public void genericParameters(List<OtherUsedType> list, Map<OtherEnum, OtherUsedType> map) {
    }

    public void customFunctionalInterfaceParameter(OtherFunction callback) {
    }

    public void frameworkFunctionOfCustomTypesParameter(Function<OtherUsedType, OtherEnum> selector, Consumer<OtherRecord> action) {
    }

    public void attributedParameter(@OtherAnnotation("parameter") OtherUsedType value) {
    }

    public void finalParameter(final OtherUsedType value) {
    }

    public <T extends OtherUsedType> T constrainedToClass(T value) {
        return value;
    }

    public <T extends OtherPlainInterface> T constrainedToInterface(T value) {
        return value;
    }

    public <T extends OtherInterface<OtherUsedType>> T constrainedToGenericInterface(T value) {
        return value;
    }

    public void explicitTypeArguments() {
        OtherUsedType viaExplicitMethodTypeArgument = this.<OtherUsedType>constrainedToClass(new OtherUsedType());
        List<OtherUsedType> emptyList = Collections.<OtherUsedType>emptyList();
        List<OtherUsedType> list = new ArrayList<OtherUsedType>();
        Map<OtherEnum, OtherUsedType> map = new HashMap<OtherEnum, OtherUsedType>();
        System.out.println(viaExplicitMethodTypeArgument.get() + emptyList.size() + list.size() + map.size());
    }

    public void bodyLevelUse(Object input) throws Exception {
        OtherUsedType localVariable = new OtherUsedType();
        var inferredLocalVariable = new OtherUsedType(1.0);
        OtherUsedType[] arrayCreation = new OtherUsedType[1];
        List<OtherRecord> genericCreation = new ArrayList<OtherRecord>();
        Object boxed = localVariable;
        OtherUsedType cast = (OtherUsedType) boxed;
        boolean typeTest = boxed instanceof OtherUsedType;
        boolean patternTest = input instanceof OtherRecord matched && matched.count() == 1;
        String switchOnType;
        if (input instanceof OtherUsedType) {
            switchOnType = "class";
        } else if (input instanceof OtherEnum) {
            switchOnType = "enum";
        } else {
            switchOnType = "";
        }
        Class<?> classLiteral = OtherUsedType.class;
        Function<OtherUsedType, OtherEnum> typedLambda = (OtherUsedType value) -> OtherEnum.ALPHA;
        class LocalFunction {
            OtherEnum apply(OtherUsedType value, OtherEnum other) {
                return other;
            }
        }
        OtherEnum fromLocalClass = new LocalFunction().apply(localVariable, OtherEnum.BETA);
        for (OtherUsedType item : listField) {
            item.get();
        }
        try (OtherCloseable closeable = new OtherCloseable()) {
            closeable.hashCode();
        }
        try {
            throw new OtherException("fixture");
        } catch (OtherException exception) {
            exception.getMessage();
        }
        int recordAccessor = recordField.count();
        int fieldRead = new OtherClass(1).value;
        int staticCall = OtherConstants.staticMethodFromOtherModule();
        int constantReference = OtherConstants.CONSTANT;
        int nestedCall = nestedTypeField.nestedValue();
        System.out.println(inferredLocalVariable.get() + arrayCreation.length + genericCreation.size() + cast.get() + (typeTest ? 1 : 0)
                + (patternTest ? 1 : 0) + switchOnType + classLiteral.getName() + typedLambda.apply(localVariable).name() + fromLocalClass.name()
                + recordAccessor + fieldRead + staticCall + constantReference + nestedCall);
    }

    @Override
    public int abstractMethodFromOtherModule() {
        return 0;
    }

    @Override
    public void plainMethodFromOtherModule() {
    }

    @Override
    public OtherUsedType get() {
        return field;
    }

    @Override
    public void put(OtherUsedType value) {
        field = value;
    }

    @Override
    public int compare(OtherRecord left, OtherRecord right) {
        return 0;
    }

    public static class NestedClassWithCustomTypes {
        public OtherUsedType fieldInNestedClass = new OtherUsedType();
    }

    public record RecordWithCustomTypeMembers(OtherUsedType positional, OtherEnum positionalEnum) {}

    public interface InterfaceWithCustomTypeMembers {
        OtherUsedType propertyOfCustomType();

        OtherUsedType methodWithCustomTypes(OtherEnum kind, OtherPlainInterface other);
    }

    @FunctionalInterface
    public interface FunctionalInterfaceWithCustomTypes {
        OtherRecord apply(OtherUsedType argument, OtherEnum kind);
    }

    public static class GenericClassConstrainedToCustomTypes<TClass extends OtherUsedType, TInterface extends OtherInterface<OtherUsedType>> {
        public TClass constrainedField;
    }

    public static class DerivedFromGenericOfOwnType extends ArrayList<OtherUsedType> implements OtherInterface<OtherUsedType> {
        private static final long serialVersionUID = 1L;

        @Override
        public OtherUsedType get() {
            return isEmpty() ? null : get(0);
        }

        @Override
        public void put(OtherUsedType value) {
            add(value);
        }
    }

    public enum EnumInTypeUsage {
        MEMBER
    }

    public static class DerivedFromGenericClassOfOrigin extends OtherGeneric<OtherModuleTypeUsage> {
    }
}
