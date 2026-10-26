package vision.noesis.fixture.syntax.types;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Future;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;

/** Built-in, boxed, array, generic, functional, JDK and nested types as instance fields; anonymous types. */
public final class BuiltInAndSpecialTypes {

    private BuiltInAndSpecialTypes() {
    }

    public static class BuiltInTypesAsFields {
        public boolean boolField;
        public byte byteField;
        public char charField;
        public short shortField;
        public int intField;
        public long longField;
        public float floatField;
        public double doubleField;
        public Object objectField = new Object();
        public String stringField = "";

        public java.lang.String stringFieldViaQualifiedName = "";
        public java.lang.Object fullyQualifiedObjectField = new java.lang.Object();

        public Integer nullableIntField;
        public Boolean boxedBooleanField;

        public int[] singleDimensionalArrayField = new int[0];
        public int[][] jaggedArrayField = new int[0][];
        public int[][][] threeDimensionalArrayField = new int[0][][];
        public Integer[] arrayOfNullableIntsField = new Integer[0];
        public char[] charArrayField = new char[0];
        public Object[] objectArrayField = new Object[0];

        public Map.Entry<Integer, String> referenceTupleField = Map.entry(1, "");

        public List<Integer> genericListField = new ArrayList<>();
        public Map<String, List<Integer>> nestedGenericField = new HashMap<>();
        public Iterable<Map.Entry<String, int[]>> genericInterfaceField = new ArrayList<>();
        public ByteBuffer memoryField = ByteBuffer.allocate(0);
        public CharBuffer readOnlyMemoryField = CharBuffer.wrap("");
        public Function<Integer, String> funcField = value -> value.toString();
        public Runnable actionField = () -> { };
        public Predicate<Integer> predicateField = value -> value > 0;
        public Class<?> typeField = int.class;
        public Class<? extends Number> boundedTypeField = Integer.class;
        public Enum<?> enumBaseTypeField = EnumKinds.PlainEnum.FIRST;
        public Number valueTypeBaseTypeField = 1;
        public CompletableFuture<Void> taskField = CompletableFuture.completedFuture(null);
        public Future<Integer> valueTaskField = CompletableFuture.completedFuture(1);
        public Supplier<String> lazyField = () -> "";
        public Optional<String> optionalField = Optional.empty();
        public LocalDateTime dateTimeField;
        public LocalDate dateOnlyField;
        public LocalTime timeOnlyField;
        public Duration timeSpanField;
        public OffsetDateTime dateTimeOffsetField;
        public UUID guidField;
        public java.math.BigInteger bigIntegerField;
        public java.util.concurrent.locks.ReentrantLock lockField = new java.util.concurrent.locks.ReentrantLock();
        public Exception exceptionField = new Exception();
        public Void voidField;

        public ClassKinds.OuterClassWithNestedTypes.DeeplyNested nestedTypeField = new ClassKinds.OuterClassWithNestedTypes.DeeplyNested();
        public ClassKinds.OuterClassWithNestedTypes.GenericNestedClass<String> genericNestedTypeField = new ClassKinds.OuterClassWithNestedTypes.GenericNestedClass<>();
        public RecordKinds.GenericRecord<List<RecordKinds.PlainRecord>> deeplyNestedGenericField;
    }

    public static class AnonymousAndImplicitTypes {
        public Object createAnonymousType() {
            var anonymous = new Object() {
                final int anonymousProperty = 1;
                final Object anonymousNested = new Object() {
                    final String inner = "";
                };
            };
            int read = anonymous.anonymousProperty;
            return read > 0 ? anonymous : anonymous.anonymousNested;
        }
    }
}
