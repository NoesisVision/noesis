package vision.noesis.parser.core.hybrid;

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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import vision.noesis.parser.core.Diagnostics;
import vision.noesis.parser.core.EngineKind;
import vision.noesis.parser.core.ModelBuilder;
import vision.noesis.parser.core.ParseSession;
import vision.noesis.parser.core.StubRegistry;
import vision.noesis.parser.core.java.JavaIds;
import vision.noesis.parser.model.Annotation;
import vision.noesis.parser.model.ArtifactNode;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.DeclarationNode;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.DiagnosticSeverity;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.FieldNode;
import vision.noesis.parser.model.LanguageBag;
import vision.noesis.parser.model.MethodKind;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.Modifier;
import vision.noesis.parser.model.NamespaceNode;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.NodeKindLetter;
import vision.noesis.parser.model.Origin;
import vision.noesis.parser.model.Parameter;
import vision.noesis.parser.model.PropertyNode;
import vision.noesis.parser.model.Signature;
import vision.noesis.parser.model.SourceSpan;
import vision.noesis.parser.model.StubKind;
import vision.noesis.parser.model.StubNode;
import vision.noesis.parser.model.TypeNode;
import vision.noesis.parser.model.TypeParameter;
import vision.noesis.parser.model.TypeParameterConstraint;
import vision.noesis.parser.model.TypeRef;
import vision.noesis.parser.model.UsageSite;

/**
 * The rules of the hybrid engine: the source model is kept whole, and the bytecode model contributes only what the
 * sources cannot show.
 *
 * <ul>
 *   <li>Before the merge, {@link MergeInputs} gives a source method that names a processor-generated type the id
 *       bytecode has for it, and moves bytecode's field initializer edges from the constructors to the fields, a
 *       generated field's (Lombok's logger, {@code @Synchronized}'s lock) included.</li>
 *   <li>A declaration only the class files have (a member or type an annotation processor generated) is added with
 *       {@code origin = generated} and {@code java.engine = bytecode}; one of a file whose declarations the source
 *       engine dropped ({@code NS1010}) keeps bytecode's origin, and that {@code NS1010} becomes a warning that the
 *       file's types come from the class files. A {@code .cctor} of a type the source engine declared is not added,
 *       since the source engine attributes static initializers to the fields, unless generated static fields of the
 *       type are initialized on one line, which does not tell their initializers apart. An implicit member the source engine assumed but the
 *       class files lack (the default constructor of a class Lombok gave constructors) is dropped with its edges; a
 *       default constructor it assumed whose class file version a processor wrote (another access, or another line)
 *       is taken from bytecode with its body.</li>
 *   <li>A declaration in both models keeps the source engine's facts, except that where the class file has a modifier
 *       the sources lack, its modifiers are taken, and a visibility it changes too (Lombok's {@code @Value} makes the
 *       class final and the fields private, {@code @UtilityClass} a method static); the node is marked
 *       {@code java.processorModified = true}.</li>
 *   <li>Structural edges of an added declaration (containment, bases, overrides, interface member mapping) come
 *       from bytecode, as do the edges onto an added declaration from a source one. A base the source engine left
 *       {@code unresolved} is replaced by the bytecode engine's bases of that kind, if it has any.</li>
 *   <li>Body edges from an added declaration come from bytecode. Body edges from a source declaration come from
 *       bytecode only where they target an added declaration or sit within the lines of an expression the source
 *       engine reported an {@code NS1002} for (a call it could not bind, and every call chained after it, on whatever
 *       line); within such an expression bytecode's sites are counted against the source engine's of the same caller
 *       and target, since the two put a continued line's sites on different lines. A taken site is marked
 *       {@code java.engine = bytecode}; its receiver and type arguments are bytecode's. A source call on that line
 *       to a member of the same name and arity that the class file does not make (javac bound {@code equals} to
 *       {@code Object}'s, not knowing the generated override) is replaced. An {@code NS1002} whose lines gained an
 *       edge, or whose statement's first line did within the same declaration (javac attributes a continued-line
 *       {@code new} to it), is dropped, as is a compiler error at its position or on lines that gained an edge, and
 *       an abstract method javac says a class does not implement where the merge added it ({@code @Delegate}). A
 *       file whose bodies alone the source engine dropped ({@code NS1010} warning, its body edges rolled back) takes
 *       every body edge of its declarations from bytecode, and that {@code NS1010} says so.</li>
 *   <li>Stubs: the source engine's, plus the bytecode engine's for every symbol the added declarations and edges
 *       reference, with their containers and base chains.</li>
 *   <li>Module-level diagnostics of the bytecode engine (classes missing, parameter names missing) are kept; its
 *       {@code NS1001} becomes an {@code NS1011} warning, since the model is the source model, not empty, and its
 *       {@code NS1005} (classes missing) a warning that says so.</li>
 *   <li>Without a source model, no compiler ({@code NS1003}) or a source engine that failed on the module
 *       ({@code NS1001}), the bytecode model is the whole result, with the source engine's diagnostics.</li>
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
    /** Default constructors the source engine assumed but a processor wrote: node and body are taken from bytecode. */
    private final Set<NodeId> replacedSourceNodes = new HashSet<>();
    private final Set<Edge> droppedSourceEdges = new HashSet<>();
    private final Map<NodeId, StubNode> sourceStubs = new LinkedHashMap<>();
    private final Map<NodeId, StubNode> bytecodeStubs = new LinkedHashMap<>();
    private final Map<NodeId, DeclarationNode> added = new LinkedHashMap<>();
    private final List<Edge> addedEdges = new ArrayList<>();
    private final Map<NodeId, StubNode> addedStubs = new LinkedHashMap<>();
    /** The source engine's {@code NS1002} spans: expressions it could not bind, a call chained over several lines included. */
    private final List<Region> unboundRegions = new ArrayList<>();
    /** The file and line of every body edge taken from bytecode onto a source declaration. */
    private final Map<String, TreeSet<Integer>> addedLines = new HashMap<>();
    /** The files whose declarations the source engine dropped ({@code NS1010}), and those of them whose types bytecode supplied. */
    private final Set<String> droppedFiles = new HashSet<>();
    private final Set<String> recoveredFiles = new HashSet<>();
    /** The files whose bodies alone the source engine dropped ({@code NS1010} warning), and those of them whose bodies bytecode supplied. */
    private final Set<String> bodilessFiles = new HashSet<>();
    private final Set<String> refilledFiles = new HashSet<>();
    /** The source types whose static initializer stays: their generated static fields store on a line they share. */
    private final Set<NodeId> sharedStaticInitializers;

    /** The lines of an expression the source engine could not bind. */
    private record Region(String file, int start, int end) {

        static Region of(SourceSpan span) {
            return new Region(span.file(), span.startLine(), Math.max(span.startLine(), span.endLine()));
        }

        boolean holds(SourceSpan at) {
            return at != null && at.file().equals(file) && start <= at.startLine() && at.startLine() <= end;
        }
    }

    private ModelMerge(CodeModelFile source, CodeModelFile bytecode, Set<NodeId> sharedStaticInitializers) {
        this.source = source;
        this.bytecode = bytecode;
        this.sharedStaticInitializers = sharedStaticInitializers;
        for (DeclarationNode node : source.nodes()) sourceNodes.put(node.id(), node);
        for (DeclarationNode node : bytecode.nodes()) bytecodeNodes.put(node.id(), node);
        for (StubNode stub : source.stubs()) sourceStubs.put(stub.id(), stub);
        for (StubNode stub : bytecode.stubs()) bytecodeStubs.put(stub.id(), stub);
        for (Diagnostic diagnostic : source.diagnostics()) {
            if (Diagnostics.UNBOUND_SITE.equals(diagnostic.code()) && diagnostic.location() != null) unboundRegions.add(Region.of(diagnostic.location()));
            if (isDroppedFile(diagnostic)) droppedFiles.add(diagnostic.location().file());
            if (isBodilessFile(diagnostic)) bodilessFiles.add(diagnostic.location().file());
        }
    }

    /** The source engine's {@code NS1010} error: the walk failed on the file's declarations, which are rolled back. */
    private static boolean isDroppedFile(Diagnostic diagnostic) {
        return Diagnostics.FILE_NOT_PARSED.equals(diagnostic.code()) && diagnostic.severity() == DiagnosticSeverity.ERROR && diagnostic.location() != null;
    }

    /** The source engine's {@code NS1010} warning: the walk failed on the file's bodies, whose edges are rolled back; its declarations stay. */
    private static boolean isBodilessFile(Diagnostic diagnostic) {
        return Diagnostics.FILE_NOT_PARSED.equals(diagnostic.code()) && diagnostic.severity() == DiagnosticSeverity.WARNING && diagnostic.location() != null;
    }

    /** Without a source model (no compiler, or the source engine failed on the module) the bytecode model is the whole result. */
    static CodeModelFile merge(CodeModelFile source, CodeModelFile bytecode, ArtifactNode artifact, ParseSession session) {
        boolean noSourceModel = source.diagnostics().stream()
                .anyMatch(d -> Diagnostics.NO_COMPILER.equals(d.code()) || Diagnostics.MODULE_NOT_PARSED.equals(d.code()));
        if (noSourceModel) return bytecodeOnly(source, bytecode, artifact, session);
        CodeModelFile repairedSource = MergeInputs.repairUnresolved(source, bytecode);
        CodeModelFile attributedBytecode = MergeInputs.attributeFieldInitializers(bytecode, repairedSource);
        return new ModelMerge(repairedSource, attributedBytecode, MergeInputs.sharedStaticInitializers(bytecode, repairedSource)).merge(artifact, session);
    }

    private CodeModelFile merge(ArtifactNode artifact, ParseSession session) {
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
    private static CodeModelFile bytecodeOnly(CodeModelFile source, CodeModelFile bytecode, ArtifactNode artifact, ParseSession session) {
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
            if (node.id().value().endsWith("#" + JavaIds.STATIC_INITIALIZER_NAME + "()") && sourceNodes.containsKey(declaringType(node.id()))) {
                // Generated static fields initialized on one line: no line tells which statement initializes which, so their initializers stay here.
                if (!sharedStaticInitializers.contains(declaringType(node.id()))) continue;
            }
            String droppedFile = droppedFileOf(node.id());
            if (droppedFile != null) recoveredFiles.add(droppedFile);
            added.put(node.id(), fromBytecode(node, droppedFile == null ? Origin.GENERATED : node.origin()));
        }
        Map<NodeId, Set<Integer>> sourceSiteLines = new HashMap<>();
        for (Edge edge : source.edges()) {
            UsageSite site = siteOf(edge);
            if (site != null && site.location() != null) sourceSiteLines.computeIfAbsent(edge.from(), k -> new HashSet<>()).add(site.location().startLine());
        }
        for (DeclarationNode node : source.nodes()) {
            DeclarationNode compiled = bytecodeNodes.get(node.id());
            if (compiled != null && bodilessFiles.contains(sourceFileOf(node.id()))) refilledFiles.add(sourceFileOf(node.id()));
            if (compiled == null) {
                boolean member = node.id().kind() == NodeKindLetter.METHOD || node.id().kind() == NodeKindLetter.FIELD || node.id().kind() == NodeKindLetter.PROPERTY;
                if (member && node.origin() == Origin.GENERATED && bytecodeNodes.containsKey(declaringType(node.id()))) droppedSourceNodes.add(node.id());
                continue;
            }
            if (writtenByProcessor(node, compiled, sourceSiteLines.get(node.id()))) {
                replacedSourceNodes.add(node.id());
                reconciled.put(node.id(), fromBytecode(compiled, Origin.GENERATED));
                continue;
            }
            DeclarationNode merged = reconcile(node, compiled);
            if (merged != null) reconciled.put(node.id(), merged);
        }
    }

    /**
     * A default constructor the source engine assumed (no location) whose class file version a processor wrote: javac
     * gives its default constructor the class's access and compiles it onto the class declaration, the line of the
     * source engine's implicit super call. Lombok's starts on its annotation's line ({@code @NoArgsConstructor}) or
     * changes the access ({@code @UtilityClass} makes it private).
     */
    private static boolean writtenByProcessor(DeclarationNode node, DeclarationNode compiled, Set<Integer> sourceSiteLines) {
        if (!(node instanceof MethodNode method) || !(compiled instanceof MethodNode c) || method.methodKind() != MethodKind.CONSTRUCTOR) return false;
        if (node.origin() != Origin.GENERATED || !node.locations().isEmpty()) return false;
        if (method.visibility() != c.visibility() || !method.modifiers().equals(c.modifiers())) return true;
        return sourceSiteLines != null && !c.locations().isEmpty() && !sourceSiteLines.contains(c.locations().get(0).startLine());
    }

    /** @return the source node with the class file's extra modifiers and visibility, or null when the class file adds nothing. */
    private static DeclarationNode reconcile(DeclarationNode node, DeclarationNode compiled) {
        if (node instanceof TypeNode t && compiled instanceof TypeNode c) {
            List<Modifier> modifiers = modifiers(t.modifiers(), c.modifiers());
            if (modifiers.equals(t.modifiers()) && t.visibility() == c.visibility()) return null;
            return new TypeNode(t.id(), t.name(), t.origin(), t.locations(), t.annotations(), t.documentation(), withProcessorModified(t.languageSpecific()), t.typeKind(), c.visibility(), modifiers, t.typeParameters(), t.underlyingType(), t.delegateSignature(), t.aliasOf());
        }
        if (node instanceof FieldNode f && compiled instanceof FieldNode c) {
            List<Modifier> modifiers = modifiers(f.modifiers(), c.modifiers());
            if (modifiers.equals(f.modifiers()) && f.visibility() == c.visibility()) return null;
            return new FieldNode(f.id(), f.name(), f.origin(), f.locations(), f.annotations(), f.documentation(), withProcessorModified(f.languageSpecific()), f.fieldKind(), c.visibility(), modifiers, f.type(), f.passing(), f.constantValue());
        }
        if (node instanceof MethodNode m && compiled instanceof MethodNode c) {
            List<Modifier> modifiers = modifiers(m.modifiers(), c.modifiers());
            if (modifiers.equals(m.modifiers()) && m.visibility() == c.visibility()) return null;
            return new MethodNode(m.id(), m.name(), m.origin(), m.locations(), m.annotations(), m.documentation(), withProcessorModified(m.languageSpecific()), m.methodKind(), c.visibility(), modifiers, m.typeParameters(), m.signature(), m.extensionReceiver(), m.bodiless());
        }
        return null;
    }

    /**
     * The class file's modifiers when it has one the sources lack: the processor changed the declaration, and a modifier
     * it adds can contradict one the sources imply ({@code @UtilityClass} makes a method static, so no longer virtual).
     * Both engines map the access flags through {@code JavaModifiers}, so the sources hold no modifier the class file
     * cannot express, and the class file's list is in the canonical order.
     */
    private static List<Modifier> modifiers(List<Modifier> declared, List<Modifier> compiled) {
        return declared.containsAll(compiled) ? declared : compiled;
    }

    private boolean touchesDropped(Edge edge) {
        if (droppedSourceNodes.isEmpty()) return false;
        if (droppedSourceNodes.contains(edge.from())) return true;
        if (edge instanceof Edge.Contains e) return droppedSourceNodes.contains(e.to());
        if (edge instanceof Edge.Overrides e) return droppedSourceNodes.contains(e.to());
        if (edge instanceof Edge.ImplementsMember e) return droppedSourceNodes.contains(e.to());
        return false;
    }

    /**
     * The file the source engine dropped that a bytecode declaration is written in: its own location's, or for a member
     * without one (a generated member) its type's; null when the sources lack it for another reason (a processor).
     */
    private String droppedFileOf(NodeId id) {
        if (droppedFiles.isEmpty()) return null;
        DeclarationNode node = bytecodeNodes.get(id);
        if (node == null || node instanceof NamespaceNode) return null;
        if (!node.locations().isEmpty()) return droppedFiles.contains(node.locations().get(0).file()) ? node.locations().get(0).file() : null;
        NodeId container = containerOf(id);
        return container == null || container.kind() != NodeKindLetter.TYPE ? null : droppedFileOf(container);
    }

    /** The file a source declaration is written in: its own location's, or for one without (an implicit constructor) its type's. */
    private String sourceFileOf(NodeId id) {
        DeclarationNode node = sourceNodes.get(id);
        if (node == null || node instanceof NamespaceNode) return null;
        if (!node.locations().isEmpty()) return node.locations().get(0).file();
        NodeId container = containerOf(id);
        return container == null || container.kind() != NodeKindLetter.TYPE ? null : sourceFileOf(container);
    }

    /** Marked as bytecode's; generated, unless the sources declare it in a file the source engine dropped. */
    private static DeclarationNode fromBytecode(DeclarationNode node, Origin origin) {
        LanguageBag bag = withEngine(node.languageSpecific());
        if (node instanceof TypeNode t) {
            return new TypeNode(t.id(), t.name(), origin, t.locations(), t.annotations(), t.documentation(), bag, t.typeKind(), t.visibility(), t.modifiers(), t.typeParameters(), t.underlyingType(), t.delegateSignature(), t.aliasOf());
        }
        if (node instanceof MethodNode m) {
            return new MethodNode(m.id(), m.name(), origin, m.locations(), m.annotations(), m.documentation(), bag, m.methodKind(), m.visibility(), m.modifiers(), m.typeParameters(), m.signature(), m.extensionReceiver(), m.bodiless());
        }
        if (node instanceof FieldNode f) {
            return new FieldNode(f.id(), f.name(), origin, f.locations(), f.annotations(), f.documentation(), bag, f.fieldKind(), f.visibility(), f.modifiers(), f.type(), f.passing(), f.constantValue());
        }
        if (node instanceof PropertyNode p) {
            return new PropertyNode(p.id(), p.name(), origin, p.locations(), p.annotations(), p.documentation(), bag, p.visibility(), p.modifiers(), p.type(), p.returnPassing(), p.parameters(), p.extensionReceiver(), p.accessors());
        }
        NamespaceNode n = (NamespaceNode) node;
        return new NamespaceNode(n.id(), n.name(), n.origin(), n.locations(), n.annotations(), n.documentation(), bag);
    }

    // --- Structure ---------------------------------------------------------------------------------------------------

    /**
     * Bytecode's structural edges of added declarations; a base the source engine left unresolved is replaced by
     * bytecode's of the same kind, and kept where bytecode has none (no class file, or a stale one).
     */
    private void addStructure() {
        Set<NodeId> compiledExtends = new HashSet<>();
        Set<NodeId> compiledImplements = new HashSet<>();
        for (Edge edge : bytecode.edges()) {
            if (edge instanceof Edge.Extends) compiledExtends.add(edge.from());
            else if (edge instanceof Edge.Implements) compiledImplements.add(edge.from());
        }
        Set<NodeId> unresolvedExtends = new HashSet<>();
        Set<NodeId> unresolvedImplements = new HashSet<>();
        for (Edge edge : source.edges()) {
            if (edge instanceof Edge.Extends e && e.to() instanceof TypeRef.Unresolved && compiledExtends.contains(e.from())) {
                unresolvedExtends.add(e.from());
                droppedSourceEdges.add(edge);
            } else if (edge instanceof Edge.Implements e && e.to() instanceof TypeRef.Unresolved && compiledImplements.contains(e.from())) {
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
        Map<String, Integer> sourceInRegion = new HashMap<>();
        for (Edge edge : source.edges()) {
            String site = siteKey(edge);
            // A constructor a processor wrote has bytecode's body, not javac's implicit super call.
            if (site != null && replacedSourceNodes.contains(edge.from())) droppedSourceEdges.add(edge);
            if (site != null) sourceSites.add(site);
            Region region = widestRegionOf(siteOf(edge));
            if (region != null) sourceInRegion.merge(regionKey(region, edge), 1, Integer::sum);
        }
        Map<String, Integer> takenInRegion = new HashMap<>();
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
            if (added.containsKey(from) || replacedSourceNodes.contains(from)) {
                addedEdges.add(edge);
                continue;
            }
            if (!sourceNodes.containsKey(from)) continue;
            if (!bodilessFiles.isEmpty() && bodilessFiles.contains(sourceFileOf(from))) {
                // The source engine rolled back every body edge of the file, so none of these duplicates one of its.
                addedEdges.add(marked(edge));
                continue;
            }
            boolean ontoAdded;
            if (edge instanceof Edge.Invokes e) ontoAdded = added.containsKey(e.to());
            else if (edge instanceof Edge.Accesses e) ontoAdded = added.containsKey(e.to());
            else ontoAdded = ((Edge.UsesType) edge).to() instanceof TypeRef.Named named && added.containsKey(named.type());
            Region region = widestRegionOf(site);
            if (!ontoAdded && region == null) continue;
            if (region != null) {
                // Counted per unbound expression, not per line: javac and the source engine put a continued line's sites on different lines.
                String counted = regionKey(region, edge);
                if (takenInRegion.merge(counted, 1, Integer::sum) <= sourceInRegion.getOrDefault(counted, 0)) continue;
            } else if (sourceSites.contains(siteKey(edge))) {
                continue;
            }
            addedEdges.add(marked(edge));
            addedLines.computeIfAbsent(site.location().file(), k -> new TreeSet<>()).add(site.location().startLine());
            if (ontoAdded && edge instanceof Edge.Invokes call) rebound.add(call.from() + " " + key(site.location()) + " " + nameAndArity(call.to()));
        }
        for (Edge edge : source.edges()) {
            if (!(edge instanceof Edge.Invokes call) || added.containsKey(call.to()) || bytecodeSites.contains(siteKey(edge))) continue;
            if (rebound.contains(call.from() + " " + key(call.site().location()) + " " + nameAndArity(call.to()))) droppedSourceEdges.add(edge);
        }
    }

    /** The widest unbound expression holding the site, so the sites of one chain are counted together. */
    private Region widestRegionOf(UsageSite site) {
        if (site == null) return null;
        Region widest = null;
        for (Region region : unboundRegions) {
            if (region.holds(site.location()) && (widest == null || region.end() - region.start() > widest.end() - widest.start())) widest = region;
        }
        return widest;
    }

    private static String regionKey(Region region, Edge edge) {
        String site = siteKey(edge);
        return region + " " + site.substring(0, site.lastIndexOf(' '));
    }

    /** {@code equals/1} for {@code M:java.lang.Object#equals(java.lang.Object)}: what a call javac bound to a supertype's member shares with the generated override. */
    private static String nameAndArity(NodeId member) {
        String path = member.canonicalPath();
        String signature = path.substring(path.indexOf('#') + 1);
        int open = signature.indexOf('(');
        String name = signature.substring(0, open);
        int tick = name.indexOf('`');
        if (tick >= 0) name = name.substring(0, tick);
        return name + "/" + arity(signature.substring(open + 1, signature.lastIndexOf(')')));
    }

    /** The parameters in a comma-separated list, type arguments ({@code [..]} in ids, {@code <..>} in javac's messages) aside. */
    private static int arity(String parameters) {
        int arity = 0;
        int depth = 0;
        for (int i = 0; i < parameters.length(); i++) {
            char c = parameters.charAt(i);
            if (c == '[' || c == '<') depth++;
            else if (c == ']' || c == '>') depth--;
            else if (c == ',' && depth == 0) arity++;
        }
        return parameters.isBlank() ? arity : arity + 1;
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
        for (NodeId id : replacedSourceNodes) referencedBy(reconciled.get(id), work::add);
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
        return MergeInputs.declaringType(member);
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
     * The source engine's diagnostics, less those the bytecode edges answered: an {@code NS1002} whose lines gained an
     * edge, or whose statement did (javac puts a {@code new} on a continued line on the statement's first line: the
     * nearest line above with a site, within the same declaration), a compiler error at the same position as such an
     * {@code NS1002} or on lines that gained an edge, one naming a class the merge added, and one saying a class does not
     * implement an abstract method the merge added to it. The bytecode engine's module-level diagnostics are added.
     */
    private List<Diagnostic> diagnostics() {
        Map<String, TreeSet<Integer>> siteLines = new HashMap<>();
        for (Edge edge : source.edges()) addSiteLine(siteLines, siteOf(edge));
        for (Edge edge : addedEdges) addSiteLine(siteLines, siteOf(edge));
        Set<String> resolvedPositions = new HashSet<>();
        for (Diagnostic diagnostic : source.diagnostics()) {
            if (Diagnostics.UNBOUND_SITE.equals(diagnostic.code()) && unboundResolved(diagnostic.location(), siteLines)) resolvedPositions.add(position(diagnostic.location()));
        }
        List<Diagnostic> diagnostics = new ArrayList<>();
        for (Diagnostic diagnostic : source.diagnostics()) {
            SourceSpan location = diagnostic.location();
            if (isDroppedFile(diagnostic) && recoveredFiles.contains(location.file())) {
                diagnostics.add(recovered(diagnostic));
                continue;
            }
            if (isBodilessFile(diagnostic) && refilledFiles.contains(location.file())) {
                diagnostics.add(refilled(diagnostic));
                continue;
            }
            boolean resolved = location != null && (resolvedPositions.contains(position(location)) || gainedEdge(location) || namesAddedType(diagnostic)
                    || implementedByAddedMember(diagnostic));
            if (!resolved) diagnostics.add(diagnostic);
        }
        for (Diagnostic diagnostic : bytecode.diagnostics()) {
            if (diagnostic.location() != null || reportedBySource(diagnostic)) continue;
            Diagnostic kept = Diagnostics.MODULE_NOT_PARSED.equals(diagnostic.code()) ? bytecodeUnavailable(diagnostic)
                    : Diagnostics.CLASSES_MISSING.equals(diagnostic.code()) ? classesMissing(diagnostic) : diagnostic;
            if (!diagnostics.contains(kept)) diagnostics.add(kept);
        }
        return diagnostics;
    }

    /**
     * A duplicate id both engines report: the source engine's warning, with its declarations' lines, is the one kept. A
     * class file without a {@code SourceFile} attribute gives bytecode's copy no location, which would otherwise keep both.
     */
    private boolean reportedBySource(Diagnostic diagnostic) {
        if (!Diagnostics.DUPLICATE_ID.equals(diagnostic.code())) return false;
        String id = duplicatedId(diagnostic);
        return id != null && source.diagnostics().stream().anyMatch(d -> Diagnostics.DUPLICATE_ID.equals(d.code()) && id.equals(duplicatedId(d)));
    }

    /** The id an {@code NS1004} names: "Declared twice: <id>, by ...". */
    private static String duplicatedId(Diagnostic diagnostic) {
        String prefix = "Declared twice: ";
        String message = diagnostic.message();
        int end = message.indexOf(", by ");
        return message.startsWith(prefix) && end > prefix.length() ? message.substring(prefix.length(), end) : null;
    }

    /** A dropped file whose types bytecode supplied is in the model after all: its {@code NS1010} becomes a warning that says so. */
    private static Diagnostic recovered(Diagnostic dropped) {
        return Diagnostics.warning(Diagnostics.FILE_NOT_PARSED, "The declarations of " + dropped.location().file()
                + " could not be parsed from the sources, so its types are taken from the class files: " + cause(dropped), dropped.location());
    }

    /** A file whose bodies alone the source engine dropped has them from the class files: its {@code NS1010} says so. */
    private static Diagnostic refilled(Diagnostic dropped) {
        return Diagnostics.warning(Diagnostics.FILE_NOT_PARSED, "The bodies of " + dropped.location().file()
                + " could not be parsed from the sources, so their calls, accesses and type uses are taken from the class files: " + cause(dropped), dropped.location());
    }

    /** What the source engine's message says after its first {@code ": "}: the exception. */
    private static String cause(Diagnostic dropped) {
        String message = dropped.message();
        int cause = message.indexOf(": ");
        return cause < 0 ? message : message.substring(cause + 2);
    }

    /** No class files is no error of the hybrid model, which is the source model; the code stays, so the advice to build the module is found. */
    private static Diagnostic classesMissing(Diagnostic missing) {
        return Diagnostics.warning(Diagnostics.CLASSES_MISSING, "The hybrid model is the source model, without the members an annotation processor generated: "
                + missing.message());
    }

    /** The bytecode engine's {@code NS1001} would say the model is empty; it is the source model, without what a processor generated. */
    private static Diagnostic bytecodeUnavailable(Diagnostic failure) {
        return Diagnostics.warning(Diagnostics.BYTECODE_UNAVAILABLE, "The class files could not be read, so the hybrid model is the source model, without the members an annotation processor generated. "
                + failure.message());
    }

    private boolean unboundResolved(SourceSpan location, Map<String, TreeSet<Integer>> siteLines) {
        if (location == null) return false;
        if (gainedEdge(location)) return true;
        SourceSpan declaration = innermostDeclarationHolding(location);
        Integer statementLine = siteLines.getOrDefault(location.file(), new TreeSet<>()).lower(location.startLine());
        if (statementLine == null || declaration == null || statementLine < declaration.startLine()) return false;
        return addedLines.getOrDefault(location.file(), new TreeSet<>()).contains(statementLine);
    }

    /** True when a bytecode edge was taken on one of the span's lines. */
    private boolean gainedEdge(SourceSpan location) {
        Integer line = addedLines.getOrDefault(location.file(), new TreeSet<>()).ceiling(location.startLine());
        return line != null && line <= Math.max(location.startLine(), location.endLine());
    }

    private SourceSpan innermostDeclarationHolding(SourceSpan location) {
        SourceSpan innermost = null;
        for (DeclarationNode node : source.nodes()) {
            if (!(node instanceof MethodNode) && !(node instanceof FieldNode)) continue;
            for (SourceSpan span : node.locations()) {
                if (!span.file().equals(location.file()) || span.startLine() > location.startLine() || span.endLine() < location.startLine()) continue;
                if (innermost == null || span.endLine() - span.startLine() < innermost.endLine() - innermost.startLine()) innermost = span;
            }
        }
        return innermost;
    }

    private static final Pattern MISSING_CLASS = Pattern.compile("symbol: +class (\\S+)");
    private static final Pattern MISSING_CLASS_OWNER = Pattern.compile("location: +(?:class|interface) (\\S+)");

    /**
     * javac's "cannot find symbol: class X" for a class the merge added from bytecode: the class a processor generates
     * ({@code Built.BuiltBuilder} on a parameter or field) exists. The messages are javac's English ones; the location
     * class, when javac names one, must enclose it.
     */
    private boolean namesAddedType(Diagnostic diagnostic) {
        if (!diagnostic.code().startsWith("compiler.err.cant.resolve")) return false;
        Matcher symbol = MISSING_CLASS.matcher(diagnostic.message());
        if (!symbol.find()) return false;
        Matcher owner = MISSING_CLASS_OWNER.matcher(diagnostic.message());
        String name = owner.find() ? owner.group(1) + "." + symbol.group(1) : symbol.group(1);
        for (NodeId id : added.keySet()) {
            if (id.kind() != NodeKindLetter.TYPE) continue;
            String dotted = dottedName(id);
            if (dotted.equals(name) || dotted.endsWith("." + name)) return true;
        }
        return false;
    }

    private static final Pattern MISSING_OVERRIDE = Pattern.compile("^(\\S+) is not abstract and does not override abstract method ([^(\\s]+)\\(([^)]*)\\) in \\S+$");

    /**
     * javac's "C is not abstract and does not override abstract method m(..) in I" for a class the merge added that
     * method to: the processor implemented it ({@code @Delegate}). Matched by the class's name and the method's name
     * and arity, as javac prints its parameters by their own type variables.
     */
    private boolean implementedByAddedMember(Diagnostic diagnostic) {
        if (!"compiler.err.does.not.override.abstract".equals(diagnostic.code())) return false;
        Matcher missing = MISSING_OVERRIDE.matcher(diagnostic.message());
        if (!missing.find()) return false;
        String method = missing.group(2) + "/" + arity(missing.group(3));
        for (NodeId id : added.keySet()) {
            if (id.kind() != NodeKindLetter.METHOD || !nameAndArity(id).equals(method)) continue;
            if (dottedName(declaringType(id)).equals(missing.group(1))) return true;
        }
        return false;
    }

    /** {@code p.Outer.Inner} for {@code T:p.Outer+Inner`1}: a type as javac's messages name it. */
    private static String dottedName(NodeId type) {
        return type.canonicalPath().replace('+', '.').replaceAll("`\\d+", "");
    }

    private static String position(SourceSpan location) {
        return location.file() + ":" + location.startLine() + ":" + location.startColumn();
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
