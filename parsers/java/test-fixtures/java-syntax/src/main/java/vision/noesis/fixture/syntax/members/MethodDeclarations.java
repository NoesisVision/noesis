package vision.noesis.fixture.syntax.members;

import java.io.IOException;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.List;
import vision.noesis.fixture.syntax.types.InterfaceKinds.AnnotationWithDefaults;

/** Methods: every modifier, overloads, varargs, throws, initializer blocks. */
public class MethodDeclarations {

    private static int staticCounter;
    private int instanceCounter;

    static {
        staticCounter = 1;
    }

    static {
        staticCounter++;
    }

    {
        instanceCounter = staticCounter;
    }

    public MethodDeclarations() {
    }

    public MethodDeclarations(int start) {
        this();
        instanceCounter = start;
    }

    public void publicMethod() {
    }

    protected void protectedMethod() {
    }

    void packagePrivateMethod() {
    }

    private void privateMethod() {
    }

    public static void staticMethod() {
    }

    public final void finalMethod() {
    }

    public synchronized void synchronizedMethod() {
    }

    public native void nativeMethod();

    @SuppressWarnings("strictfp")
    public strictfp double strictMethod() {
        return 1.0;
    }

    public void throwsMethod() throws IOException, CustomException {
    }

    public int add(int left) {
        return left;
    }

    public int add(int left, int right) {
        return left + right;
    }

    public int add(String[] parts) {
        return parts.length;
    }

    public int add(List<Integer> values) {
        return values.size();
    }

    public int sum(int... values) {
        int total = 0;
        for (int value : values) total += value;
        return total;
    }

    public String format(String template, Object... arguments) {
        return String.format(template, arguments);
    }

    public int[] arrayReturn() {
        return new int[0];
    }

    public static class CustomException extends Exception {
        private static final long serialVersionUID = 1L;

        public CustomException(String message) {
            super(message);
        }
    }

    @AnnotationWithDefaults(kind = ElementType.METHOD, required = 1L)
    @Deprecated(since = "1", forRemoval = true)
    public void methodWithAttribute() {
    }

    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.TYPE_USE)
    public @interface TypeUseAnnotation {
    }

    public @TypeUseAnnotation String methodWithReturnAttribute() {
        return "";
    }

    @Override
    public String toString() {
        return "MethodDeclarations(" + instanceCounter + ")";
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof MethodDeclarations that && that.instanceCounter == instanceCounter;
    }

    @Override
    public int hashCode() {
        return Integer.hashCode(instanceCounter);
    }

    @Override
    protected void finalize() {
        instanceCounter = 0;
    }
}
