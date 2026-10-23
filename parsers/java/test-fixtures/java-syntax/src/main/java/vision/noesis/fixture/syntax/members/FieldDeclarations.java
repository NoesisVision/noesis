package vision.noesis.fixture.syntax.members;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;
import vision.noesis.fixture.syntax.types.EnumKinds.PlainEnum;

/** Fields: every constant kind, modifiers, arrays, initializers that call. */
public class FieldDeclarations {

    public static final int INT_CONSTANT = 1;
    public static final long LONG_CONSTANT = 2L;
    public static final short SHORT_CONSTANT = 3;
    public static final byte BYTE_CONSTANT = 4;
    public static final char CHAR_CONSTANT = 'c';
    public static final double DOUBLE_CONSTANT = 1.5;
    public static final float FLOAT_CONSTANT = 2.5f;
    public static final boolean BOOLEAN_CONSTANT = true;
    public static final String STRING_CONSTANT = "text with \"quotes\" and \n newline";
    public static final String DERIVED_CONSTANT = STRING_CONSTANT + INT_CONSTANT;
    public static final Object NOT_A_CONSTANT = new Object();
    public static int counter = initialCounter();

    public volatile int volatileField;
    public transient int transientField;
    protected int protectedField;
    int packagePrivateField;
    private final List<String> lines = new ArrayList<>();
    public int[] array;
    public int[][] matrix;
    public String[] names = {"a", "b"};

    private static int initialCounter() {
        return 0;
    }

    public List<String> lines() {
        return lines;
    }

    public int publicField;
    private int privateField;
    public static int staticField;
    public static volatile boolean staticVolatileField;
    public static final PlainEnum ENUM_FIELD = PlainEnum.FIRST;
    public static final ThreadLocal<Integer> THREAD_STATIC_FIELD = ThreadLocal.withInitial(() -> 0);
    public final int readonlyField;
    public int fieldWithInitializer = 1;
    public int fieldInitializedFromOtherFieldViaConstructor;
    public int firstDeclarator, secondDeclarator = 2, thirdDeclarator;
    public Integer nullableValueField;
    public Runnable delegateField;
    public Function<Integer, Integer> delegateFieldWithLambdaInitializer = value -> value;
    public Function<Integer, Integer> delegateFieldWithMethodReferenceInitializer = FieldDeclarations::computeInitialValue;
    public Object boxedField = 1;

    public FieldDeclarations() {
        readonlyField = 2;
        fieldInitializedFromOtherFieldViaConstructor = fieldWithInitializer;
    }

    private static int computeInitialValue(int value) {
        return value;
    }

    public static final class FieldsInStaticClass {
        public static int staticFieldInStaticClass;
        public static final Object STATIC_READONLY_OBJECT_FIELD = new Object();
        public static final int CONST_FIELD_IN_STATIC_CLASS = 1;

        private FieldsInStaticClass() {
        }
    }

    public interface FieldsInInterface {
        int CONST_FIELD_IN_INTERFACE = 1;

        Object STATIC_FIELD_IN_INTERFACE = new Object();
    }

    public static class FieldsWithGenericTypes<T> {
        public T genericField;
        public List<T> genericCollectionField = new ArrayList<>();
        public Map<String, List<T>> nestedGenericField = new HashMap<>();
        public T[] genericArrayField;
    }

    public static class FieldsWithInitializersReferencingMembers {
        private final int first;
        private final int second;
        private final Supplier<Integer> closure;

        public FieldsWithInitializersReferencingMembers() {
            first = 1;
            second = first + 1;
            closure = () -> first + second;
        }

        public int viaClosure() {
            return closure.get();
        }
    }
}
