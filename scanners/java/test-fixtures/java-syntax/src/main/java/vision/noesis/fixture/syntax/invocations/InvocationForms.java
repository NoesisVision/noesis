package vision.noesis.fixture.syntax.invocations;

import java.io.StringReader;
import java.util.List;
import java.util.function.Supplier;
import vision.noesis.fixture.syntax.inheritance.ClassInheritance;
import vision.noesis.fixture.syntax.types.EnumKinds;

/** Every receiver kind, every body-level fact: calls, accesses, casts, instanceof, creations, lambdas, switches. */
public class InvocationForms extends ClassInheritance.Base {

    private static int staticField;
    private int field;
    private final ClassInheritance.Base held = new ClassInheritance.Derived();
    private int[] numbers = new int[3];

    public void receivers(ClassInheritance.Base parameter) {
        ClassInheritance.Base local = new ClassInheritance.Derived("local");
        this.overridable();
        overridable();
        super.overridable();
        parameter.overridable();
        local.overridable();
        held.overridable();
        this.held.overridable();
        ClassInheritance.Base.staticMethod();
        staticMethod();
        new ClassInheritance.Derived().overridable();
        covariant().toString();
        "literal".length();
        ((ClassInheritance.Base) local).overridable();
        (local).overridable();
    }

    public void accesses(InvocationForms other) {
        field = 1;
        this.field = 2;
        field += 1;
        field++;
        --field;
        int read = field + other.field;
        staticField = read;
        InvocationForms.staticField = staticField + 1;
        other.held.overridable();
        baseField = numbers.length;
        int constant = EnumKinds.EnumWithFieldsAndConstructor.LABEL.length();
        System.out.println(constant);
    }

    public Supplier<Integer> lambda() {
        Runnable runnable = () -> {
            field++;
            overridable();
        };
        runnable.run();
        return () -> field + staticField;
    }

    public Runnable methodReference() {
        Runnable fromInstance = this::overridable;
        Runnable fromStatic = ClassInheritance.Base::staticMethod;
        Supplier<ClassInheritance.Derived> constructor = ClassInheritance.Derived::new;
        fromInstance.run();
        fromStatic.run();
        return constructor.get()::overridable;
    }

    public Object anonymousBody() {
        return new Runnable() {
            @Override
            public void run() {
                overridable();
                field++;
            }
        };
    }

    public void typeUses(Object value) {
        if (value instanceof ClassInheritance.Base) {
            ClassInheritance.Base cast = (ClassInheritance.Base) value;
            cast.overridable();
        }
        if (value instanceof ClassInheritance.Derived derived) {
            derived.covariant();
        }
        String[] created = new String[2];
        int[][] matrix = new int[2][2];
        List<String> list = List.of("a", "b");
        Class<?> literal = ClassInheritance.Base.class;
        System.out.println(created.length + matrix.length + list.size() + literal.getName());
    }

    public String switches(EnumKinds.PlainEnum kind, String text) {
        switch (kind) {
            case FIRST:
                return "first";
            case SECOND:
                return "second";
            default:
                break;
        }
        switch (text) {
            case "a":
                return "A";
            default:
                return text;
        }
    }

    public int loopsAndResources(List<Integer> values) throws Exception {
        int total = 0;
        for (Integer value : values) {
            total += value;
        }
        try (StringReader reader = new StringReader(text(total))) {
            total += reader.read();
        }
        Integer boxed = total;
        int unboxed = boxed;
        return unboxed;
    }

    private String text(int value) {
        return Integer.toString(value);
    }
}
