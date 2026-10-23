package vision.noesis.scanner.core.java;

/** Access and modifier facts of a declaration in neutral form, so both engines map them through one rule set. */
public record MemberFlags(
        boolean isPublic,
        boolean isProtected,
        boolean isPrivate,
        boolean isStatic,
        boolean isAbstract,
        boolean isFinal,
        boolean isNative,
        boolean isSynchronized,
        boolean isVolatile,
        boolean isTransient,
        boolean isStrictfp,
        boolean isDefault,
        boolean isSealed,
        boolean isNonSealed) {

    public static final class Builder {
        private boolean isPublic, isProtected, isPrivate, isStatic, isAbstract, isFinal, isNative, isSynchronized, isVolatile, isTransient, isStrictfp, isDefault, isSealed, isNonSealed;

        public Builder isPublic(boolean value) { isPublic = value; return this; }
        public Builder isProtected(boolean value) { isProtected = value; return this; }
        public Builder isPrivate(boolean value) { isPrivate = value; return this; }
        public Builder isStatic(boolean value) { isStatic = value; return this; }
        public Builder isAbstract(boolean value) { isAbstract = value; return this; }
        public Builder isFinal(boolean value) { isFinal = value; return this; }
        public Builder isNative(boolean value) { isNative = value; return this; }
        public Builder isSynchronized(boolean value) { isSynchronized = value; return this; }
        public Builder isVolatile(boolean value) { isVolatile = value; return this; }
        public Builder isTransient(boolean value) { isTransient = value; return this; }
        public Builder isStrictfp(boolean value) { isStrictfp = value; return this; }
        public Builder isDefault(boolean value) { isDefault = value; return this; }
        public Builder isSealed(boolean value) { isSealed = value; return this; }
        public Builder isNonSealed(boolean value) { isNonSealed = value; return this; }

        public MemberFlags build() {
            return new MemberFlags(isPublic, isProtected, isPrivate, isStatic, isAbstract, isFinal, isNative, isSynchronized, isVolatile, isTransient, isStrictfp, isDefault, isSealed, isNonSealed);
        }
    }

    public static Builder builder() {
        return new Builder();
    }
}
