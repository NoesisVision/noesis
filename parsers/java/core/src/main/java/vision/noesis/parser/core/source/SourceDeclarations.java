package vision.noesis.parser.core.source;

import com.sun.source.tree.BlockTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePath;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.NestingKind;
import javax.lang.model.element.PackageElement;
import javax.lang.model.element.RecordComponentElement;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.TypeParameterElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.IntersectionType;
import javax.lang.model.type.TypeKind;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.util.ElementFilter;
import javax.lang.model.util.Elements;
import vision.noesis.parser.core.Diagnostics;
import vision.noesis.parser.core.java.JavaModifiers;
import vision.noesis.parser.core.java.Literals;
import vision.noesis.parser.core.java.MemberFlags;
import vision.noesis.parser.model.Annotation;
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
import vision.noesis.parser.model.TypeNode;
import vision.noesis.parser.model.TypeParameter;
import vision.noesis.parser.model.TypeParameterConstraint;
import vision.noesis.parser.model.TypeRef;
import vision.noesis.parser.model.Variance;
import vision.noesis.parser.model.Visibility;

/**
 * Walks the compilation's elements into nodes and structural edges: namespaces, types, members, CONTAINS, EXTENDS,
 * IMPLEMENTS, OVERRIDES and IMPLEMENTS_MEMBER. Bodies are the body parser's job, which hands local and anonymous
 * classes back here.
 */
final class SourceDeclarations {

    private final SourceContext c;
    private final Elements elements;
    private final Map<NodeId, NamespaceLevel> namespaces = new LinkedHashMap<>();
    private final Set<NodeId> emittedTypes = new HashSet<>();
    /** The method each id was emitted for, to tell the same method met again from another that shares its id. */
    private final Map<NodeId, ExecutableElement> emittedMethods = new HashMap<>();

    /** A namespace level: its name, every package clause that names it, its package-info annotations. */
    private static final class NamespaceLevel {
        final String dottedName;
        final String name;
        final Set<SourceSpan> locations = new LinkedHashSet<>();

        NamespaceLevel(String dottedName) {
            this.dottedName = dottedName;
            int dot = dottedName.lastIndexOf('.');
            this.name = dot < 0 ? dottedName : dottedName.substring(dot + 1);
        }
    }

    SourceDeclarations(SourceContext context) {
        this.c = context;
        this.elements = context.javac.elements();
        namespaces.put(vision.noesis.parser.core.java.JavaIds.namespace(""), new NamespaceLevel(""));
    }

    // --- Namespaces --------------------------------------------------------------------------------------------------

    /** The unit's types and their members, in the namespace {@link #namespaceOf} declared for the unit. */
    void walkTypes(CompilationUnitTree unit, NodeId namespaceId) {
        for (Tree declaration : unit.getTypeDecls()) {
            if (!(declaration instanceof ClassTree)) continue;
            TreePath path = new TreePath(new TreePath(unit), declaration);
            Element element = c.javac.trees().getElement(path);
            if (element instanceof TypeElement type) {
                NodeId typeId = emitType(type, null);
                if (typeId != null) c.builder.edge(new Edge.Contains(namespaceId, typeId));
            }
        }
    }

    /**
     * Every level the package clause names gets a node and the span of its prefix. Separate from {@link #walkTypes}, so
     * a unit whose types fail still leaves the namespace other units of the package share.
     */
    NodeId namespaceOf(CompilationUnitTree unit) {
        ExpressionTree packageName = unit.getPackageName();
        String dotted = packageName == null ? "" : packageName.toString();
        NodeId id = ensureNamespace(dotted);
        for (ExpressionTree level = packageName; level != null; level = level instanceof MemberSelectTree select ? select.getExpression() : null) {
            NamespaceLevel entry = namespaces.get(vision.noesis.parser.core.java.JavaIds.namespace(level.toString()));
            SourceSpan span = c.locations.spanOf(unit, level);
            if (entry != null && span != null) entry.locations.add(span);
        }
        return id;
    }

    private NodeId ensureNamespace(String dotted) {
        NodeId id = vision.noesis.parser.core.java.JavaIds.namespace(dotted);
        if (namespaces.containsKey(id)) return id;
        namespaces.put(id, new NamespaceLevel(dotted));
        int dot = dotted.lastIndexOf('.');
        NodeId parent = ensureNamespace(dot < 0 ? "" : dotted.substring(0, dot));
        c.builder.edge(new Edge.Contains(parent, id));
        return id;
    }

    void emitNamespaces(NodeId artifactId) {
        for (Map.Entry<NodeId, NamespaceLevel> entry : namespaces.entrySet()) {
            NamespaceLevel level = entry.getValue();
            PackageElement pkg = level.dottedName.isEmpty() ? null : elements.getPackageElement(level.dottedName);
            List<SourceSpan> locations = new ArrayList<>(level.locations);
            locations.sort(null);
            c.builder.node(new NamespaceNode(
                    entry.getKey(),
                    level.name,
                    Origin.DECLARED,
                    locations,
                    pkg == null ? List.of() : c.annotations.of(pkg),
                    pkg == null ? null : Javadoc.of(c, c.javac.trees().getPath(pkg)),
                    LanguageBag.EMPTY));
        }
        c.builder.edge(new Edge.Contains(artifactId, vision.noesis.parser.core.java.JavaIds.namespace("")));
    }

    // --- Types -------------------------------------------------------------------------------------------------------

    /**
     * The type, its members and their structural edges; {@code enclosingMethod} is set for local and anonymous classes.
     * @return the type's id, or null when it was emitted before
     */
    NodeId emitType(TypeElement type, NodeId enclosingMethod) {
        NodeId id = c.ids.type(type);
        if (!emittedTypes.add(id)) return null;
        ClassTree tree = c.javac.trees().getTree(type);
        TreePath path = c.javac.trees().getPath(type);
        CompilationUnitTree unit = path == null ? null : path.getCompilationUnit();
        MemberFlags flags = flagsOf(type);
        vision.noesis.parser.model.TypeKind kind = typeKindOf(type);
        boolean local = type.getNestingKind() == NestingKind.LOCAL || type.getNestingKind() == NestingKind.ANONYMOUS;
        c.builder.node(new TypeNode(
                id,
                c.ids.nodeName(type),
                originOf(unit),
                spans(unit, tree),
                c.annotations.of(type),
                Javadoc.of(c, path),
                LanguageBag.of(typeBag(type, flags, enclosingMethod)),
                kind,
                local ? Visibility.PRIVATE : JavaModifiers.visibility(flags),
                JavaModifiers.type(flags, kind, type.getKind() == ElementKind.RECORD),
                typeParameters(type.getTypeParameters()),
                null,
                null,
                null));
        addBaseEdges(type, id);
        Set<String> componentNames = recordComponentNames(type);
        for (Element member : type.getEnclosedElements()) {
            NodeId memberId = null;
            if (member instanceof TypeElement nested) memberId = emitType(nested, null);
            else if (member instanceof ExecutableElement method) memberId = emitMethod(method, type, componentNames);
            else if (member instanceof VariableElement field && isField(field)) memberId = emitField(field, type, componentNames);
            if (memberId != null) c.builder.edge(new Edge.Contains(id, memberId));
        }
        if (unit != null && tree != null) emitStaticInitializer(type, id, unit, tree);
        addInterfaceMemberEdges(type, id);
        return id;
    }

    private static boolean isField(VariableElement element) {
        return element.getKind() == ElementKind.FIELD || element.getKind() == ElementKind.ENUM_CONSTANT;
    }

    private Map<String, Object> typeBag(TypeElement type, MemberFlags flags, NodeId enclosingMethod) {
        Map<String, Object> bag = new LinkedHashMap<>();
        if (type.getKind() == ElementKind.ANNOTATION_TYPE) bag.put("java.isAnnotation", true);
        if (flags.isStrictfp()) bag.put("java.strictfp", true);
        if (flags.isSealed()) {
            List<String> permits = new ArrayList<>();
            for (TypeMirror permitted : type.getPermittedSubclasses()) permits.add(c.types.of(permitted).canonical());
            bag.put("java.permits", permits);
        }
        if (flags.isNonSealed()) bag.put("java.nonSealed", true);
        if (type.getNestingKind() == NestingKind.LOCAL) bag.put("java.isLocal", true);
        if (type.getNestingKind() == NestingKind.ANONYMOUS) bag.put("java.isAnonymous", true);
        if (enclosingMethod != null) bag.put("java.enclosingMethod", enclosingMethod.value());
        return bag;
    }

    static vision.noesis.parser.model.TypeKind typeKindOf(TypeElement type) {
        switch (type.getKind()) {
            case INTERFACE: case ANNOTATION_TYPE: return vision.noesis.parser.model.TypeKind.INTERFACE;
            case ENUM: return vision.noesis.parser.model.TypeKind.ENUM;
            default: return vision.noesis.parser.model.TypeKind.CLASS;
        }
    }

    private void addBaseEdges(TypeElement type, NodeId id) {
        TypeMirror superclass = type.getSuperclass();
        // A superclass javac could not bind is an error type: unresolved, as a missing interface is.
        if (superclass.getKind() == TypeKind.ERROR || superclass.getKind() == TypeKind.DECLARED && !isObject(superclass)) {
            c.builder.edge(new Edge.Extends(id, c.types.of(superclass)));
        }
        boolean isInterface = type.getKind().isInterface();
        for (TypeMirror implemented : type.getInterfaces()) {
            TypeRef reference = c.types.of(implemented);
            c.builder.edge(isInterface ? new Edge.Extends(id, reference) : new Edge.Implements(id, reference));
        }
    }

    static boolean isObject(TypeMirror type) {
        return type.getKind() == TypeKind.DECLARED && ((TypeElement) ((DeclaredType) type).asElement()).getQualifiedName().contentEquals("java.lang.Object");
    }

    private Set<String> recordComponentNames(TypeElement type) {
        Set<String> names = new HashSet<>();
        if (type.getKind() == ElementKind.RECORD) {
            for (RecordComponentElement component : type.getRecordComponents()) names.add(component.getSimpleName().toString());
        }
        return names;
    }

    // --- Members -----------------------------------------------------------------------------------------------------

    NodeId emitMethod(ExecutableElement method, TypeElement owner, Set<String> componentNames) {
        NodeId id = c.ids.member(method);
        if (c.builder.hasNode(id)) {
            ExecutableElement first = emittedMethods.get(id);
            if (first != null && !first.equals(method)) reportDuplicate(id, first, method);
            return null;
        }
        emittedMethods.put(id, method);
        TreePath path = c.javac.trees().getPath(method);
        CompilationUnitTree unit = path == null ? null : path.getCompilationUnit();
        // javac reports MANDATED for a default constructor but EXPLICIT for enum values()/valueOf() and implicit record
        // members; a member of a source type without a tree is implicit all the same.
        boolean generated = elements.getOrigin(method) != Elements.Origin.EXPLICIT || (path == null && c.javac.trees().getPath(owner) != null);
        MemberFlags flags = flagsOf(method);
        boolean constructor = method.getKind() == ElementKind.CONSTRUCTOR;
        c.builder.node(new MethodNode(
                id,
                c.ids.nodeName(method),
                generated ? Origin.GENERATED : originOf(unit),
                generated ? List.of() : spans(unit, path == null ? null : path.getLeaf()),
                c.annotations.of(method),
                Javadoc.of(c, path),
                LanguageBag.of(methodBag(method, flags, owner, componentNames)),
                constructor ? MethodKind.CONSTRUCTOR : MethodKind.METHOD,
                JavaModifiers.visibility(flags),
                JavaModifiers.method(flags, constructor),
                typeParameters(method.getTypeParameters()),
                signature(method),
                null,
                flags.isAbstract() || flags.isNative()));
        if (!constructor && !flags.isStatic() && !flags.isPrivate()) addOverridesEdge(method, owner, id);
        return id;
    }

    /**
     * Two methods the id grammar cannot tell apart, such as overloads that differ only in a type parameter's bound: the
     * first keeps the id, the second is dropped, and the drop is reported rather than silent.
     */
    private void reportDuplicate(NodeId id, ExecutableElement first, ExecutableElement second) {
        c.builder.diagnostic(Diagnostics.warning(Diagnostics.DUPLICATE_ID, "Declared twice: " + id + ", by " + describe(first) + " and " + describe(second)
                + "; the second is missing from the model.", locationOf(second)));
    }

    /** The method by its erased parameters, as the bytecode engine names it: where overloads that share an id differ. */
    private String describe(ExecutableElement method) {
        List<String> parameters = new ArrayList<>();
        for (VariableElement parameter : method.getParameters()) parameters.add(c.javac.types().erasure(parameter.asType()).toString());
        String name = ((TypeElement) method.getEnclosingElement()).getQualifiedName() + "." + method.getSimpleName() + "(" + String.join(",", parameters) + ")";
        SourceSpan location = locationOf(method);
        return location == null ? name : name + " at " + location.file() + ":" + location.startLine();
    }

    private SourceSpan locationOf(Element element) {
        TreePath path = c.javac.trees().getPath(element);
        return path == null ? null : c.locations.spanOf(path.getCompilationUnit(), path.getLeaf());
    }

    private Map<String, Object> methodBag(ExecutableElement method, MemberFlags flags, TypeElement owner, Set<String> componentNames) {
        Map<String, Object> bag = new LinkedHashMap<>();
        if (!method.getThrownTypes().isEmpty()) {
            List<String> thrown = new ArrayList<>();
            for (TypeMirror type : method.getThrownTypes()) thrown.add(c.types.of(type).canonical());
            bag.put("java.throws", thrown);
        }
        if (flags.isSynchronized()) bag.put("java.synchronized", true);
        if (flags.isStrictfp()) bag.put("java.strictfp", true);
        if (method.getKind() == ElementKind.METHOD && method.getParameters().isEmpty() && !flags.isStatic()
                && componentNames.contains(method.getSimpleName().toString())) {
            bag.put("java.isRecordComponent", true);
        }
        if (owner.getKind() == ElementKind.ANNOTATION_TYPE && method.getDefaultValue() != null) {
            bag.put("java.defaultValue", vision.noesis.parser.core.java.AnnotationValues.text(c.annotations.valueOf(method.getDefaultValue())));
        }
        return bag;
    }

    private Signature signature(ExecutableElement method) {
        List<Parameter> parameters = new ArrayList<>();
        List<? extends VariableElement> declared = method.getParameters();
        for (int i = 0; i < declared.size(); i++) {
            VariableElement parameter = declared.get(i);
            parameters.add(new Parameter(
                    parameter.getSimpleName().toString(),
                    c.types.of(parameter.asType()),
                    Passing.VALUE,
                    method.isVarArgs() && i == declared.size() - 1,
                    false,
                    null,
                    c.annotations.of(parameter),
                    LanguageBag.EMPTY));
        }
        return new Signature(parameters, c.types.of(method.getReturnType()), Passing.VALUE, c.annotations.ofType(method.getReturnType()));
    }

    List<TypeParameter> typeParameters(List<? extends TypeParameterElement> declared) {
        List<TypeParameter> parameters = new ArrayList<>();
        for (TypeParameterElement parameter : declared) {
            List<TypeParameterConstraint> constraints = new ArrayList<>();
            for (TypeMirror bound : parameter.getBounds()) {
                if (isObject(bound)) continue;
                if (bound.getKind() == TypeKind.INTERSECTION) {
                    for (TypeMirror member : ((IntersectionType) bound).getBounds()) constraints.add(new TypeParameterConstraint.TypeConstraint(c.types.of(member)));
                } else {
                    constraints.add(new TypeParameterConstraint.TypeConstraint(c.types.of(bound)));
                }
            }
            parameters.add(new TypeParameter(
                    parameter.getSimpleName().toString(),
                    SourceTypeRefs.ordinal(parameter),
                    c.annotations.of(parameter),
                    Variance.INVARIANT,
                    constraints,
                    LanguageBag.EMPTY));
        }
        return parameters;
    }

    private NodeId emitField(VariableElement field, TypeElement owner, Set<String> componentNames) {
        NodeId id = c.ids.member(field);
        if (c.builder.hasNode(id)) return null;
        TreePath path = c.javac.trees().getPath(field);
        CompilationUnitTree unit = path == null ? null : path.getCompilationUnit();
        MemberFlags flags = flagsOf(field);
        Map<String, Object> bag = new LinkedHashMap<>();
        if (flags.isTransient()) bag.put("java.transient", true);
        if (owner.getKind() == ElementKind.RECORD && !flags.isStatic() && componentNames.contains(field.getSimpleName().toString())) {
            bag.put("java.isRecordComponent", true);
        }
        boolean enumConstant = field.getKind() == ElementKind.ENUM_CONSTANT;
        Object constant = field.getConstantValue();
        c.builder.node(new FieldNode(
                id,
                field.getSimpleName().toString(),
                originOf(unit),
                spans(unit, path == null ? null : path.getLeaf()),
                c.annotations.of(field),
                Javadoc.of(c, path),
                LanguageBag.of(bag),
                enumConstant ? FieldKind.ENUM_MEMBER : FieldKind.FIELD,
                JavaModifiers.visibility(flags),
                JavaModifiers.field(flags),
                c.types.of(field.asType()),
                Passing.VALUE,
                constant == null ? null : Literals.format(constant)));
        return id;
    }

    /** One {@code .cctor} node per type with static initializer blocks, located at each block. */
    private void emitStaticInitializer(TypeElement type, NodeId typeId, CompilationUnitTree unit, ClassTree tree) {
        List<SourceSpan> locations = new ArrayList<>();
        for (Tree member : tree.getMembers()) {
            if (member instanceof BlockTree block && block.isStatic()) {
                SourceSpan span = c.locations.spanOf(unit, block);
                if (span != null) locations.add(span);
            }
        }
        if (locations.isEmpty()) return;
        NodeId id = c.ids.staticInitializer(type);
        c.builder.node(new MethodNode(
                id,
                vision.noesis.parser.core.java.JavaIds.STATIC_INITIALIZER_NAME,
                Origin.DECLARED,
                locations,
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
        c.builder.edge(new Edge.Contains(typeId, id));
    }

    // --- Edges -------------------------------------------------------------------------------------------------------

    /** The nearest method up the superclass chain this one overrides; interfaces are IMPLEMENTS_MEMBER's business. */
    private void addOverridesEdge(ExecutableElement method, TypeElement owner, NodeId id) {
        for (TypeElement superclass = superclassOf(owner); superclass != null; superclass = superclassOf(superclass)) {
            for (ExecutableElement candidate : ElementFilter.methodsIn(superclass.getEnclosedElements())) {
                if (candidate.getModifiers().contains(Modifier.PRIVATE) || candidate.getModifiers().contains(Modifier.STATIC)) continue;
                if (elements.overrides(method, candidate, owner)) {
                    c.builder.edge(new Edge.Overrides(id, c.ids.member(candidate)));
                    return;
                }
            }
        }
    }

    static TypeElement superclassOf(TypeElement type) {
        TypeMirror superclass = type.getSuperclass();
        return superclass.getKind() == TypeKind.DECLARED ? (TypeElement) ((DeclaredType) superclass).asElement() : null;
    }

    /** One edge per interface method the type satisfies, over every interface including inherited ones, from the method that fills the slot. */
    private void addInterfaceMemberEdges(TypeElement type, NodeId id) {
        if (type.getKind() == ElementKind.ANNOTATION_TYPE) return;
        for (DeclaredType implemented : allInterfaces(type)) {
            TypeElement interfaceElement = (TypeElement) implemented.asElement();
            TypeRef interfaceRef = c.types.of(implemented);
            for (ExecutableElement slot : ElementFilter.methodsIn(interfaceElement.getEnclosedElements())) {
                if (slot.getModifiers().contains(Modifier.STATIC) || slot.getModifiers().contains(Modifier.PRIVATE)) continue;
                ExecutableElement implementation = implementationOf(slot, type);
                if (implementation == null || implementation.equals(slot)) continue;
                c.builder.edge(new Edge.ImplementsMember(c.ids.member(implementation), c.ids.member(slot), interfaceRef, id));
            }
        }
    }

    /** Every interface in the transitive supertype closure, as the constructed types javac sees them. */
    private List<DeclaredType> allInterfaces(TypeElement type) {
        List<DeclaredType> interfaces = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        List<TypeMirror> pending = new ArrayList<>(c.javac.types().directSupertypes(type.asType()));
        while (!pending.isEmpty()) {
            TypeMirror current = pending.remove(pending.size() - 1);
            if (current.getKind() != TypeKind.DECLARED) continue;
            DeclaredType declared = (DeclaredType) current;
            if (!seen.add(c.types.of(declared).canonical())) continue;
            if (((TypeElement) declared.asElement()).getKind().isInterface()) interfaces.add(declared);
            pending.addAll(c.javac.types().directSupertypes(current));
        }
        return interfaces;
    }

    /** The method of the type or its superclasses that overrides the slot; null when nothing in the class chain does. */
    private ExecutableElement implementationOf(ExecutableElement slot, TypeElement type) {
        for (TypeElement current = type; current != null; current = type.getKind().isInterface() ? null : superclassOf(current)) {
            for (ExecutableElement candidate : ElementFilter.methodsIn(current.getEnclosedElements())) {
                if (candidate.getModifiers().contains(Modifier.STATIC)) continue;
                if (candidate.equals(slot)) return null;
                if (elements.overrides(candidate, slot, type)) return candidate;
            }
        }
        return null;
    }

    // --- Reading the elements ----------------------------------------------------------------------------------------

    static MemberFlags flagsOf(Element element) {
        Set<Modifier> modifiers = element.getModifiers();
        return MemberFlags.builder()
                .isPublic(modifiers.contains(Modifier.PUBLIC))
                .isProtected(modifiers.contains(Modifier.PROTECTED))
                .isPrivate(modifiers.contains(Modifier.PRIVATE))
                .isStatic(modifiers.contains(Modifier.STATIC))
                .isAbstract(modifiers.contains(Modifier.ABSTRACT))
                .isFinal(modifiers.contains(Modifier.FINAL))
                .isNative(modifiers.contains(Modifier.NATIVE))
                .isSynchronized(modifiers.contains(Modifier.SYNCHRONIZED))
                .isVolatile(modifiers.contains(Modifier.VOLATILE))
                .isTransient(modifiers.contains(Modifier.TRANSIENT))
                .isStrictfp(modifiers.contains(Modifier.STRICTFP))
                .isDefault(modifiers.contains(Modifier.DEFAULT))
                .isSealed(modifiers.contains(Modifier.SEALED))
                .isNonSealed(modifiers.contains(Modifier.NON_SEALED))
                .build();
    }

    private List<SourceSpan> spans(CompilationUnitTree unit, Tree tree) {
        if (unit == null || tree == null) return List.of();
        SourceSpan span = c.locations.spanOf(unit, tree);
        return span == null ? List.of() : List.of(span);
    }

    /**
     * Sources under the build directory were generated by the build. A build directory that holds the module's root, as
     * one taken from an output directory right in the module ({@code classes}) does, holds its written sources too.
     */
    private Origin originOf(CompilationUnitTree unit) {
        if (unit == null) return Origin.DECLARED;
        Path file = Path.of(unit.getSourceFile().toUri()).toAbsolutePath().normalize();
        Path buildDirectory = c.input.buildDirectory() == null ? null : c.input.buildDirectory().toAbsolutePath().normalize();
        Path root = c.input.rootDirectory() == null ? null : c.input.rootDirectory().toAbsolutePath().normalize();
        if (buildDirectory == null || root != null && root.startsWith(buildDirectory)) return Origin.DECLARED;
        return file.startsWith(buildDirectory) ? Origin.GENERATED : Origin.DECLARED;
    }

    List<Annotation> annotationsOf(Element element) {
        return c.annotations.of(element);
    }
}
