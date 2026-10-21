package vision.noesis.fixture.syntax.types;

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
}
