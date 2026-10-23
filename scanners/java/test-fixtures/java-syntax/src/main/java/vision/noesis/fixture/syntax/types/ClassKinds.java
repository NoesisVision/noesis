package vision.noesis.fixture.syntax.types;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import vision.noesis.fixture.syntax.annotations.OwnAnnotation;

/** Every kind of class declaration and nesting. */
public final class ClassKinds {

    private ClassKinds() {
    }

    public static class PlainClass {
    }

    public abstract static class AbstractClass {
        public abstract void run();
    }

    public static final class FinalClass {
    }

    static class PackagePrivateClass {
    }

    protected static class ProtectedNestedClass {
    }

    private static class PrivateNestedClass {
    }

    /** A non-static nested class is an inner class: its instances belong to an outer instance. */
    public class InnerClass {
        public ClassKinds outer() {
            return ClassKinds.this;
        }
    }

    public static class OuterClassWithNestedTypes {
        public interface NestedInterface {
            void nested();
        }

        public enum NestedEnum {
            ONE,
            TWO
        }

        public record NestedRecord(int value) {}

        public @interface NestedAnnotation {}

        public static class DeeplyNested {
            public static class Deeper {
            }
        }

        @FunctionalInterface
        public interface NestedFunction {
            void invoke();
        }

        public static class GenericNestedClass<T> {
        }
    }

    public sealed interface Shape permits Circle, Square, Polygon {
        double area();
    }

    public static final class Circle implements Shape {
        private final double radius;

        public Circle(double radius) {
            this.radius = radius;
        }

        @Override
        public double area() {
            return Math.PI * radius * radius;
        }
    }

    public non-sealed static class Square implements Shape {
        @Override
        public double area() {
            return 1;
        }
    }

    public abstract static sealed class Polygon implements Shape permits Triangle {
    }

    public static final class Triangle extends Polygon {
        @Override
        public double area() {
            return 0.5;
        }
    }

    @SuppressWarnings("strictfp")
    public static strictfp class StrictClass {
    }

    public static class ClassWithExplicitObjectBase extends Object {
    }

    public static final class StaticClass {
        private StaticClass() {
        }

        public static void staticMethodInStaticClass() {
        }
    }

    public static class ClassUsingFileLocalClass {
        private final Object fileLocalInstance = new FileLocalClass();
        private final Object fileLocalInterfaceInstance = new FileLocalInterface() { };
        private final Object fileLocalEnumInstance = FileLocalEnum.MEMBER;
        private final Object fileLocalRecordInstance = new FileLocalRecord(1);
        private final Object viaFileLocalFactory = FileLocalStaticClass.createRecord();
    }

    public interface InterfaceWithNestedTypes {
        class ClassNestedInInterface {
        }

        enum EnumNestedInInterface {
            MEMBER
        }
    }

    @Repeatable(CustomAnnotationWithUsage.Container.class)
    @Inherited
    @Documented
    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.TYPE)
    public @interface CustomAnnotationWithUsage {
        String value();

        int namedArgument() default 0;

        @Inherited
        @Documented
        @Retention(RetentionPolicy.RUNTIME)
        @Target(ElementType.TYPE)
        @interface Container {
            CustomAnnotationWithUsage[] value();
        }
    }

    @Deprecated(since = "1", forRemoval = true)
    @CustomAnnotationWithUsage(value = "first", namedArgument = 1)
    @CustomAnnotationWithUsage("second")
    @OwnAnnotation(priority = 2)
    public static class ClassWithAttributes {
    }
}

/** A package-private top-level class in another class's file: the closest mirror of a file-local type. */
class FileLocalClass {
}

/** A package-private top-level interface in another class's file. */
interface FileLocalInterface {
}

/** A package-private top-level enum in another class's file. */
enum FileLocalEnum {
    MEMBER
}

/** A package-private top-level record in another class's file. */
record FileLocalRecord(int value) {
}

/** A package-private utility class creating the file-local types. */
final class FileLocalStaticClass {

    private FileLocalStaticClass() {
    }

    static FileLocalEnum createEnum() {
        return FileLocalEnum.MEMBER;
    }

    static FileLocalRecord createRecord() {
        return new FileLocalRecord(1);
    }

    static FileLocalInterface createInterface() {
        return null;
    }
}
