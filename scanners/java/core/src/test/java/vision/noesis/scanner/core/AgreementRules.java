package vision.noesis.scanner.core;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Collectors;
import vision.noesis.scanner.model.Annotation;
import vision.noesis.scanner.model.CanonicalString;
import vision.noesis.scanner.model.NamespaceNode;
import vision.noesis.scanner.model.TypeParameterConstraint;
import vision.noesis.scanner.model.AnnotationArgument;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.DeclarationNode;
import vision.noesis.scanner.model.Edge;
import vision.noesis.scanner.model.FieldKind;
import vision.noesis.scanner.model.FieldNode;
import vision.noesis.scanner.model.MethodKind;
import vision.noesis.scanner.model.MethodNode;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.Origin;
import vision.noesis.scanner.model.StubNode;
import vision.noesis.scanner.model.TypeNode;
import vision.noesis.scanner.model.TypeParameter;
import vision.noesis.scanner.model.TypeRef;
import vision.noesis.scanner.model.TypeUseRole;

/**
 * What "the two engines write the same model" means today: everything, except the facts bytecode does not hold. Each
 * exclusion is named here, and shrinking this list is the roadmap of the bytecode engine.
 *
 * <ul>
 *   <li>Locations: types and fields have no line in bytecode; a method's line is its first instruction's. Only the file is compared.</li>
 *   <li>{@code documentation}: not in bytecode.</li>
 *   <li>{@code origin}: compared only where the source engine says {@code declared}; bytecode cannot tell an implicit record member or default constructor from a written one.</li>
 *   <li>Bag keys {@code java.strictfp} and {@code java.nonSealed}: not in the class file.</li>
 *   <li>{@code positional} on annotation arguments: the class file has only names.</li>
 *   <li>Annotations with SOURCE retention ({@code @Override}, {@code @SuppressWarnings}): not in the class file.</li>
 *   <li>Type arguments of an inner class's enclosing instantiation ({@code Outer<String>.Inner<Integer>}): ArchUnit does not read them; types are compared with the inner class's own arguments only.</li>
 *   <li>Base chains of stubs: compared through the stubs themselves, not edge by edge.</li>
 *   <li>Parameter names: compared because the fixture is compiled with {@code -parameters}.</li>
 *   <li>{@code .cctor}: bytecode has one whenever a static field has an initializer; compared only when the source engine emitted it.</li>
 *   <li>Body edges from constructors, fields and generated methods: field initializers are compiled into constructors and {@code .cctor}, the implicit {@code super()} flag is source-only, and an implicit record accessor has a body only in bytecode; only edges from declared methods are compared.</li>
 *   <li>{@code INVOKES.typeArguments} and {@code receiver}: bytecode has neither the inference nor the expression.</li>
 *   <li>{@code INVOKES} to external targets: the compiler inserts calls (boxing, iterators, {@code close()}), so bytecode is a superset, and an inherited member may be bound to a different declaring type, so external targets are compared by member name; calls to scanned targets must agree exactly.</li>
 *   <li>{@code java.enclosingMethod}: a class declared in a field initializer has no enclosing method in the class file.</li>
 *   <li>{@code ACCESSES}: read and write merged (a compound assignment is two accesses in bytecode); accesses to enum constants excluded (a {@code case} label reads none in bytecode).</li>
 *   <li>{@code USES_TYPE}: only {@code typeTest} is in bytecode.</li>
 *   <li>Stubs: the source engine's are a subset of bytecode's, which also stubs the targets of compiler-inserted calls.</li>
 *   <li>Diagnostics: not compared.</li>
 * </ul>
 */
final class AgreementRules {

    private static final Set<String> EXCLUDED_BAG_KEYS = Set.of("java.strictfp", "java.nonSealed");

    private final List<String> differences = new ArrayList<>();
    private final Set<String> scannedTypePaths;
    private final Set<NodeId> enumConstants;

    AgreementRules(List<CodeModelFile> sourceModels) {
        scannedTypePaths = sourceModels.stream().flatMap(model -> model.nodes().stream()).filter(TypeNode.class::isInstance)
                .map(node -> node.id().canonicalPath()).collect(Collectors.toSet());
        enumConstants = sourceModels.stream().flatMap(model -> model.nodes().stream()).filter(node -> node instanceof FieldNode field && field.fieldKind() == FieldKind.ENUM_MEMBER)
                .map(DeclarationNode::id).collect(Collectors.toSet());
    }

    List<String> differences() {
        return differences;
    }

    void compare(CodeModelFile source, CodeModelFile bytecode) {
        String artifact = source.artifact().name();
        Map<NodeId, DeclarationNode> sourceNodes = byId(source);
        Map<NodeId, DeclarationNode> bytecodeNodes = byId(bytecode);
        Set<NodeId> cctorOnlyInBytecode = new HashSet<>();
        for (NodeId id : bytecodeNodes.keySet()) {
            if (id.value().endsWith("#.cctor()") && !sourceNodes.containsKey(id)) cctorOnlyInBytecode.add(id);
        }
        compareNodes(artifact, sourceNodes, bytecodeNodes, cctorOnlyInBytecode);
        compareStructure(artifact, source, bytecode, cctorOnlyInBytecode, sourceNodes.keySet());
        compareBodies(artifact, source, bytecode, sourceNodes);
        compareStubs(artifact, source, bytecode);
    }

    // --- Nodes -------------------------------------------------------------------------------------------------------

    private void compareNodes(String artifact, Map<NodeId, DeclarationNode> source, Map<NodeId, DeclarationNode> bytecode, Set<NodeId> excluded) {
        for (NodeId id : new TreeSet<>(source.keySet())) {
            if (!bytecode.containsKey(id)) differences.add(artifact + ": node only in source: " + id);
        }
        for (NodeId id : new TreeSet<>(bytecode.keySet())) {
            if (!source.containsKey(id) && !excluded.contains(id)) differences.add(artifact + ": node only in bytecode: " + id);
        }
        for (NodeId id : new TreeSet<>(source.keySet())) {
            DeclarationNode s = source.get(id);
            DeclarationNode b = bytecode.get(id);
            if (b == null) continue;
            boolean compareOrigin = s.origin() == Origin.DECLARED;
            boolean compareFile = !s.locations().isEmpty() && !(s instanceof NamespaceNode);
            boolean enclosingMethodKnown = b.languageSpecific().get("java.enclosingMethod") != null;
            Map<String, String> left = projection(s, compareOrigin, compareFile, enclosingMethodKnown);
            Map<String, String> right = projection(b, compareOrigin, compareFile, enclosingMethodKnown);
            for (String field : left.keySet()) {
                if (!left.get(field).equals(right.get(field))) differences.add(artifact + ": " + id + " " + field + ": source=" + left.get(field) + " bytecode=" + right.get(field));
            }
        }
    }

    /** Annotations the compiler keeps out of the class file. */
    private static final Set<String> SOURCE_RETENTION = Set.of("java.lang.Override", "java.lang.SuppressWarnings");

    private static Map<String, String> projection(DeclarationNode node, boolean compareOrigin, boolean compareFile, boolean bytecodeHasEnclosingMethod) {
        Map<String, String> fields = new TreeMap<>();
        fields.put("name", node.name());
        if (compareOrigin) fields.put("origin", node.origin().id());
        if (compareFile) fields.put("file", node.locations().isEmpty() ? "" : node.locations().get(0).file());
        fields.put("annotations", annotations(node.annotations()));
        Map<String, Object> bag = new TreeMap<>(node.languageSpecific().entries());
        EXCLUDED_BAG_KEYS.forEach(bag::remove);
        if (!bytecodeHasEnclosingMethod) bag.remove("java.enclosingMethod");
        fields.put("bag", bag.toString());
        if (node instanceof TypeNode type) {
            fields.put("typeKind", type.typeKind().id());
            fields.put("visibility", type.visibility().id());
            fields.put("modifiers", sorted(type.modifiers()));
            fields.put("typeParameters", typeParameters(type.typeParameters()));
        } else if (node instanceof MethodNode method) {
            fields.put("methodKind", method.methodKind().id());
            fields.put("visibility", method.visibility().id());
            fields.put("modifiers", sorted(method.modifiers()));
            fields.put("bodiless", Boolean.toString(method.bodiless()));
            fields.put("typeParameters", typeParameters(method.typeParameters()));
            fields.put("parameters", method.signature().parameters().stream()
                    .map(p -> p.name() + ":" + canonical(p.type()) + (p.variadic() ? "..." : "") + annotations(p.annotations())).collect(Collectors.joining(", ")));
            fields.put("returnType", canonical(method.signature().returnType()));
        } else if (node instanceof FieldNode field) {
            fields.put("fieldKind", field.fieldKind().id());
            fields.put("visibility", field.visibility().id());
            fields.put("modifiers", sorted(field.modifiers()));
            fields.put("type", canonical(field.type()));
            fields.put("constantValue", String.valueOf(field.constantValue()));
        }
        return fields;
    }

    private static String sorted(List<? extends Enum<?>> values) {
        return values.stream().map(Enum::name).sorted().collect(Collectors.joining(","));
    }

    private static String typeParameters(List<TypeParameter> parameters) {
        return parameters.stream().map(p -> p.name() + "@" + p.ordinal() + p.constraints().stream()
                .map(constraint -> constraint instanceof TypeParameterConstraint.TypeConstraint t ? canonical(t.type()) : constraint.toString()).collect(Collectors.toList())).collect(Collectors.joining(", "));
    }

    private static String annotations(List<Annotation> annotations) {
        return annotations.stream().filter(a -> !SOURCE_RETENTION.contains(a.type().canonical()))
                .map(a -> a.type().canonical() + "(" + a.arguments().stream().sorted(java.util.Comparator.comparing(AnnotationArgument::name))
                .map(arg -> arg.name() + "=" + arg.value()).collect(Collectors.joining(",")) + ")").sorted().collect(Collectors.joining(" "));
    }

    /**
     * The canonical string with the type arguments of an inner class's enclosing instantiation dropped: ArchUnit does not
     * read them, so {@code Outer`1+Inner`1[String,Integer]} is compared as {@code Outer`1+Inner`1[Integer]}.
     */
    static String canonical(TypeRef type) {
        return CanonicalString.of(ownArgumentsOnly(type));
    }

    private static TypeRef ownArgumentsOnly(TypeRef type) {
        if (type instanceof TypeRef.Named named) {
            List<TypeRef> arguments = named.typeArguments().stream().map(AgreementRules::ownArgumentsOnly).collect(Collectors.toList());
            int own = ownArity(named.type().canonicalPath());
            if (arguments.size() > own) arguments = arguments.subList(arguments.size() - own, arguments.size());
            return new TypeRef.Named(named.type(), arguments, named.unbound(), named.nullable());
        }
        if (type instanceof TypeRef.Array array) return new TypeRef.Array(ownArgumentsOnly(array.element()), array.rank(), array.nullable());
        return type;
    }

    private static int ownArity(String typePath) {
        int tick = typePath.lastIndexOf('`');
        if (tick < 0 || typePath.indexOf('+', tick) >= 0) return 0;
        return Integer.parseInt(typePath.substring(tick + 1));
    }

    // --- Structural edges --------------------------------------------------------------------------------------------

    /** Edges from declared nodes; a stub's base chain is covered by the stub comparison. */
    private void compareStructure(String artifact, CodeModelFile source, CodeModelFile bytecode, Set<NodeId> excluded, Set<NodeId> declared) {
        Set<String> left = structural(source, excluded, declared);
        Set<String> right = structural(bytecode, excluded, declared);
        for (String edge : left) if (!right.contains(edge)) differences.add(artifact + ": edge only in source: " + edge);
        for (String edge : right) if (!left.contains(edge)) differences.add(artifact + ": edge only in bytecode: " + edge);
    }

    private static Set<String> structural(CodeModelFile model, Set<NodeId> excluded, Set<NodeId> declared) {
        Set<String> edges = new TreeSet<>();
        for (Edge edge : model.edges()) {
            if (edge instanceof Edge.Contains e) {
                if (!excluded.contains(e.to())) edges.add("CONTAINS " + e.from() + " -> " + e.to());
            } else if (edge instanceof Edge.Extends e) {
                if (declared.contains(e.from())) edges.add("EXTENDS " + e.from() + " -> " + canonical(e.to()));
            } else if (edge instanceof Edge.Implements e) {
                if (declared.contains(e.from())) edges.add("IMPLEMENTS " + e.from() + " -> " + canonical(e.to()));
            } else if (edge instanceof Edge.Overrides e) edges.add("OVERRIDES " + e.from() + " -> " + e.to());
            else if (edge instanceof Edge.ImplementsMember e) edges.add("IMPLEMENTS_MEMBER " + e.from() + " -> " + e.to() + " | " + canonical(e.interfaceType()) + " | on " + e.declaredOn());
        }
        return edges;
    }

    // --- Body edges --------------------------------------------------------------------------------------------------

    private void compareBodies(String artifact, CodeModelFile source, CodeModelFile bytecode, Map<NodeId, DeclarationNode> sourceNodes) {
        Set<NodeId> methods = sourceNodes.values().stream()
                .filter(node -> node instanceof MethodNode m && m.methodKind() == MethodKind.METHOD && m.origin() == Origin.DECLARED)
                .map(DeclarationNode::id).collect(Collectors.toSet());
        Set<String> sourceCalls = calls(source, methods);
        Set<String> bytecodeCalls = calls(bytecode, methods);
        for (String call : sourceCalls) if (!bytecodeCalls.contains(call)) differences.add(artifact + ": INVOKES only in source: " + call);
        for (String call : bytecodeCalls) {
            if (!sourceCalls.contains(call) && isScannedTarget(call)) differences.add(artifact + ": INVOKES to a scanned target only in bytecode: " + call);
        }
        Set<String> sourceAccesses = accesses(source, methods);
        Set<String> bytecodeAccesses = accesses(bytecode, methods);
        for (String access : sourceAccesses) if (!bytecodeAccesses.contains(access)) differences.add(artifact + ": ACCESSES only in source: " + access);
        for (String access : bytecodeAccesses) if (!sourceAccesses.contains(access)) differences.add(artifact + ": ACCESSES only in bytecode: " + access);
        Set<String> sourceTests = typeTests(source, methods);
        Set<String> bytecodeTests = typeTests(bytecode, methods);
        for (String test : sourceTests) if (!bytecodeTests.contains(test)) differences.add(artifact + ": typeTest only in source: " + test);
        for (String test : bytecodeTests) if (!sourceTests.contains(test)) differences.add(artifact + ": typeTest only in bytecode: " + test);
    }

    private boolean isScannedTarget(String call) {
        return !call.contains(" -> #");
    }

    /** Calls to scanned targets by id; calls to external targets by member name, because javac and the class file may bind an inherited member to different declaring types. */
    private Set<String> calls(CodeModelFile model, Set<NodeId> from) {
        Set<String> calls = new TreeSet<>();
        for (Edge edge : model.edges()) {
            if (edge instanceof Edge.Invokes e && from.contains(e.from())) {
                String typePath = e.to().canonicalPath().substring(0, e.to().canonicalPath().indexOf('#'));
                String target = scannedTypePaths.contains(typePath) ? e.to().value() : "#" + e.to().canonicalPath().substring(e.to().canonicalPath().indexOf('#') + 1, e.to().canonicalPath().indexOf('('));
                calls.add(e.from() + " -> " + target + " @" + e.site().location().startLine() + (e.site().viaClosure() ? " (closure)" : ""));
            }
        }
        return calls;
    }

    private Set<String> accesses(CodeModelFile model, Set<NodeId> from) {
        Set<String> accesses = new TreeSet<>();
        for (Edge edge : model.edges()) {
            if (edge instanceof Edge.Accesses e && from.contains(e.from()) && !enumConstants.contains(e.to())) {
                accesses.add(e.from() + " -> " + e.to() + " @" + e.site().location().startLine());
            }
        }
        return accesses;
    }

    private static Set<String> typeTests(CodeModelFile model, Set<NodeId> from) {
        Set<String> tests = new TreeSet<>();
        for (Edge edge : model.edges()) {
            if (edge instanceof Edge.UsesType e && e.role() == TypeUseRole.TYPE_TEST && from.contains(e.from())) {
                tests.add(e.from() + " -> " + canonical(e.to()) + " @" + e.site().location().startLine());
            }
        }
        return tests;
    }

    // --- Stubs -------------------------------------------------------------------------------------------------------

    private void compareStubs(String artifact, CodeModelFile source, CodeModelFile bytecode) {
        Map<NodeId, StubNode> right = bytecode.stubs().stream().collect(Collectors.toMap(StubNode::id, stub -> stub));
        for (StubNode stub : source.stubs()) {
            if (SOURCE_RETENTION.contains(stub.id().canonicalPath())) continue;
            StubNode other = right.get(stub.id());
            if (other == null) differences.add(artifact + ": stub only in source: " + stub.id());
            else if (!String.valueOf(stub.artifact()).equals(String.valueOf(other.artifact())) || stub.kind() != other.kind() || !java.util.Objects.equals(stub.typeKind(), other.typeKind())) {
                differences.add(artifact + ": stub differs: " + stub + " vs " + other);
            }
        }
    }

    private static Map<NodeId, DeclarationNode> byId(CodeModelFile model) {
        Map<NodeId, DeclarationNode> nodes = new HashMap<>();
        for (DeclarationNode node : model.nodes()) nodes.put(node.id(), node);
        return nodes;
    }

    static String describe(TypeRef type) {
        return type.canonical();
    }
}
