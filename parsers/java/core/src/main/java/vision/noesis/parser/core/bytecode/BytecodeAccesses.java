package vision.noesis.parser.core.bytecode;

import com.tngtech.archunit.core.domain.AccessTarget;
import com.tngtech.archunit.core.domain.InstanceofCheck;
import com.tngtech.archunit.core.domain.JavaAccess;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaCodeUnit;
import com.tngtech.archunit.core.domain.JavaConstructor;
import com.tngtech.archunit.core.domain.JavaConstructorCall;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.core.domain.JavaFieldAccess;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaMethodCall;
import com.tngtech.archunit.core.domain.JavaModifier;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import vision.noesis.parser.model.AccessKind;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.ExpressionKind;
import vision.noesis.parser.model.InvocationKind;
import vision.noesis.parser.model.LanguageBag;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.SourceSpan;
import vision.noesis.parser.model.UsageSite;

/**
 * The body-level facts the class files hold: calls, field accesses and instanceof checks per code unit, with line
 * numbers. ArchUnit attributes a lambda's body to the declaring code unit and flags it, as the model wants.
 */
final class BytecodeAccesses {

    private final BytecodeContext c;
    private JavaClass object;

    BytecodeAccesses(BytecodeContext context) {
        this.c = context;
    }

    void walk(JavaClasses classes) {
        object = objectClass(classes);
        for (JavaClass type : classes) {
            if (!c.isParsed(type) || type.getModifiers().contains(JavaModifier.SYNTHETIC)) continue;
            List<JavaCodeUnit> units = new ArrayList<>(type.getCodeUnits());
            units.sort(Comparator.comparing(JavaCodeUnit::getName).thenComparing(JavaCodeUnit::getDescriptor));
            for (JavaCodeUnit unit : units) {
                if (BytecodeDeclarations.isSynthetic(unit)) continue;
                NodeId from = unit.getName().equals("<clinit>") ? c.ids.staticInitializer(type) : c.ids.member(unit);
                walk(unit, from, type);
            }
        }
    }

    private void walk(JavaCodeUnit unit, NodeId from, JavaClass type) {
        for (JavaMethodCall call : unit.getMethodCallsFromSelf()) {
            Optional<JavaMethod> target = call.getTargetOwner().isArray() ? arrayMemberTarget(call) : call.getTarget().resolveMember();
            // A call javac compiled against a bridge is a call to the method the bridge stands for.
            if (target.isPresent() && target.get().getModifiers().contains(JavaModifier.BRIDGE)) target = BytecodeDeclarations.bridgedMethod(target.get());
            if (target.isPresent() && BytecodeDeclarations.isSynthetic(target.get())) continue;
            NodeId to = target.map(c.ids::member).orElseGet(() -> unresolved(call.getTarget()));
            boolean isStatic = target.map(method -> method.getModifiers().contains(JavaModifier.STATIC)).orElse(false);
            c.builder.edge(new Edge.Invokes(from, to, List.of(), site(call, type), InvocationKind.CALL, isStatic ? ExpressionKind.TYPE : ExpressionKind.OTHER));
        }
        for (JavaConstructorCall call : unit.getConstructorCallsFromSelf()) {
            Optional<JavaConstructor> target = call.getTarget().resolveMember();
            NodeId to = target.map(c.ids::member).orElseGet(() -> unresolved(call.getTarget()));
            c.builder.edge(new Edge.Invokes(from, to, List.of(), site(call, type), InvocationKind.CALL, constructorReceiver(unit, call)));
        }
        for (JavaFieldAccess access : unit.getFieldAccesses()) {
            Optional<JavaField> target = access.getTarget().resolveMember();
            if (target.isPresent() && BytecodeDeclarations.isSynthetic(target.get())) continue;
            if (target.isEmpty() && access.getTargetOwner().getModifiers().contains(JavaModifier.SYNTHETIC)) continue;
            NodeId to = target.map(c.ids::member).orElseGet(() -> vision.noesis.parser.core.java.JavaIds.field(c.ids.typePath(access.getTargetOwner()), access.getTarget().getName()));
            boolean isStatic = target.map(field -> field.getModifiers().contains(JavaModifier.STATIC)).orElse(false);
            AccessKind kind = access.getAccessType() == JavaFieldAccess.AccessType.SET ? AccessKind.WRITE : AccessKind.READ;
            c.builder.edge(new Edge.Accesses(from, to, kind, site(access, type), isStatic ? ExpressionKind.TYPE : ExpressionKind.OTHER));
        }
        for (InstanceofCheck check : unit.getInstanceofChecks()) {
            SourceSpan location = c.lineOf(type, check.getLineNumber());
            if (location == null) continue;
            c.builder.edge(new Edge.UsesType(from, c.types.of(check.getType()), vision.noesis.parser.model.TypeUseRole.TYPE_TEST,
                    new UsageSite(location, check.isDeclaredInLambda(), LanguageBag.EMPTY)));
        }
    }

    /** {@code java.lang.Object} as ArchUnit knows it: the top of any parsed class's superclass chain, with its members imported. */
    private JavaClass objectClass(JavaClasses classes) {
        for (JavaClass type : classes) {
            if (type.isInterface()) continue;
            JavaClass current = type;
            while (current.getRawSuperclass().isPresent()) current = current.getRawSuperclass().get();
            if (current.getName().equals("java.lang.Object")) return c.fullyImported(current);
        }
        return null;
    }

    /** An array's {@code clone()} is called on the array type, which declares nothing; the model binds it to the {@code Object} method it overrides. */
    private Optional<JavaMethod> arrayMemberTarget(JavaMethodCall call) {
        if (object == null) return Optional.empty();
        return object.getMethods().stream()
                .filter(method -> method.getName().equals(call.getTarget().getName()) && method.getRawParameterTypes().size() == call.getTarget().getRawParameterTypes().size())
                .findFirst();
    }

    /** {@code this(...)} targets the own class, {@code super(...)} the superclass; {@code new} has no receiver. */
    private static ExpressionKind constructorReceiver(JavaCodeUnit origin, JavaConstructorCall call) {
        if (!(origin instanceof JavaConstructor)) return null;
        JavaClass owner = origin.getOwner();
        JavaClass targetOwner = call.getTargetOwner();
        if (targetOwner.equals(owner)) return ExpressionKind.THIS;
        if (owner.getRawSuperclass().map(targetOwner::equals).orElse(false)) return ExpressionKind.BASE;
        return null;
    }

    private NodeId unresolved(AccessTarget.CodeUnitCallTarget target) {
        return c.ids.unresolvedMethod(target.getOwner(), target.getName(), target.getRawParameterTypes());
    }

    private UsageSite site(JavaAccess<?> access, JavaClass type) {
        SourceSpan location = c.lineOf(type, access.getLineNumber());
        if (location == null) location = new SourceSpan("", access.getLineNumber(), 0, access.getLineNumber(), 0);
        return new UsageSite(location, access.isDeclaredInLambda(), LanguageBag.EMPTY);
    }
}
