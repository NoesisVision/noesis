package vision.noesis.parser.core.bytecode;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaCodeUnit;
import com.tngtech.archunit.core.domain.JavaConstructor;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.core.domain.JavaMember;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaMethodCall;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.core.domain.JavaPackage;
import com.tngtech.archunit.core.domain.JavaParameterizedType;
import com.tngtech.archunit.core.domain.JavaType;
import com.tngtech.archunit.core.domain.JavaTypeVariable;
import com.tngtech.archunit.core.domain.ThrowsDeclaration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import vision.noesis.parser.core.java.JavaIds;
import vision.noesis.parser.core.java.JavaModifiers;
import vision.noesis.parser.core.java.Literals;
import vision.noesis.parser.core.java.MemberFlags;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.FieldKind;
import vision.noesis.parser.model.FieldNode;
import vision.noesis.parser.model.LanguageBag;
import vision.noesis.parser.model.MethodKind;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.NamespaceNode;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.Origin;
import vision.noesis.parser.model.Parameter;
import vision.noesis.parser.model.Passing;
import vision.noesis.parser.model.Signature;
import vision.noesis.parser.model.SourceSpan;
import vision.noesis.parser.model.TypeKind;
import vision.noesis.parser.model.TypeNode;
import vision.noesis.parser.model.TypeParameter;
import vision.noesis.parser.model.TypeParameterConstraint;
import vision.noesis.parser.model.TypeRef;
import vision.noesis.parser.model.Variance;
import vision.noesis.parser.model.Visibility;

/** Walks the imported classes into nodes and structural edges, mirroring the source engine's declaration pass. */
final class BytecodeDeclarations {

    private final BytecodeContext c;
    private final Set<NodeId> namespaces = new HashSet<>();
    private final Map<NodeId, JavaPackage> packagesById = new LinkedHashMap<>();

    BytecodeDeclarations(BytecodeContext context) {
        this.c = context;
    }

    void walk(JavaClasses classes) {
        List<JavaClass> parsed = new ArrayList<>();
        for (JavaClass type : classes) {
            if (c.isParsed(type) && !type.getModifiers().contains(JavaModifier.SYNTHETIC)) parsed.add(type);
        }
        parsed.sort(Comparator.comparing(JavaClass::getName));
        for (JavaClass type : parsed) {
            NodeId namespaceId = ensureNamespace(type.getPackageName(), type.getPackage());
            NodeId typeId = emitType(type);
            if (type.isTopLevelClass()) c.builder.edge(new Edge.Contains(namespaceId, typeId));
            else type.getEnclosingClass().ifPresent(outer -> c.builder.edge(new Edge.Contains(c.ids.type(outer), typeId)));
        }
        emitNamespaces();
    }

    // --- Namespaces --------------------------------------------------------------------------------------------------

    private NodeId ensureNamespace(String dotted, JavaPackage pkg) {
        NodeId id = JavaIds.namespace(dotted);
        if (pkg != null) packagesById.putIfAbsent(id, pkg);
        if (!namespaces.add(id)) return id;
        if (!dotted.isEmpty()) {
            int dot = dotted.lastIndexOf('.');
            NodeId parent = ensureNamespace(dot < 0 ? "" : dotted.substring(0, dot), pkg == null ? null : pkg.getParent().orElse(null));
            c.builder.edge(new Edge.Contains(parent, id));
        }
        return id;
    }

    private void emitNamespaces() {
        ensureNamespace("", null);
        for (NodeId id : namespaces) {
            String dotted = id.canonicalPath();
            int dot = dotted.lastIndexOf('.');
            JavaPackage pkg = packagesById.get(id);
            c.builder.node(new NamespaceNode(
                    id,
                    dot < 0 ? dotted : dotted.substring(dot + 1),
                    Origin.DECLARED,
                    List.of(),
                    pkg == null || dotted.isEmpty() ? List.of() : c.annotations.of(pkg.getAnnotations()),
                    null,
                    LanguageBag.EMPTY));
        }
        c.builder.edge(new Edge.Contains(c.artifactId, JavaIds.namespace("")));
    }

    // --- Types -------------------------------------------------------------------------------------------------------

    private NodeId emitType(JavaClass type) {
        NodeId id = c.ids.type(type);
        MemberFlags flags = flagsOf(type.getModifiers(), type.isTopLevelClass(), isImplicitlyStatic(type));
        TypeKind kind = typeKindOf(type);
        boolean local = type.isLocalClass() || type.isAnonymousClass();
        c.builder.node(new TypeNode(
                id,
                c.ids.nodeName(type),
                Origin.DECLARED,
                spans(type),
                c.annotations.of(type.getAnnotations()),
                null,
                LanguageBag.of(typeBag(type)),
                kind,
                local ? Visibility.PRIVATE : JavaModifiers.visibility(flags),
                JavaModifiers.type(flags, kind, type.isRecord()),
                typeParameters(type.getTypeParameters(), type),
                null,
                null,
                null));
        addBaseEdges(type, id);
        Set<String> componentNames = recordComponentNames(type);
        List<JavaMember> members = new ArrayList<>();
        members.addAll(type.getFields());
        members.addAll(type.getConstructors());
        members.addAll(type.getMethods());
        members.sort(Comparator.comparing(JavaMember::getName).thenComparing(JavaMember::getDescriptor));
        for (JavaMember member : members) {
            if (isSynthetic(member)) continue;
            NodeId memberId = member instanceof JavaField field ? emitField(field, type, componentNames) : emitCodeUnit((JavaCodeUnit) member, type, componentNames);
            if (memberId != null) c.builder.edge(new Edge.Contains(id, memberId));
        }
        type.getStaticInitializer().ifPresent(initializer -> {
            NodeId initializerId = emitStaticInitializer(type);
            c.builder.edge(new Edge.Contains(id, initializerId));
        });
        addInterfaceMemberEdges(type, id);
        return id;
    }

    static boolean isSynthetic(JavaMember member) {
        return member.getModifiers().contains(JavaModifier.SYNTHETIC) || member.getModifiers().contains(JavaModifier.BRIDGE);
    }

    private Map<String, Object> typeBag(JavaClass type) {
        Map<String, Object> bag = new LinkedHashMap<>();
        if (type.isAnnotation()) bag.put("java.isAnnotation", true);
        if (type.isSealed()) {
            List<String> permits = new ArrayList<>();
            type.getPermittedSubclasses().ifPresent(permitted -> {
                for (JavaClass subclass : permitted) permits.add(c.types.of(subclass).canonical());
            });
            bag.put("java.permits", permits);
        }
        if (type.isLocalClass()) bag.put("java.isLocal", true);
        if (type.isAnonymousClass()) bag.put("java.isAnonymous", true);
        if (type.isLocalClass() || type.isAnonymousClass()) {
            type.getEnclosingCodeUnit().ifPresent(unit -> bag.put("java.enclosingMethod", c.ids.member(unit).value()));
        }
        return bag;
    }

    static TypeKind typeKindOf(JavaClass type) {
        if (type.isInterface() || type.isAnnotation()) return TypeKind.INTERFACE;
        if (!type.isFullyImported() && type.isInterface()) return TypeKind.INTERFACE;
        if (type.isEnum()) return TypeKind.ENUM;
        return TypeKind.CLASS;
    }

    private void addBaseEdges(JavaClass type, NodeId id) {
        Optional<JavaType> superclass = type.getSuperclass();
        if (superclass.isPresent() && !isObject(superclass.get())) c.builder.edge(new Edge.Extends(id, c.types.of(superclass.get(), BytecodeTypeRefs.Scope.of(type))));
        for (JavaType implemented : sortedInterfaces(type)) {
            TypeRef reference = c.types.of(implemented, BytecodeTypeRefs.Scope.of(type));
            c.builder.edge(type.isInterface() ? new Edge.Extends(id, reference) : new Edge.Implements(id, reference));
        }
    }

    static List<JavaType> sortedInterfaces(JavaClass type) {
        List<JavaType> interfaces = new ArrayList<>(type.getInterfaces());
        interfaces.sort(Comparator.comparing(JavaType::getName));
        return interfaces;
    }

    static boolean isObject(JavaType type) {
        return type.toErasure().getName().equals("java.lang.Object");
    }

    private static Set<String> recordComponentNames(JavaClass type) {
        Set<String> names = new HashSet<>();
        if (!type.isRecord()) return names;
        for (JavaField field : type.getFields()) {
            if (!field.getModifiers().contains(JavaModifier.STATIC) && !isSynthetic(field)) names.add(field.getName());
        }
        return names;
    }

    // --- Members -----------------------------------------------------------------------------------------------------

    NodeId emitCodeUnit(JavaCodeUnit unit, JavaClass owner, Set<String> componentNames) {
        NodeId id = c.ids.member(unit);
        if (c.builder.hasNode(id)) return null;
        MemberFlags flags = flagsOf(unit.getModifiers());
        boolean constructor = unit instanceof JavaConstructor;
        boolean generated = isImplicitEnumMethod(unit, owner);
        c.builder.node(new MethodNode(
                id,
                BytecodeIds.nodeName(unit),
                generated ? Origin.GENERATED : Origin.DECLARED,
                generated ? List.of() : spans(owner, unit.getSourceCodeLocation().getLineNumber()),
                c.annotations.of(unit.getAnnotations()),
                null,
                LanguageBag.of(codeUnitBag(unit, flags, owner, componentNames)),
                constructor ? MethodKind.CONSTRUCTOR : MethodKind.METHOD,
                JavaModifiers.visibility(flags),
                JavaModifiers.method(flags, constructor),
                typeParameters(unit.getTypeParameters(), null),
                signature(unit, owner),
                null,
                flags.isAbstract() || flags.isNative()));
        if (!constructor && !flags.isStatic() && !flags.isPrivate()) addOverridesEdge((JavaMethod) unit, owner, id);
        return id;
    }

    /** {@code values()} and {@code valueOf(String)} the compiler declares for every enum. */
    private static boolean isImplicitEnumMethod(JavaCodeUnit unit, JavaClass owner) {
        if (!owner.isEnum() || !unit.getModifiers().contains(JavaModifier.STATIC)) return false;
        if (unit.getName().equals("values") && unit.getRawParameterTypes().isEmpty()) return true;
        return unit.getName().equals("valueOf") && unit.getRawParameterTypes().size() == 1 && unit.getRawParameterTypes().get(0).getName().equals("java.lang.String");
    }

    private Map<String, Object> codeUnitBag(JavaCodeUnit unit, MemberFlags flags, JavaClass owner, Set<String> componentNames) {
        Map<String, Object> bag = new LinkedHashMap<>();
        if (unit.getThrowsClause().size() > 0) {
            List<String> thrown = new ArrayList<>();
            for (ThrowsDeclaration<?> declaration : unit.getThrowsClause()) thrown.add(c.types.of(declaration.getType(), BytecodeTypeRefs.Scope.of(unit)).canonical());
            bag.put("java.throws", thrown);
        }
        if (flags.isSynchronized()) bag.put("java.synchronized", true);
        if (unit instanceof JavaMethod method) {
            if (owner.isRecord() && !flags.isStatic() && method.getRawParameterTypes().isEmpty() && componentNames.contains(method.getName())) {
                bag.put("java.isRecordComponent", true);
            }
            if (owner.isAnnotation()) method.getDefaultValue().ifPresent(value -> bag.put("java.defaultValue", vision.noesis.parser.core.java.AnnotationValues.text(c.annotations.valueOf(value))));
        }
        return bag;
    }

    private Signature signature(JavaCodeUnit unit, JavaClass owner) {
        ClassFileDetails.MethodDetails details = c.details.method(owner.getName(), unit.getName(), unit.getDescriptor());
        List<BytecodeIds.DeclaredParameter> declared = c.ids.declaredParameters(unit);
        List<Parameter> parameters = new ArrayList<>();
        for (int i = 0; i < declared.size(); i++) {
            BytecodeIds.DeclaredParameter parameter = declared.get(i);
            String name = details != null && details.parameterNames() != null ? details.parameterNames().get(parameter.rawIndex()) : "arg" + i;
            parameters.add(new Parameter(
                    name,
                    c.types.of(parameter.type(), BytecodeTypeRefs.Scope.of(unit)),
                    Passing.VALUE,
                    details != null && details.varargs() && i == declared.size() - 1,
                    false,
                    null,
                    c.annotations.of(parameter.parameter().getAnnotations()),
                    LanguageBag.EMPTY));
        }
        return new Signature(parameters, c.types.of(unit.getReturnType(), BytecodeTypeRefs.Scope.of(unit)), Passing.VALUE, List.of());
    }

    /** The scope a type parameter's bounds are read in: its own declaration. */
    private static BytecodeTypeRefs.Scope scopeOf(JavaTypeVariable<?> variable) {
        Object owner = variable.getOwner();
        if (owner instanceof JavaCodeUnit unit) return BytecodeTypeRefs.Scope.of(unit);
        if (owner instanceof JavaClass type) return BytecodeTypeRefs.Scope.of(type);
        return BytecodeTypeRefs.Scope.NONE;
    }

    private List<TypeParameter> typeParameters(List<? extends JavaTypeVariable<?>> declared, JavaClass owner) {
        List<TypeParameter> parameters = new ArrayList<>();
        int offset = owner == null ? 0 : BytecodeTypeRefs.innerOffset(owner);
        for (int i = 0; i < declared.size(); i++) {
            JavaTypeVariable<?> variable = declared.get(i);
            List<TypeParameterConstraint> constraints = new ArrayList<>();
            for (JavaType bound : variable.getBounds()) {
                if (bound instanceof JavaClass bare && bare.getName().equals("java.lang.Object")) continue;
                constraints.add(new TypeParameterConstraint.TypeConstraint(c.types.of(bound, scopeOf(variable))));
            }
            parameters.add(new TypeParameter(variable.getName(), offset + i, List.of(), Variance.INVARIANT, constraints, LanguageBag.EMPTY));
        }
        return parameters;
    }

    private NodeId emitField(JavaField field, JavaClass owner, Set<String> componentNames) {
        NodeId id = c.ids.member(field);
        if (c.builder.hasNode(id)) return null;
        MemberFlags flags = flagsOf(field.getModifiers());
        Map<String, Object> bag = new LinkedHashMap<>();
        if (flags.isTransient()) bag.put("java.transient", true);
        if (owner.isRecord() && !flags.isStatic() && componentNames.contains(field.getName())) bag.put("java.isRecordComponent", true);
        boolean enumConstant = field.getModifiers().contains(JavaModifier.ENUM);
        Object constant = typedConstant(c.details.constant(owner.getName(), field.getName()), field.getRawType().getName());
        c.builder.node(new FieldNode(
                id,
                field.getName(),
                Origin.DECLARED,
                spans(owner, 0),
                c.annotations.of(field.getAnnotations()),
                null,
                LanguageBag.of(bag),
                enumConstant ? FieldKind.ENUM_MEMBER : FieldKind.FIELD,
                JavaModifiers.visibility(flags),
                JavaModifiers.field(flags),
                c.types.of(field.getType(), BytecodeTypeRefs.Scope.of(owner)),
                Passing.VALUE,
                constant == null ? null : Literals.format(constant)));
        return id;
    }

    /** The class file stores booleans, chars, bytes and shorts as ints. */
    static Object typedConstant(Object value, String typeName) {
        if (!(value instanceof Integer number)) return value;
        switch (typeName) {
            case "boolean": return number != 0;
            case "char": return (char) number.intValue();
            case "byte": return (byte) number.intValue();
            case "short": return (short) number.intValue();
            default: return value;
        }
    }

    private NodeId emitStaticInitializer(JavaClass type) {
        NodeId id = c.ids.staticInitializer(type);
        c.builder.node(new MethodNode(
                id,
                JavaIds.STATIC_INITIALIZER_NAME,
                Origin.DECLARED,
                spans(type, type.getStaticInitializer().map(initializer -> initializer.getSourceCodeLocation().getLineNumber()).orElse(0)),
                List.of(),
                null,
                LanguageBag.EMPTY,
                MethodKind.STATIC_INITIALIZER,
                Visibility.PRIVATE,
                List.of(vision.noesis.parser.model.Modifier.STATIC),
                List.of(),
                new Signature(List.of(), new TypeRef.Void(), Passing.VALUE, List.of()),
                null,
                false));
        return id;
    }

    // --- Edges -------------------------------------------------------------------------------------------------------

    /** The nearest method up the superclass chain with the same erased signature; a bridge tells where a generic override lands. */
    private void addOverridesEdge(JavaMethod method, JavaClass owner, NodeId id) {
        for (String erasure : erasuresOf(method, owner)) {
            for (JavaClass superclass = owner.getRawSuperclass().orElse(null); superclass != null; superclass = superclass.getRawSuperclass().orElse(null)) {
                JavaMethod overridden = methodWithErasure(superclass, erasure);
                if (overridden != null) {
                    c.builder.edge(new Edge.Overrides(id, c.ids.member(overridden)));
                    return;
                }
            }
        }
    }

    /** The method's own erased signature plus those of the bridges that delegate to it. */
    private static List<String> erasuresOf(JavaMethod method, JavaClass owner) {
        List<String> erasures = new ArrayList<>();
        erasures.add(erasureOf(method));
        for (JavaMethod candidate : owner.getMethods()) {
            if (!candidate.getModifiers().contains(JavaModifier.BRIDGE)) continue;
            for (JavaMethodCall call : candidate.getMethodCallsFromSelf()) {
                if (call.getTarget().resolveMember().map(method::equals).orElse(false)) erasures.add(erasureOf(candidate));
            }
        }
        return erasures;
    }

    static String erasureOf(JavaCodeUnit unit) {
        StringBuilder text = new StringBuilder(unit.getName()).append('(');
        for (JavaClass parameter : unit.getRawParameterTypes()) text.append(parameter.getName()).append(',');
        return text.append(')').toString();
    }

    private static JavaMethod methodWithErasure(JavaClass type, String erasure) {
        for (JavaMethod candidate : type.getMethods()) {
            if (candidate.getModifiers().contains(JavaModifier.PRIVATE) || candidate.getModifiers().contains(JavaModifier.STATIC) || isSynthetic(candidate)) continue;
            if (erasureOf(candidate).equals(erasure)) return candidate;
        }
        return null;
    }

    /** One edge per interface method the type satisfies, over every interface including inherited ones, from the method that fills the slot. */
    private void addInterfaceMemberEdges(JavaClass type, NodeId id) {
        if (type.isAnnotation()) return;
        for (Map.Entry<JavaClass, TypeRef> implemented : allInterfaces(type).entrySet()) {
            JavaClass interfaceClass = implemented.getKey();
            List<JavaMethod> slots = new ArrayList<>(interfaceClass.getMethods());
            slots.sort(Comparator.comparing(JavaMethod::getName).thenComparing(JavaMethod::getDescriptor));
            for (JavaMethod slot : slots) {
                if (slot.getModifiers().contains(JavaModifier.STATIC) || slot.getModifiers().contains(JavaModifier.PRIVATE) || isSynthetic(slot)) continue;
                JavaMethod implementation = implementationOf(slot, type);
                if (implementation == null) continue;
                c.builder.edge(new Edge.ImplementsMember(c.ids.member(implementation), c.ids.member(slot), implemented.getValue(), id));
            }
        }
    }

    /** Every interface in the transitive supertype closure, with the type arguments the subtype's instantiation gives it. */
    private Map<JavaClass, TypeRef> allInterfaces(JavaClass type) {
        Map<JavaClass, TypeRef> interfaces = new LinkedHashMap<>();
        Set<String> seen = new HashSet<>();
        collectInterfaces(type, Map.of(), interfaces, seen);
        return interfaces;
    }

    private void collectInterfaces(JavaClass type, Map<String, TypeRef> environment, Map<JavaClass, TypeRef> interfaces, Set<String> seen) {
        List<JavaType> supertypes = new ArrayList<>();
        type.getSuperclass().ifPresent(supertypes::add);
        supertypes.addAll(sortedInterfaces(type));
        for (JavaType supertype : supertypes) {
            JavaClass erasure = c.fullyImported(supertype.toErasure());
            TypeRef reference = c.types.of(supertype, false, environment, BytecodeTypeRefs.Scope.of(type));
            if (!seen.add(reference.canonical())) continue;
            if (erasure.isInterface()) interfaces.put(erasure, reference);
            collectInterfaces(erasure, bindingsOf(supertype, erasure, environment, type), interfaces, seen);
        }
    }

    /** The supertype's type parameters bound to the arguments the subtype passes, resolved in the subtype's own environment. */
    private Map<String, TypeRef> bindingsOf(JavaType supertype, JavaClass erasure, Map<String, TypeRef> environment, JavaClass subtype) {
        Map<String, TypeRef> bindings = new HashMap<>();
        if (!(supertype instanceof JavaParameterizedType parameterized)) return bindings;
        List<JavaType> arguments = parameterized.getActualTypeArguments();
        List<JavaTypeVariable<JavaClass>> parameters = erasure.getTypeParameters();
        for (int i = 0; i < parameters.size() && i < arguments.size(); i++) {
            bindings.put(BytecodeTypeRefs.variableKey(parameters.get(i)), c.types.of(arguments.get(i), false, environment, BytecodeTypeRefs.Scope.of(subtype)));
        }
        return bindings;
    }

    /** The method of the type or its superclasses with the slot's erased signature, or the one a bridge of that signature delegates to. */
    private static JavaMethod implementationOf(JavaMethod slot, JavaClass type) {
        String erasure = erasureOf(slot);
        for (JavaClass current = type; current != null; current = type.isInterface() ? null : current.getRawSuperclass().orElse(null)) {
            for (JavaMethod candidate : current.getMethods()) {
                if (candidate.getModifiers().contains(JavaModifier.STATIC) || !erasureOf(candidate).equals(erasure)) continue;
                if (candidate.equals(slot)) return null;
                if (!candidate.getModifiers().contains(JavaModifier.BRIDGE)) return candidate;
                JavaMethod delegate = bridgeTarget(candidate, current);
                if (delegate != null) return delegate;
            }
        }
        return null;
    }

    /**
     * The method a bridge delegates to: its one call into the same class, or, when ArchUnit imported no calls for the
     * class (a classpath class), the one non-bridge method of the same name and arity.
     */
    private static JavaMethod bridgeTarget(JavaMethod bridge, JavaClass owner) {
        for (JavaMethodCall call : bridge.getMethodCallsFromSelf()) {
            Optional<JavaMethod> target = call.getTarget().resolveMember();
            if (target.isPresent() && target.get().getOwner().equals(owner)) return target.get();
        }
        JavaMethod found = null;
        for (JavaMethod candidate : owner.getMethods()) {
            if (isSynthetic(candidate) || !candidate.getName().equals(bridge.getName()) || candidate.getRawParameterTypes().size() != bridge.getRawParameterTypes().size()) continue;
            if (found != null) return null;
            found = candidate;
        }
        return found;
    }

    // --- Reading the class files -------------------------------------------------------------------------------------

    static MemberFlags flagsOf(Set<JavaModifier> modifiers) {
        return flagsOf(modifiers, false, false);
    }

    /** A nested or local enum, interface, record or annotation is static whether or not the class file says so (JLS 8.5.1, 14.3). */
    private static boolean isImplicitlyStatic(JavaClass type) {
        return !type.isTopLevelClass() && !type.isAnonymousClass() && (type.isEnum() || type.isInterface() || type.isRecord() || type.isAnnotation());
    }

    /** A top-level class is never static, whatever ArchUnit reads off its access flags. */
    static MemberFlags flagsOf(Set<JavaModifier> modifiers, boolean topLevel, boolean implicitlyStatic) {
        return MemberFlags.builder()
                .isPublic(modifiers.contains(JavaModifier.PUBLIC))
                .isProtected(modifiers.contains(JavaModifier.PROTECTED))
                .isPrivate(modifiers.contains(JavaModifier.PRIVATE))
                .isStatic((modifiers.contains(JavaModifier.STATIC) || implicitlyStatic) && !topLevel)
                .isAbstract(modifiers.contains(JavaModifier.ABSTRACT))
                .isFinal(modifiers.contains(JavaModifier.FINAL))
                .isNative(modifiers.contains(JavaModifier.NATIVE))
                .isSynchronized(modifiers.contains(JavaModifier.SYNCHRONIZED))
                .isVolatile(modifiers.contains(JavaModifier.VOLATILE))
                .isTransient(modifiers.contains(JavaModifier.TRANSIENT))
                .build();
    }

    private List<SourceSpan> spans(JavaClass type) {
        return spans(type, 0);
    }

    private List<SourceSpan> spans(JavaClass type, int line) {
        SourceSpan span = c.lineOf(type, line);
        return span == null ? List.of() : List.of(span);
    }
}
