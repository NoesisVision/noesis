package vision.noesis.parser.core.java;

import java.util.Set;

/** The eight keyword types; {@code Integer} is not one of them. */
public final class JavaPrimitives {

    public static final Set<String> NAMES = Set.of("boolean", "byte", "char", "short", "int", "long", "float", "double");

    private JavaPrimitives() {}

    public static boolean isPrimitive(String name) {
        return NAMES.contains(name);
    }
}
