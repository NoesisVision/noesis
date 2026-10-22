package vision.noesis.fixture.syntax.types;

import java.util.EnumSet;
import vision.noesis.fixture.syntax.annotations.OwnAnnotation;

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

    enum InternalEnum {
    }

    public enum WithSemicolonOnly {
        ;
    }

    public enum EnumWithAttributedMembers {
        @Deprecated
        OBSOLETE_MEMBER,
        NORMAL
    }

    public enum EnumWithExplicitValues {
        TEN(10),
        HEX(0xFF),
        BINARY(0b1010_1010),
        WITH_SEPARATOR(1_000_000);

        private final int value;

        EnumWithExplicitValues(int value) {
            this.value = value;
        }

        public int value() {
            return value;
        }
    }

    public enum FlagsEnum {
        NONE,
        READ,
        WRITE,
        EXECUTE;

        public static final EnumSet<FlagsEnum> READ_WRITE = EnumSet.of(READ, WRITE);
        public static final EnumSet<FlagsEnum> ALL = EnumSet.allOf(FlagsEnum.class);
    }

    @OwnAnnotation("flags")
    public enum AnnotatedEnum {
        MEMBER
    }

    public enum EnumWithStaticMethods {
        FIRST,
        SECOND;

        public static EnumWithStaticMethods parse(String name) {
            return valueOf(name);
        }

        public static int count() {
            return values().length;
        }
    }
}
