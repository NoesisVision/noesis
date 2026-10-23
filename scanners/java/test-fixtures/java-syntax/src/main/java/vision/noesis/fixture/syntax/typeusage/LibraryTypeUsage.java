package vision.noesis.fixture.syntax.typeusage;

import com.google.common.annotations.GwtIncompatible;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Charsets;
import com.google.common.base.Converter;
import com.google.common.base.Supplier;
import com.google.common.base.VerifyException;
import com.google.common.collect.BoundType;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.Interner;
import com.google.common.collect.Ordering;
import com.google.common.hash.Funnel;
import com.google.common.io.Closer;
import com.google.common.net.HostAndPort;
import com.google.common.primitives.Doubles;
import com.google.common.primitives.Ints;
import com.google.common.util.concurrent.AtomicDouble;
import java.nio.charset.Charset;
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

/** The same uses of a type declared in a library; differs from its siblings only in the ids referenced. */
@GwtIncompatible("AtomicDouble")
public class LibraryTypeUsage extends Converter<String, AtomicDouble>
        implements Supplier<AtomicDouble>, Interner<AtomicDouble>, Comparator<HostAndPort> {

    public AtomicDouble field = new AtomicDouble();

    public List<AtomicDouble> listField;

    public AtomicDouble[] arrayField;

    public AtomicDouble pass(AtomicDouble parameter) {
        AtomicDouble local = new AtomicDouble(1.0);
        Object erased = local;
        if (erased instanceof AtomicDouble) {
            AtomicDouble cast = (AtomicDouble) erased;
            return cast;
        }
        return parameter;
    }

    public double use() {
        return field.get() + pass(field).get();
    }

    public static AtomicDouble staticClassField = new AtomicDouble();
    public final AtomicDouble finalClassField = new AtomicDouble();
    public static final BoundType CONST_ENUM_FIELD = BoundType.CLOSED;
    public AtomicDouble[][] jaggedArrayField = new AtomicDouble[0][];
    public Map<BoundType, List<AtomicDouble>> nestedGenericField = new HashMap<>();
    public Funnel<AtomicDouble> customFunctionalInterfaceField = (value, sink) -> sink.putDouble(value.get());
    public Function<AtomicDouble, BoundType> frameworkFunctionOfCustomTypesField = value -> BoundType.OPEN;
    public Supplier<AtomicDouble> interfaceField = this;
    public Interner<AtomicDouble> genericInterfaceField = this;
    public ImmutableList<AtomicDouble> genericClassField = ImmutableList.of();
    public HostAndPort recordField = HostAndPort.fromParts("host", 1);
    public ImmutableList.Builder<AtomicDouble> nestedTypeField = ImmutableList.builder();
    public com.google.common.util.concurrent.AtomicDouble fullyQualifiedField = new AtomicDouble();
    public final AtomicDouble constructorParameterField;
    @VisibleForTesting
    public AtomicDouble attributedField;

    public LibraryTypeUsage() {
        this(new AtomicDouble(), BoundType.OPEN);
    }

    public LibraryTypeUsage(AtomicDouble value, BoundType kind) {
        constructorParameterField = value;
    }

    public AtomicDouble classReturn() {
        return field;
    }

    public BoundType enumReturn() {
        return BoundType.OPEN;
    }

    public HostAndPort recordReturn() {
        return recordField;
    }

    public Supplier<AtomicDouble> interfaceReturn() {
        return this;
    }

    public AtomicDouble[] arrayReturn() {
        return new AtomicDouble[0];
    }

    public List<AtomicDouble> genericReturn() {
        return new ArrayList<>();
    }

    public Funnel<AtomicDouble> functionalInterfaceReturn() {
        return customFunctionalInterfaceField;
    }

    public CompletableFuture<AtomicDouble> asyncReturn() {
        return CompletableFuture.completedFuture(field);
    }

    public Iterable<AtomicDouble> iteratorReturn() {
        return ImmutableList.of(field);
    }

    public Optional<AtomicDouble> optionalReturn() {
        return Optional.of(field);
    }

    @VisibleForTesting
    public AtomicDouble attributedReturn() {
        return field;
    }

    public void classParameter(AtomicDouble value) {
    }

    public void enumParameter(BoundType value) {
    }

    public void recordParameter(HostAndPort value) {
    }

    public void interfaceParameter(Supplier<AtomicDouble> value) {
    }

    public void varargsParameter(AtomicDouble... values) {
    }

    public void arrayParameter(AtomicDouble[] values) {
    }

    public void genericParameters(List<AtomicDouble> list, Map<BoundType, AtomicDouble> map) {
    }

    public void customFunctionalInterfaceParameter(Funnel<AtomicDouble> callback) {
    }

    public void frameworkFunctionOfCustomTypesParameter(Function<AtomicDouble, BoundType> selector, Consumer<HostAndPort> action) {
    }

    public void attributedParameter(@VisibleForTesting AtomicDouble value) {
    }

    public void finalParameter(final AtomicDouble value) {
    }

    public <T extends AtomicDouble> T constrainedToClass(T value) {
        return value;
    }

    public <T extends Supplier<AtomicDouble>> T constrainedToInterface(T value) {
        return value;
    }

    public <T extends Interner<AtomicDouble>> T constrainedToGenericInterface(T value) {
        return value;
    }

    public void explicitTypeArguments() {
        AtomicDouble viaExplicitMethodTypeArgument = this.<AtomicDouble>constrainedToClass(new AtomicDouble());
        List<AtomicDouble> emptyList = Collections.<AtomicDouble>emptyList();
        List<AtomicDouble> list = new ArrayList<AtomicDouble>();
        Map<BoundType, AtomicDouble> map = new HashMap<BoundType, AtomicDouble>();
        System.out.println(viaExplicitMethodTypeArgument.get() + emptyList.size() + list.size() + map.size());
    }

    public void bodyLevelUse(Object input) throws Exception {
        AtomicDouble localVariable = new AtomicDouble();
        var inferredLocalVariable = new AtomicDouble(1.0);
        AtomicDouble[] arrayCreation = new AtomicDouble[1];
        List<HostAndPort> genericCreation = new ArrayList<HostAndPort>();
        Object boxed = localVariable;
        AtomicDouble cast = (AtomicDouble) boxed;
        boolean typeTest = boxed instanceof AtomicDouble;
        boolean patternTest = input instanceof HostAndPort matched && matched.getPort() == 1;
        String switchOnType;
        if (input instanceof AtomicDouble) {
            switchOnType = "class";
        } else if (input instanceof BoundType) {
            switchOnType = "enum";
        } else {
            switchOnType = "";
        }
        Class<?> classLiteral = AtomicDouble.class;
        Function<AtomicDouble, BoundType> typedLambda = (AtomicDouble value) -> BoundType.OPEN;
        class LocalFunction {
            BoundType apply(AtomicDouble value, BoundType other) {
                return other;
            }
        }
        BoundType fromLocalClass = new LocalFunction().apply(localVariable, BoundType.CLOSED);
        for (AtomicDouble item : listField) {
            item.get();
        }
        try (Closer closeable = Closer.create()) {
            closeable.hashCode();
        }
        try {
            throw new VerifyException("fixture");
        } catch (VerifyException exception) {
            exception.getMessage();
        }
        int recordAccessor = recordField.getPort();
        Charset staticFieldRead = Charsets.UTF_8;
        int staticCall = Doubles.compare(1.0, 2.0);
        int constantReference = Ints.MAX_POWER_OF_TWO;
        ImmutableList<AtomicDouble> nestedCall = nestedTypeField.build();
        System.out.println(inferredLocalVariable.get() + arrayCreation.length + genericCreation.size() + cast.get() + (typeTest ? 1 : 0)
                + (patternTest ? 1 : 0) + switchOnType + classLiteral.getName() + typedLambda.apply(localVariable).name() + fromLocalClass.name()
                + recordAccessor + staticFieldRead.name() + staticCall + constantReference + nestedCall.size());
    }

    @Override
    protected AtomicDouble doForward(String value) {
        return new AtomicDouble(Double.parseDouble(value));
    }

    @Override
    protected String doBackward(AtomicDouble value) {
        return String.valueOf(value.get());
    }

    @Override
    public AtomicDouble get() {
        return field;
    }

    @Override
    public AtomicDouble intern(AtomicDouble value) {
        return value;
    }

    @Override
    public int compare(HostAndPort left, HostAndPort right) {
        return 0;
    }

    public static class NestedClassWithCustomTypes {
        public AtomicDouble fieldInNestedClass = new AtomicDouble();
    }

    public record RecordWithCustomTypeMembers(AtomicDouble positional, BoundType positionalEnum) {}

    public interface InterfaceWithCustomTypeMembers {
        AtomicDouble propertyOfCustomType();

        AtomicDouble methodWithCustomTypes(BoundType kind, Supplier<AtomicDouble> other);
    }

    @FunctionalInterface
    public interface FunctionalInterfaceWithCustomTypes {
        HostAndPort apply(AtomicDouble argument, BoundType kind);
    }

    public static class GenericClassConstrainedToCustomTypes<TClass extends AtomicDouble, TInterface extends Interner<AtomicDouble>> {
        public TClass constrainedField;
    }

    public static class DerivedFromGenericOfOwnType extends ArrayList<AtomicDouble> implements Interner<AtomicDouble> {
        private static final long serialVersionUID = 1L;

        @Override
        public AtomicDouble intern(AtomicDouble value) {
            add(value);
            return value;
        }
    }

    public enum EnumInTypeUsage {
        MEMBER
    }

    public static class DerivedFromGenericClassOfOrigin extends Ordering<LibraryTypeUsage> {
        @Override
        public int compare(LibraryTypeUsage left, LibraryTypeUsage right) {
            return 0;
        }
    }
}
