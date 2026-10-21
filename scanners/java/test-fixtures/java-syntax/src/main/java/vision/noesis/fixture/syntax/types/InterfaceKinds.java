package vision.noesis.fixture.syntax.types;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import vision.noesis.fixture.other.OtherAnnotation;

/** Interfaces with every member kind, and an annotation type with defaults. */
public final class InterfaceKinds {

    private InterfaceKinds() {
    }

    public interface PlainInterface {
        void abstractMethod();

        default void defaultMethod() {
            abstractMethod();
            privateHelper();
        }

        static void staticMethod() {
        }

        private void privateHelper() {
        }

        int CONSTANT = 42;
    }

    public interface GenericInterface<T> {
        T get();

        void put(T value);
    }

    interface PackagePrivateInterface {
    }

    @Retention(RetentionPolicy.RUNTIME)
    @Target({ElementType.TYPE, ElementType.METHOD, ElementType.FIELD, ElementType.PARAMETER, ElementType.TYPE_PARAMETER, ElementType.LOCAL_VARIABLE})
    public @interface AnnotationWithDefaults {
        String value() default "default";

        int count() default 1;

        Class<?> type() default Object.class;

        ElementType kind() default ElementType.TYPE;

        String[] tags() default {};

        OtherAnnotation nested() default @OtherAnnotation("inner");

        long required();
    }
}
