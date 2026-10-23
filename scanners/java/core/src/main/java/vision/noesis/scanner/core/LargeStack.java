package vision.noesis.scanner.core;

import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

/**
 * Runs a scan on a thread of its own with a large stack. javac's attribution and the engines' tree walks recurse once
 * per nesting level, so a long chain of {@code +} or of builder calls overflows the default stack of a build's thread.
 * The stack is reserved, not committed: the memory is used only as deep as the recursion goes.
 */
public final class LargeStack {

    /** Enough for expressions tens of thousands of terms deep. */
    static final long STACK_SIZE = 512L * 1024 * 1024;

    private LargeStack() {}

    public static <T> T call(String name, Supplier<T> work) {
        AtomicReference<T> result = new AtomicReference<>();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread thread = new Thread(null, () -> {
            try {
                result.set(work.get());
            } catch (Throwable e) {
                failure.set(e);
            }
        }, name, STACK_SIZE);
        thread.setContextClassLoader(Thread.currentThread().getContextClassLoader());
        thread.start();
        try {
            thread.join();
        } catch (InterruptedException e) {
            thread.interrupt();
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while " + name + " ran", e);
        }
        Throwable thrown = failure.get();
        if (thrown instanceof RuntimeException runtime) throw runtime;
        if (thrown instanceof Error error) throw error;
        if (thrown != null) throw new IllegalStateException(thrown);
        return result.get();
    }
}
