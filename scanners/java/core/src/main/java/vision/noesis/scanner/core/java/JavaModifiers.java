package vision.noesis.scanner.core.java;

import java.util.ArrayList;
import java.util.List;
import vision.noesis.scanner.model.Modifier;
import vision.noesis.scanner.model.TypeKind;
import vision.noesis.scanner.model.Visibility;

/**
 * The shared mapping of Java access and modifiers onto the model's vocabulary: package-private is {@code namespace},
 * {@code protected} is {@code protectedOrNamespace}, a final field is {@code readonly}, {@code native} is {@code external}.
 */
public final class JavaModifiers {

    private JavaModifiers() {}

    public static Visibility visibility(MemberFlags flags) {
        if (flags.isPublic()) return Visibility.PUBLIC;
        if (flags.isProtected()) return Visibility.PROTECTED_OR_NAMESPACE;
        if (flags.isPrivate()) return Visibility.PRIVATE;
        return Visibility.NAMESPACE;
    }

    /** {@code abstract} is not repeated on interfaces; {@code final} covers the implicit finality of enums and records. */
    public static List<Modifier> type(MemberFlags flags, TypeKind kind, boolean isRecord) {
        List<Modifier> modifiers = new ArrayList<>();
        if (flags.isStatic()) modifiers.add(Modifier.STATIC);
        if (flags.isAbstract() && kind != TypeKind.INTERFACE) modifiers.add(Modifier.ABSTRACT);
        if (flags.isFinal()) modifiers.add(Modifier.FINAL);
        if (isRecord) modifiers.add(Modifier.RECORD);
        return modifiers;
    }

    /** {@code virtual} is every instance method that is not private, static, final or abstract: the doc's rule for Java. */
    public static List<Modifier> method(MemberFlags flags, boolean isConstructor) {
        List<Modifier> modifiers = new ArrayList<>();
        if (flags.isStatic()) modifiers.add(Modifier.STATIC);
        if (flags.isAbstract()) modifiers.add(Modifier.ABSTRACT);
        if (flags.isFinal()) modifiers.add(Modifier.FINAL);
        if (!isConstructor && !flags.isStatic() && !flags.isPrivate() && !flags.isFinal() && !flags.isAbstract()) modifiers.add(Modifier.VIRTUAL);
        if (flags.isNative()) modifiers.add(Modifier.EXTERNAL);
        return modifiers;
    }

    public static List<Modifier> field(MemberFlags flags) {
        List<Modifier> modifiers = new ArrayList<>();
        if (flags.isStatic()) modifiers.add(Modifier.STATIC);
        if (flags.isFinal()) modifiers.add(Modifier.READONLY);
        if (flags.isVolatile()) modifiers.add(Modifier.VOLATILE);
        return modifiers;
    }
}
