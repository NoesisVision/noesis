package vision.noesis.fixture.syntax.types;

/** Enums: plain, with fields and a constructor, with constant bodies, implementing an interface. */
public final class EnumKinds {

    private EnumKinds() {
    }

    public enum PlainEnum {
        FIRST,
        SECOND
    }

    public enum EnumWithFieldsAndConstructor {
        LIGHT(1),
        HEAVY(10);

        public static final String LABEL = "weight";
        private final int weight;

        EnumWithFieldsAndConstructor(int weight) {
            this.weight = weight;
        }

        public int weight() {
            return weight;
        }
    }

    public enum EnumWithConstantBodies {
        ONE {
            @Override
            int number() {
                return 1;
            }
        },
        TWO {
            @Override
            int number() {
                return 2;
            }
        };

        abstract int number();
    }

    public enum EnumImplementingInterface implements InterfaceKinds.PlainInterface {
        ONLY;

        @Override
        public void abstractMethod() {
        }
    }
}
