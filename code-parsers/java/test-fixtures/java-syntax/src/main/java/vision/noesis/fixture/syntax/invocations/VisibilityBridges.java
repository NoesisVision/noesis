package vision.noesis.fixture.syntax.invocations;

/**
 * Calls to public methods a public class inherits from a package-private one. javac gives the public class a bridge
 * for each such method and compiles the calls against the bridge; the model binds them to the inherited method.
 */
public class VisibilityBridges {

    static class HiddenBase {
        public int inherited() {
            return 1;
        }
    }

    public static class Exposed extends HiddenBase {
    }

    public int ownModule(Exposed exposed) {
        return exposed.inherited();
    }

    public int platform(StringBuilder builder) {
        builder.setLength(0);
        return builder.length();
    }
}
