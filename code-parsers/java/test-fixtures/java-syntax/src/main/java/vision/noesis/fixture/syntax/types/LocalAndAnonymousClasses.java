package vision.noesis.fixture.syntax.types;

/** Classes declared inside a method: local, anonymous, local record. */
public class LocalAndAnonymousClasses {

    private int counter;

    public Runnable localClass() {
        class LocalRunnable implements Runnable {
            @Override
            public void run() {
                counter++;
            }
        }
        return new LocalRunnable();
    }

    public Runnable anonymousClass() {
        return new Runnable() {
            @Override
            public void run() {
                counter--;
            }
        };
    }

    public Object anonymousSubclass() {
        return new Object() {
            @Override
            public String toString() {
                return "anonymous" + counter;
            }
        };
    }

    public static Object localRecord(int value) {
        record LocalRecord(int value) {}
        return new LocalRecord(value);
    }
}
