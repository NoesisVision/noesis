package vision.noesis.fixture.syntax.members;

import java.util.ArrayList;
import java.util.List;

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
}
