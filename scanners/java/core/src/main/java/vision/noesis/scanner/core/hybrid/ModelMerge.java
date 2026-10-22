package vision.noesis.scanner.core.hybrid;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Consumer;
import vision.noesis.scanner.core.Diagnostics;
import vision.noesis.scanner.core.EngineKind;
import vision.noesis.scanner.core.ModelBuilder;
import vision.noesis.scanner.core.ScanSession;
import vision.noesis.scanner.core.StubRegistry;
import vision.noesis.scanner.core.java.JavaIds;
import vision.noesis.scanner.model.Annotation;
import vision.noesis.scanner.model.ArtifactNode;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.DeclarationNode;
import vision.noesis.scanner.model.Diagnostic;
import vision.noesis.scanner.model.Edge;
import vision.noesis.scanner.model.FieldNode;
import vision.noesis.scanner.model.LanguageBag;
import vision.noesis.scanner.model.MethodNode;
import vision.noesis.scanner.model.Modifier;
import vision.noesis.scanner.model.NamespaceNode;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.NodeKindLetter;
import vision.noesis.scanner.model.Origin;
import vision.noesis.scanner.model.Parameter;
import vision.noesis.scanner.model.PropertyNode;
import vision.noesis.scanner.model.Signature;
import vision.noesis.scanner.model.SourceSpan;
import vision.noesis.scanner.model.StubKind;
import vision.noesis.scanner.model.StubNode;
import vision.noesis.scanner.model.TypeNode;
import vision.noesis.scanner.model.TypeParameter;
import vision.noesis.scanner.model.TypeParameterConstraint;
import vision.noesis.scanner.model.TypeRef;
import vision.noesis.scanner.model.UsageSite;

/**
 * The rules of the hybrid engine: the source model is kept whole, and the bytecode model contributes only what the
 * sources cannot show.
 *
 * <ul>
 *   <li>A declaration only the class files have (a member or type an annotation processor generated) is added with
 *       {@code origin = generated} and {@code java.engine = bytecode}; a {@code .cctor} of a type the source engine
 *       declared is not, since the source engine attributes static initializers to the fields. An implicit member the
 *       source engine assumed but the class files lack (the default constructor of a class Lombok gave constructors)
 *       is dropped with its edges.</li>
 *   <li>A declaration in both models keeps the source engine's facts, except that modifiers the class file adds and a
 *       visibility it changes (Lombok's {@code @Value} makes the class final and the fields private) are taken from
 *       bytecode and the node is marked {@code java.processorModified = true}.</li>
 *   <li>Structural edges of an added declaration (containment, bases, overrides, interface member mapping) come
 *       from bytecode, as do the edges onto an added declaration from a source one. A base the source engine left
 *       {@code unresolved} is replaced by the bytecode engine's bases of that kind.</li>
 *   <li>Body edges from an added declaration come from bytecode. Body edges from a source declaration come from
 *       bytecode only where they target an added declaration or sit on a line the source engine reported an
 *       {@code NS1002} for (a call it could not bind, and the calls chained after it); their site is marked
 *       {@code java.engine = bytecode}, their receiver and type arguments are bytecode's. A source call on that line
 *       to a member of the same name and arity that the class file does not make (javac bound {@code equals} to
 *       {@code Object}'s, not knowing the generated override) is replaced. The diagnostics of a line that gained an
 *       edge this way, or whose statement's first line did (javac attributes a continued-line {@code new} to it), the
 *       {@code NS1002} and the compiler's errors, are dropped.</li>
 *   <li>Stubs: the source engine's, plus the bytecode engine's for every symbol the added declarations and edges
 *       reference, with their containers and base chains.</li>
 *   <li>Module-level diagnostics of the bytecode engine (classes missing, parameter names missing) are kept.</li>
 *   <li>Without a compiler ({@code NS1003}) the bytecode model is the whole result.</li>
 * </ul>
 */
final class ModelMerge {

    static final String ENGINE_KEY = "java.engine";
    static final String PROCESSOR_MODIFIED_KEY = "java.processorModified";

    private final CodeModelFile source;
    private final CodeModelFile bytecode;
    private final Map<NodeId, DeclarationNode> sourceNodes = new LinkedHashMap<>();
    private final Map<NodeId, DeclarationNode> bytecodeNodes = new LinkedHashMap<>();
    private final Map<NodeId, DeclarationNode> reconciled = new LinkedHashMap<>();
    private final Set<NodeId> droppedSourceNodes = new HashSet<>();
    private final Set<Edge> droppedSourceEdges = new HashSet<>();
    private final Map<NodeId, StubNode> sourceStubs = new LinkedHashMap<>();
    private final Map<NodeId, StubNode> bytecodeStubs = new LinkedHashMap<>();
    private final Map<NodeId, DeclarationNode> added = new LinkedHashMap<>();
    private final List<Edge> addedEdges = new ArrayList<>();
    private final Map<NodeId, StubNode> addedStubs = new LinkedHashMap<>();
    private final Set<String> unboundSites = new HashSet<>();
    private final Set<String> boundSites = new HashSet<>();

    private ModelMerge(CodeModelFile source, CodeModelFile bytecode) {
        this.source = source;
        this.bytecode = bytecode;
        for (DeclarationNode node : source.nodes()) sourceNodes.put(node.id(), node);
        for (DeclarationNode node : bytecode.nodes()) bytecodeNodes.put(node.id(), node);
        for (StubNode stub : source.stubs()) sourceStubs.put(stub.id(), stub);
        for (StubNode stub : bytecode.stubs()) bytecodeStubs.put(stub.id(), stub);
        for (Diagnostic diagnostic : source.diagnostics()) {
            if (Diagnostics.UNBOUND_SITE.equals(diagnostic.code()) && diagnostic.location() != null) unboundSites.add(key(diagnostic.location()));
        }
    }

    static CodeModelFile merge(CodeModelFile source, CodeModelFile bytecode, ArtifactNode artifact, ScanSession session) {
        if (source.diagnostics().stream().anyMatch(d -> Diagnostics.NO_COMPILER.equals(d.code()))) return bytecodeOnly(source, bytecode, artifact, session);
        return new ModelMerge(source, bytecode).merge(artifact, session);
    }

    private CodeModelFile merge(ArtifactNode artifact, ScanSession session) {
        addDeclarations();
        addStructure();
        addBodies();
        addStubs();
        ModelBuilder builder = new ModelBuilder();
        for (DeclarationNode node : source.nodes()) if (!droppedSourceNodes.contains(node.id())) builder.node(reconciled.getOrDefault(node.id(), node));
        for (DeclarationNode node : added.values()) builder.node(node);
        for (Edge edge : source.edges()) if (!droppedSourceEdges.contains(edge) && !touchesDropped(edge)) builder.edge(edge);
        for (Edge edge : addedEdges) builder.edge(edge);
        for (StubNode stub : source.stubs()) register(builder.stubs(), stub);
        for (StubNode stub : addedStubs.values()) register(builder.stubs(), stub);
        for (Diagnostic diagnostic : diagnostics()) builder.diagnostic(diagnostic);
        return builder.build(session.generator(), artifact, session);
    }

    /** No compiler in this JVM: the bytecode model under the hybrid artifact, with the source engine's diagnostic kept. */
    private static CodeModelFile bytecodeOnly(CodeModelFile source, CodeModelFile bytecode, ArtifactNode artifact, ScanSession session) {
        ModelBuilder builder = new ModelBuilder();
        for (DeclarationNode node : bytecode.nodes()) builder.node(node);
        for (Edge edge : bytecode.edges()) builder.edge(edge);
        for (StubNode stub : bytecode.stubs()) register(builder.stubs(), stub);
        for (Diagnostic diagnostic : source.diagnostics()) builder.diagnostic(diagnostic);
        for (Diagnostic diagnostic : bytecode.diagnostics()) if (!source.diagnostics().contains(diagnostic)) builder.diagnostic(diagnostic);
        return builder.build(session.generator(), artifact, session);
    }

    // --- Declarations ------------------------------------------------------------------------------------------------

    private void addDeclarations() {
        for (DeclarationNode node : bytecode.nodes()) {
            if (sourceNodes.containsKey(node.id())) continue;
            if (node.id().value().endsWith("#" + JavaIds.STATIC_INITIALIZER_NAME + "()") && sourceNodes.containsKey(declaringType(node.id()))) continue;
            added.put(node.id(), fromBytecode(node));
        }
        for (DeclarationNode node : source.nodes()) {
            DeclarationNode compiled = bytecodeNodes.get(node.id());
            if (compiled == null) {
                boolean member = node.id().kind() == NodeKindLetter.METHOD || node.id().kind() == NodeKindLetter.FIELD || node.id().kind() == NodeKindLetter.PROPERTY;
                if (member && node.origin() == Origin.GENERATED && bytecodeNodes.containsKey(declaringType(node.id()))) droppedSourceNodes.add(node.id());
                continue;
            }
            DeclarationNode merged = reconcile(node, compiled);
            if (merged != null) reconciled.put(node.id(), merged);
        }
    }

    /** @return the source node with the class file's extra modifiers and visibility, or null when the class file adds nothing. */
    private static DeclarationNode reconcile(DeclarationNode node, DeclarationNode compiled) {
        if (node instanceof TypeNode t && compiled instanceof TypeNode c) {
            List<Modifier> modifiers = union(t.modifiers(), c.modifiers());
            if (modifiers.equals(t.modifiers()) && t.visibility() == c.visibility()) return null;
            return new TypeNode(t.id(), t.name(), t.origin(), t.locations(), t.annotations(), t.documentation(), withProcessorModified(t.languageSpecific()), t.typeKind(), c.visibility(), modifiers, t.typeParameters(), t.underlyingType(), t.delegateSignature(), t.aliasOf());
        }
        if (node instanceof FieldNode f && compiled instanceof FieldNode c) {
            List<Modifier> modifiers = union(f.modifiers(), c.modifiers());
            if (modifiers.equals(f.modifiers()) && f.visibility() == c.visibility()) return null;
            return new FieldNode(f.id(), f.name(), f.origin(), f.locations(), f.annotations(), f.documentation(), withProcessorModified(f.languageSpecific()), f.fieldKind(), c.visibility(), modifiers, f.type(), f.passing(), f.constantValue());
        }
        if (node instanceof MethodNode m && compiled instanceof MethodNode c) {
            List<Modifier> modifiers = union(m.modifiers(), c.modifiers());
            if (modifiers.equals(m.modifiers()) && m.visibility() == c.visibility()) return null;
            return new MethodNode(m.id(), m.name(), m.origin(), m.locations(), m.annotations(), m.documentation(), withProcessorModified(m.languageSpecific()), m.methodKind(), c.visibility(), modifiers, m.typeParameters(), m.signature(), m.extensionReceiver(), m.bodiless());
        }
        return null;
    }

    private static List<Modifier> union(List<Modifier> declared, List<Modifier> compiled) {
        List<Modifier> union = new ArrayList<>(declared);
        for (Modifier modifier : compiled) if (!union.contains(modifier)) union.add(modifier);
        return union;
    }

    private boolean touchesDropped(Edge edge) {
        if (droppedSourceNodes.isEmpty()) return false;
        if (droppedSourceNodes.contains(edge.from())) return true;
        if (edge instanceof Edge.Contains e) return droppedSourceNodes.contains(e.to());
        if (edge instanceof Edge.Overrides e) return droppedSourceNodes.contains(e.to());
        if (edge instanceof Edge.ImplementsMember e) return droppedSourceNodes.contains(e.to());
        return false;
    }

    private static DeclarationNode fromBytecode(DeclarationNode node) {
        LanguageBag bag = withEngine(node.languageSpecific());
        if (node instanceof TypeNode t) {
            return new TypeNode(t.id(), t.name(), Origin.GENERATED, t.locations(), t.annotations(), t.documentation(), bag, t.typeKind(), t.visibility(), t.modifiers(), t.typeParameters(), t.underlyingType(), t.delegateSignature(), t.aliasOf());
        }
        if (node instanceof MethodNode m) {
            return new MethodNode(m.id(), m.name(), Origin.GENERATED, m.locations(), m.annotations(), m.documentation(), bag, m.methodKind(), m.visibility(), m.modifiers(), m.typeParameters(), m.signature(), m.extensionReceiver(), m.bodiless());
        }
        if (node instanceof FieldNode f) {
            return new FieldNode(f.id(), f.name(), Origin.GENERATED, f.locations(), f.annotations(), f.documentation(), bag, f.fieldKind(), f.visibility(), f.modifiers(), f.type(), f.passing(), f.constantValue());
        }
        if (node instanceof PropertyNode p) {
            return new PropertyNode(p.id(), p.name(), Origin.GENERATED, p.locations(), p.annotations(), p.documentation(), bag, p.visibility(), p.modifiers(), p.type(), p.returnPassing(), p.parameters(), p.extensionReceiver(), p.accessors());
        }
        NamespaceNode n = (NamespaceNode) node;
        return new NamespaceNode(n.id(), n.name(), n.origin(), n.locations(), n.annotations(), n.documentation(), bag);
    }

    // --- Structure ---------------------------------------------------------------------------------------------------

    /** Bytecode's structural edges of added declarations; bases the source engine left unresolved are replaced by bytecode's. */
    private void addStructure() {
        Set<NodeId> unresolvedExtends = new HashSet<>();
        Set<NodeId> unresolvedImplements = new HashSet<>();
        for (Edge edge : source.edges()) {
            if (edge instanceof Edge.Extends e && e.to() instanceof TypeRef.Unresolved) {
                unresolvedExtends.add(e.from());
                droppedSourceEdges.add(edge);
            } else if (edge instanceof Edge.Implements e && e.to() instanceof TypeRef.Unresolved) {
                unresolvedImplements.add(e.from());
                droppedSourceEdges.add(edge);
            }
        }
        Set<Edge> sourceEdges = new HashSet<>(source.edges());
        for (Edge edge : bytecode.edges()) {
            boolean take;
            if (edge instanceof Edge.Contains e) take = added.containsKey(e.from()) || added.containsKey(e.to());
            else if (edge instanceof Edge.Extends e) take = added.containsKey(e.from()) || unresolvedExtends.contains(e.from()) && !sourceEdges.contains(edge);
            else if (edge instanceof Edge.Implements e) take = added.containsKey(e.from()) || unresolvedImplements.contains(e.from()) && !sourceEdges.contains(edge);
            else if (edge instanceof Edge.Overrides e) take = added.containsKey(e.from()) || added.containsKey(e.to());
            else if (edge instanceof Edge.ImplementsMember e) take = added.containsKey(e.from()) || added.containsKey(e.to());
            else take = false;
            if (take) addedEdges.add(edge);
        }
    }

    // --- Bodies ------------------------------------------------------------------------------------------------------

    private void addBodies() {
        Set<String> sourceSites = new HashSet<>();
        for (Edge edge : source.edges()) {
            String site = siteKey(edge);
            if (site != null) sourceSites.add(site);
        }
        Set<String> rebound = new HashSet<>();
        Set<String> bytecodeSites = new HashSet<>();
        for (Edge edge : bytecode.edges()) {
            String site = siteKey(edge);
            if (site != null) bytecodeSites.add(site);
        }
        for (Edge edge : bytecode.edges()) {
            NodeId from = edge.from();
            UsageSite site = siteOf(edge);
            if (site == null) continue;
            if (added.containsKey(from)) {
                addedEdges.add(edge);
                continue;
            }
            if (!sourceNodes.containsKey(from)) continue;
            boolean ontoAdded;
            if (edge instanceof Edge.Invokes e) ontoAdded = added.containsKey(e.to());
            else if (edge instanceof Edge.Accesses e) ontoAdded = added.containsKey(e.to());
            else ontoAdded = ((Edge.UsesType) edge).to() instanceof TypeRef.Named named && added.containsKey(named.type());
            if (!ontoAdded && !unboundSites.contains(key(site.location()))) continue;
            if (sourceSites.contains(siteKey(edge))) continue;
            addedEdges.add(marked(edge));
            boundSites.add(key(site.location()));
            if (ontoAdded && edge instanceof Edge.Invokes call) rebound.add(call.from() + " " + key(site.location()) + " " + nameAndArity(call.to()));
        }
        for (Edge edge : source.edges()) {
            if (!(edge instanceof Edge.Invokes call) || added.containsKey(call.to()) || bytecodeSites.contains(siteKey(edge))) continue;
            if (rebound.contains(call.from() + " " + key(call.site().location()) + " " + nameAndArity(call.to()))) droppedSourceEdges.add(edge);
        }
    }

    /** {@code equals/1} for {@code M:java.lang.Object#equals(java.lang.Object)}: what a call javac bound to a supertype's member shares with the generated override. */
    private static String nameAndArity(NodeId member) {
        String path = member.canonicalPath();
        String signature = path.substring(path.indexOf('#') + 1);
        int open = signature.indexOf('(');
        String name = signature.substring(0, open);
        int tick = name.indexOf('`');
        if (tick >= 0) name = name.substring(0, tick);
        String parameters = signature.substring(open + 1, signature.lastIndexOf(')'));
        int arity = 0;
        int depth = 0;
        for (int i = 0; i < parameters.length(); i++) {
            char c = parameters.charAt(i);
            if (c == '[' || c == '<') depth++;
            else if (c == ']' || c == '>') depth--;
            else if (c == ',' && depth == 0) arity++;
        }
        if (!parameters.isEmpty()) arity++;
        return name + "/" + arity;
    }

    private static Edge marked(Edge edge) {
        if (edge instanceof Edge.Invokes e) return new Edge.Invokes(e.from(), e.to(), e.typeArguments(), marked(e.site()), e.invocationKind(), e.receiver());
        if (edge instanceof Edge.Accesses e) return new Edge.Accesses(e.from(), e.to(), e.access(), marked(e.site()), e.receiver());
        if (edge instanceof Edge.UsesType e) return new Edge.UsesType(e.from(), e.to(), e.role(), marked(e.site()));
        return edge;
    }

    private static UsageSite marked(UsageSite site) {
        return new UsageSite(site.location(), site.viaClosure(), withEngine(site.languageSpecific()));
    }

    private static UsageSite siteOf(Edge edge) {
        if (edge instanceof Edge.Invokes e) return e.site();
        if (edge instanceof Edge.Accesses e) return e.site();
        if (edge instanceof Edge.UsesType e) return e.site();
        return null;
    }

    /** Caller, target and line: what makes a bytecode site the same as a source one. */
    private static String siteKey(Edge edge) {
        if (edge instanceof Edge.Invokes e) return "I " + e.from() + " " + e.to() + " " + key(e.site().location());
        if (edge instanceof Edge.Accesses e) return "A " + e.from() + " " + e.to() + " " + key(e.site().location());
        if (edge instanceof Edge.UsesType e) return "U " + e.from() + " " + e.role().id() + " " + e.to().canonical() + " " + key(e.site().location());
        return null;
    }

    private static String key(SourceSpan location) {
        return location == null ? "" : location.file() + ":" + location.startLine();
    }

    // --- Stubs -------------------------------------------------------------------------------------------------------

    private void addStubs() {
        Map<NodeId, List<Edge>> baseEdges = new LinkedHashMap<>();
        for (Edge edge : bytecode.edges()) {
            if ((edge instanceof Edge.Extends || edge instanceof Edge.Implements) && bytecodeStubs.containsKey(edge.from())) {
                baseEdges.computeIfAbsent(edge.from(), k -> new ArrayList<>()).add(edge);
            }
        }
        Deque<NodeId> work = new ArrayDeque<>();
        for (DeclarationNode node : added.values()) referencedBy(node, work::add);
        for (Edge edge : addedEdges) referencedBy(edge, work::add);
        while (!work.isEmpty()) {
            NodeId id = work.pop();
            if (sourceNodes.containsKey(id) || added.containsKey(id) || sourceStubs.containsKey(id) || addedStubs.containsKey(id)) continue;
            StubNode stub = bytecodeStubs.get(id);
            if (stub == null) continue;
            addedStubs.put(id, stub);
            NodeId container = containerOf(id);
            if (container != null) work.add(container);
            for (Edge edge : baseEdges.getOrDefault(id, List.of())) {
                addedEdges.add(edge);
                referencedBy(edge, work::add);
            }
        }
    }

    /** The declaring type of a member, the enclosing type of a nested type, the package of a top-level type, the parent package of a package. */
    private static NodeId containerOf(NodeId id) {
        String path = id.canonicalPath();
        switch (id.kind()) {
            case METHOD, FIELD, PROPERTY -> {
                return declaringType(id);
            }
            case TYPE -> {
                int nested = path.lastIndexOf('+');
                if (nested >= 0) return NodeId.of(NodeKindLetter.TYPE, path.substring(0, nested));
                int dot = path.lastIndexOf('.');
                return dot < 0 ? null : NodeId.of(NodeKindLetter.NAMESPACE, path.substring(0, dot));
            }
            case NAMESPACE -> {
                int dot = path.lastIndexOf('.');
                return dot < 0 ? null : NodeId.of(NodeKindLetter.NAMESPACE, path.substring(0, dot));
            }
            default -> {
                return null;
            }
        }
    }

    private static NodeId declaringType(NodeId member) {
        String path = member.canonicalPath();
        return NodeId.of(NodeKindLetter.TYPE, path.substring(0, path.indexOf('#')));
    }

    private static void register(StubRegistry registry, StubNode stub) {
        switch (stub.kind()) {
            case NAMESPACE -> registry.namespaceChain(stub.id().canonicalPath(), stub.artifact());
            case TYPE -> registry.type(stub.id(), stub.name(), stub.typeKind(), stub.artifact());
            default -> registry.member(stub.id(), stub.kind(), stub.name(), stub.artifact());
        }
    }

    private static void referencedBy(DeclarationNode node, Consumer<NodeId> out) {
        for (Annotation annotation : node.annotations()) referencedBy(annotation.type(), out);
        if (node instanceof TypeNode t) {
            referencedBy(t.typeParameters(), out);
            referencedBy(t.underlyingType(), out);
            referencedBy(t.aliasOf(), out);
            if (t.delegateSignature() != null) referencedBy(t.delegateSignature(), out);
        } else if (node instanceof MethodNode m) {
            referencedBy(m.typeParameters(), out);
            referencedBy(m.signature(), out);
            referencedBy(m.extensionReceiver(), out);
        } else if (node instanceof FieldNode f) {
            referencedBy(f.type(), out);
        } else if (node instanceof PropertyNode p) {
            referencedBy(p.type(), out);
            for (Parameter parameter : p.parameters()) referencedBy(parameter, out);
        }
    }

    private static void referencedBy(Edge edge, Consumer<NodeId> out) {
        if (edge instanceof Edge.Contains e) out.accept(e.to());
        else if (edge instanceof Edge.Extends e) referencedBy(e.to(), out);
        else if (edge instanceof Edge.Implements e) referencedBy(e.to(), out);
        else if (edge instanceof Edge.Overrides e) out.accept(e.to());
        else if (edge instanceof Edge.ImplementsMember e) {
            out.accept(e.to());
            out.accept(e.declaredOn());
            referencedBy(e.interfaceType(), out);
        } else if (edge instanceof Edge.Invokes e) {
            out.accept(e.to());
            for (TypeRef argument : e.typeArguments()) referencedBy(argument, out);
        } else if (edge instanceof Edge.Accesses e) out.accept(e.to());
        else if (edge instanceof Edge.UsesType e) referencedBy(e.to(), out);
    }

    private static void referencedBy(List<TypeParameter> parameters, Consumer<NodeId> out) {
        for (TypeParameter parameter : parameters) {
            for (Annotation annotation : parameter.annotations()) referencedBy(annotation.type(), out);
            for (TypeParameterConstraint constraint : parameter.constraints()) {
                if (constraint instanceof TypeParameterConstraint.TypeConstraint t) referencedBy(t.type(), out);
            }
        }
    }

    private static void referencedBy(Signature signature, Consumer<NodeId> out) {
        for (Parameter parameter : signature.parameters()) referencedBy(parameter, out);
        referencedBy(signature.returnType(), out);
        for (Annotation annotation : signature.returnAnnotations()) referencedBy(annotation.type(), out);
    }

    private static void referencedBy(Parameter parameter, Consumer<NodeId> out) {
        referencedBy(parameter.type(), out);
        for (Annotation annotation : parameter.annotations()) referencedBy(annotation.type(), out);
    }

    private static void referencedBy(TypeRef type, Consumer<NodeId> out) {
        if (type instanceof TypeRef.Named named) {
            out.accept(named.type());
            for (TypeRef argument : named.typeArguments()) referencedBy(argument, out);
        } else if (type instanceof TypeRef.TypeParameterRef ref) {
            out.accept(ref.owner());
        } else if (type instanceof TypeRef.Array array) {
            referencedBy(array.element(), out);
        } else if (type instanceof TypeRef.Union union) {
            for (TypeRef member : union.members()) referencedBy(member, out);
        } else if (type instanceof TypeRef.Intersection intersection) {
            for (TypeRef member : intersection.members()) referencedBy(member, out);
        } else if (type instanceof TypeRef.Function function) {
            referencedBy(function.signature(), out);
        } else if (type instanceof TypeRef.Pointer pointer) {
            referencedBy(pointer.pointee(), out);
        } else if (type instanceof TypeRef.Tuple tuple) {
            for (TypeRef.TupleElement element : tuple.elements()) referencedBy(element.type(), out);
        } else if (type instanceof TypeRef.Structural structural) {
            for (TypeRef.StructuralMember member : structural.members()) referencedBy(member.type(), out);
        }
    }

    // --- Diagnostics -------------------------------------------------------------------------------------------------

    /**
     * A diagnostic is resolved when its line gained a bytecode edge, or when the statement it sits in did: javac
     * attributes a {@code new} or a field read on a continued line to the statement's first line, so the nearest line
     * at or above the diagnostic that has a site at all stands for its statement.
     */
    private List<Diagnostic> diagnostics() {
        Map<String, TreeSet<Integer>> siteLines = new HashMap<>();
        for (Edge edge : source.edges()) addSiteLine(siteLines, siteOf(edge));
        for (Edge edge : addedEdges) addSiteLine(siteLines, siteOf(edge));
        List<Diagnostic> diagnostics = new ArrayList<>();
        for (Diagnostic diagnostic : source.diagnostics()) {
            if (!resolved(diagnostic.location(), siteLines)) diagnostics.add(diagnostic);
        }
        for (Diagnostic diagnostic : bytecode.diagnostics()) {
            if (diagnostic.location() == null && !diagnostics.contains(diagnostic)) diagnostics.add(diagnostic);
        }
        return diagnostics;
    }

    private boolean resolved(SourceSpan location, Map<String, TreeSet<Integer>> siteLines) {
        if (location == null) return false;
        if (boundSites.contains(key(location))) return true;
        Integer statementLine = siteLines.getOrDefault(location.file(), new TreeSet<>()).floor(location.startLine());
        return statementLine != null && boundSites.contains(location.file() + ":" + statementLine);
    }

    private static void addSiteLine(Map<String, TreeSet<Integer>> siteLines, UsageSite site) {
        if (site == null || site.location() == null) return;
        siteLines.computeIfAbsent(site.location().file(), k -> new TreeSet<>()).add(site.location().startLine());
    }

    private static LanguageBag withProcessorModified(LanguageBag bag) {
        Map<String, Object> entries = new LinkedHashMap<>(bag.entries());
        entries.put(PROCESSOR_MODIFIED_KEY, true);
        return LanguageBag.of(entries);
    }

    private static LanguageBag withEngine(LanguageBag bag) {
        Map<String, Object> entries = new LinkedHashMap<>(bag.entries());
        entries.put(ENGINE_KEY, EngineKind.BYTECODE.id());
        return LanguageBag.of(entries);
    }
}
