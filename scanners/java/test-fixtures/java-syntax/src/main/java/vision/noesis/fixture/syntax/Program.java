package vision.noesis.fixture.syntax;

import vision.noesis.fixture.syntax.types.ClassKinds;

public final class Program {

    private Program() {
    }

    public static void main(String[] args) {
        System.out.println(new ClassKinds.PlainClass().toString() + args.length);
    }
}
