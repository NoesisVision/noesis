package vision.noesis.parser.core.hybrid;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import vision.noesis.parser.core.java.JavaIds;
import vision.noesis.parser.model.AccessKind;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.DeclarationNode;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.FieldNode;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.Modifier;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.NodeKindLetter;
import vision.noesis.parser.model.Parameter;
import vision.noesis.parser.model.Signature;
import vision.noesis.parser.model.SourceSpan;
import vision.noesis.parser.model.TypeRef;

/**
 * What the two models need before they are merged by id, so that one declaration has one id and one body in both.
 *
 * <ul>
 *   <li>The source model: a method whose signature names a type only an annotation processor declares
 *       ({@code void accept(ImmutableX x)}, a Lombok builder class) has an {@code <unresolved:...>} id in the source
 *       model and the real one in bytecode. It takes bytecode's id, and every edge to or from it follows. Types the
 *       source engine left unresolved on a field, a return or a parameter take bytecode's.</li>
 *   <li>The bytecode model: a field initializer compiles into every constructor, or into {@code .cctor} for a static
 *       field, where the source engine attributes it to the field. A constructor's or static initializer's edge on the
 *       lines of a field of its type is the field's, and the store into the field itself is no access. A field a
 *       processor generated has no lines: its initializer is the edges on the line where the static initializer (a
 *       static field, Lombok's logger) or a constructor (an instance field, {@code @Synchronized}'s lock) stores into
 *       it, outside the sources' fields and static blocks and what javac makes there (the assertion switch).</li>
 * </ul>
 */
final class MergeInputs {

    private MergeInputs() {}

    // --- Source: unresolved ids and types ----------------------------------------------------------------------------

    static CodeModelFile repairUnresolved(CodeModelFile source, CodeModelFile bytecode) {
        Map<NodeId, DeclarationNode> compiled = new HashMap<>();
        for (DeclarationNode node : bytecode.nodes()) compiled.put(node.id(), node);
        Map<NodeId, DeclarationNode> declared = new HashMap<>();
        for (DeclarationNode node : source.nodes()) declared.put(node.id(), node);
        Map<String, List<MethodNode>> compiledByNameAndArity = new HashMap<>();
        for (DeclarationNode node : bytecode.nodes()) {
            if (node instanceof MethodNode method && !declared.containsKey(method.id())) {
                compiledByNameAndArity.computeIfAbsent(nameAndArity(method), k -> new ArrayList<>()).add(method);
            }
        }
        Map<NodeId, NodeId> renamed = new HashMap<>();
        List<DeclarationNode> nodes = new ArrayList<>();
        boolean changed = false;
        for (DeclarationNode node : source.nodes()) {
            DeclarationNode repaired = node;
            if (node instanceof MethodNode method && method.id().value().contains("<unresolved:")) {
                MethodNode match = compiledMatch(method, compiledByNameAndArity.getOrDefault(nameAndArity(method), List.of()));
                if (match != null) {
                    renamed.put(method.id(), match.id());
                    repaired = withTypesOf(method, match, match.id());
                }
            } else if (compiled.get(node.id()) != null) {
                repaired = withTypesOf(node, compiled.get(node.id()), node.id());
            }
            changed |= repaired != node;
            nodes.add(repaired);
        }
        if (!changed) return source;
        List<Edge> edges = new ArrayList<>(source.edges().size());
        for (Edge edge : source.edges()) edges.add(renamed.isEmpty() ? edge : renamed(edge, renamed));
        return CodeModelFile.sorted(source.generator(), source.artifact(), nodes, edges, source.stubs(), source.diagnostics());
    }

    /**
     * The compiled method an unresolved source method is: the one of its name and arity, or, among overloads, the one
     * whose parameters agree with it position by position. A resolved parameter must be the same type; an unresolved
     * one must name the compiled type ({@code <unresolved:A.ABuilder>} is {@code p.A+ABuilder}). Null when not exactly one.
     */
    private static MethodNode compiledMatch(MethodNode method, List<MethodNode> candidates) {
        if (candidates.size() <= 1) return candidates.isEmpty() ? null : candidates.get(0);
        List<Pattern> parameters = new ArrayList<>();
        for (Parameter parameter : method.signature().parameters()) parameters.add(patternOf(parameter.type().canonical()));
        MethodNode found = null;
        for (MethodNode candidate : candidates) {
            List<Parameter> compiled = candidate.signature().parameters();
            boolean agrees = true;
            for (int i = 0; i < parameters.size() && agrees; i++) agrees = parameters.get(i).matcher(compiled.get(i).type().canonical()).matches();
            if (!agrees) continue;
            if (found != null) return null;
            found = candidate;
        }
        return found;
    }

    private static final Pattern UNRESOLVED = Pattern.compile("<unresolved:([^<>]*)>");

    /** A source type's canonical string as a pattern over compiled ones: literal, with each unresolved name matching the types it can name. */
    private static Pattern patternOf(String canonical) {
        StringBuilder pattern = new StringBuilder();
        Matcher unresolved = UNRESOLVED.matcher(canonical);
        int at = 0;
        while (unresolved.find()) {
            pattern.append(Pattern.quote(canonical.substring(at, unresolved.start())));
            String name = unresolved.group(1);
            int arguments = name.indexOf('<');
            if (arguments >= 0) name = name.substring(0, arguments);
            StringBuilder qualified = new StringBuilder();
            for (String part : name.trim().split("\\.")) qualified.append(qualified.isEmpty() ? "" : "[.+]").append(Pattern.quote(part));
            // Any qualifier before the name as written; the compiled type's arity and arguments after it.
            pattern.append("(?:[^\\[\\],]*[.+])?").append(qualified).append("(?:`\\d+)?(?:\\[[^\\[\\]]*\\])?");
            at = unresolved.end();
        }
        return Pattern.compile(pattern.append(Pattern.quote(canonical.substring(at))).toString());
    }

    /** {@code T:p.T|name|arity}: a method's declaring type, name and parameter count, which its unresolved id keeps. */
    private static String nameAndArity(MethodNode method) {
        String path = method.id().canonicalPath();
        return path.substring(0, path.indexOf('#')) + "|" + method.name() + "|" + method.signature().parameters().size();
    }

    private static DeclarationNode withTypesOf(DeclarationNode node, DeclarationNode compiled, NodeId id) {
        if (node instanceof MethodNode method && compiled instanceof MethodNode match) {
            Signature signature = method.signature();
            List<Parameter> parameters = new ArrayList<>(signature.parameters().size());
            boolean changed = !id.equals(method.id());
            for (int i = 0; i < signature.parameters().size(); i++) {
                Parameter parameter = signature.parameters().get(i);
                TypeRef type = i < match.signature().parameters().size() ? resolved(parameter.type(), match.signature().parameters().get(i).type()) : parameter.type();
                changed |= type != parameter.type();
                parameters.add(new Parameter(parameter.name(), type, parameter.passing(), parameter.variadic(), parameter.optional(), parameter.defaultValue(),
                        parameter.annotations(), parameter.languageSpecific()));
            }
            TypeRef returnType = resolved(signature.returnType(), match.signature().returnType());
            changed |= returnType != signature.returnType();
            if (!changed) return node;
            return new MethodNode(id, method.name(), method.origin(), method.locations(), method.annotations(), method.documentation(), method.languageSpecific(),
                    method.methodKind(), method.visibility(), method.modifiers(), method.typeParameters(),
                    new Signature(parameters, returnType, signature.returnPassing(), signature.returnAnnotations()), method.extensionReceiver(), method.bodiless());
        }
        if (node instanceof FieldNode field && compiled instanceof FieldNode match) {
            TypeRef type = resolved(field.type(), match.type());
            if (type == field.type()) return node;
            return new FieldNode(field.id(), field.name(), field.origin(), field.locations(), field.annotations(), field.documentation(), field.languageSpecific(),
                    field.fieldKind(), field.visibility(), field.modifiers(), type, field.passing(), field.constantValue());
        }
        return node;
    }

    /** Bytecode's type where the source engine could not resolve one: at the top, or anywhere inside the reference. */
    private static TypeRef resolved(TypeRef declared, TypeRef compiled) {
        return declared != null && compiled != null && declared.canonical().contains("<unresolved:") ? compiled : declared;
    }

    private static Edge renamed(Edge edge, Map<NodeId, NodeId> renamed) {
        NodeId from = renamed.getOrDefault(edge.from(), edge.from());
        if (edge instanceof Edge.Contains e) return new Edge.Contains(from, renamed.getOrDefault(e.to(), e.to()));
        if (edge instanceof Edge.Overrides e) return new Edge.Overrides(from, renamed.getOrDefault(e.to(), e.to()));
        if (edge instanceof Edge.ImplementsMember e) return new Edge.ImplementsMember(from, renamed.getOrDefault(e.to(), e.to()), e.interfaceType(), e.declaredOn());
        if (edge instanceof Edge.Invokes e) return new Edge.Invokes(from, renamed.getOrDefault(e.to(), e.to()), e.typeArguments(), e.site(), e.invocationKind(), e.receiver());
        if (edge instanceof Edge.Accesses e) return new Edge.Accesses(from, e.to(), e.access(), e.site(), e.receiver());
        if (edge instanceof Edge.UsesType e) return new Edge.UsesType(from, e.to(), e.role(), e.site());
        if (edge instanceof Edge.Extends e) return new Edge.Extends(from, e.to());
        if (edge instanceof Edge.Implements e) return new Edge.Implements(from, e.to());
        return edge;
    }

    // --- Bytecode: field initializers --------------------------------------------------------------------------------

    static CodeModelFile attributeFieldInitializers(CodeModelFile bytecode, CodeModelFile source) {
        Map<NodeId, List<FieldNode>> fieldsByType = new LinkedHashMap<>();
        Map<NodeId, List<SourceSpan>> staticBlocks = new HashMap<>();
        for (DeclarationNode node : source.nodes()) {
            if (node instanceof FieldNode field && !field.locations().isEmpty()) {
                fieldsByType.computeIfAbsent(declaringType(field.id()), k -> new ArrayList<>()).add(field);
            } else if (isStaticInitializer(node.id())) {
                staticBlocks.put(declaringType(node.id()), node.locations());
            }
        }
        GeneratedFields generated = GeneratedFields.of(bytecode, source);
        if (fieldsByType.isEmpty() && generated.byLine().isEmpty()) return bytecode;
        // An instance initializer is copied into every constructor that does not delegate: the field takes one copy, the first constructor's by id.
        Map<NodeId, NodeId> constructorOf = new HashMap<>();
        for (Edge edge : bytecode.edges()) {
            FieldNode field = initializedField(edge, fieldsByType, staticBlocks, generated);
            if (field != null) constructorOf.merge(field.id(), edge.from(), (a, b) -> a.compareTo(b) <= 0 ? a : b);
        }
        List<Edge> edges = new ArrayList<>(bytecode.edges().size());
        boolean changed = false;
        for (Edge edge : bytecode.edges()) {
            FieldNode field = initializedField(edge, fieldsByType, staticBlocks, generated);
            if (field == null) {
                edges.add(edge);
                continue;
            }
            changed = true;
            if (!edge.from().equals(constructorOf.get(field.id()))) continue;
            if (edge instanceof Edge.Accesses access && access.to().equals(field.id()) && access.access() == AccessKind.WRITE) continue;
            edges.add(withFrom(edge, field.id()));
        }
        if (!changed) return bytecode;
        return CodeModelFile.sorted(bytecode.generator(), bytecode.artifact(), bytecode.nodes(), edges, bytecode.stubs(), bytecode.diagnostics());
    }

    /** The source-declared types whose static initializer has a line several generated static fields store on: no line tells their initializers apart. */
    static Set<NodeId> sharedStaticInitializers(CodeModelFile bytecode, CodeModelFile source) {
        return GeneratedFields.of(bytecode, source).sharedStatic();
    }

    /**
     * The field of the constructor's or static initializer's type whose declaration holds the edge's line; else, outside
     * the sources' static blocks and what javac makes, the generated field whose initializer is on that line.
     */
    private static FieldNode initializedField(Edge edge, Map<NodeId, List<FieldNode>> fieldsByType, Map<NodeId, List<SourceSpan>> staticBlocks,
            GeneratedFields generated) {
        boolean staticInitializer = isStaticInitializer(edge.from());
        if (!isConstructor(edge.from()) && !staticInitializer) return null;
        SourceSpan site = siteOf(edge);
        if (site == null || site.startLine() <= 0) return null;
        NodeId type = declaringType(edge.from());
        for (FieldNode field : fieldsByType.getOrDefault(type, List.of())) {
            if (holds(field.locations().get(0), site)) return field;
        }
        if (staticInitializer) {
            for (SourceSpan block : staticBlocks.getOrDefault(type, List.of())) if (holds(block, site)) return null;
            if (compilerMade(edge)) return null;
        }
        return generated.at(edge);
    }

    private static final String ASSERTION_STATUS = "M:java.lang.Class`1#desiredAssertionStatus()";

    /**
     * What javac compiles into a static initializer on the class's first line, which is the processor's annotation's
     * when it comes first: the assertion switch ({@code $assertionsDisabled = !T.class.desiredAssertionStatus()}) and,
     * before JDK 15, an enum's {@code $VALUES = new T[] {A, B}}, reading its own constants.
     */
    private static boolean compilerMade(Edge edge) {
        if (edge instanceof Edge.Invokes call) return call.to().value().equals(ASSERTION_STATUS);
        return edge instanceof Edge.Accesses access && access.access() == AccessKind.READ && declaringType(access.to()).equals(declaringType(access.from()));
    }

    /**
     * The fields only the class files have, of the types the sources declare (Lombok's logger, {@code @Synchronized}'s
     * lock), by the line of their initializer: that of the static initializer's store into a static one, of a
     * constructor's into an instance one. Lombok puts a generated initializer on its annotation's line, so a line tells
     * the initializers apart, unless several fields store on it.
     */
    private record GeneratedFields(Map<String, FieldNode> byLine, Set<String> shared, Set<NodeId> sharedStatic) {

        static GeneratedFields of(CodeModelFile bytecode, CodeModelFile source) {
            Set<NodeId> declared = new HashSet<>();
            for (DeclarationNode node : source.nodes()) declared.add(node.id());
            Map<NodeId, FieldNode> fields = new HashMap<>();
            for (DeclarationNode node : bytecode.nodes()) {
                if (node instanceof FieldNode field && !declared.contains(field.id()) && declared.contains(declaringType(field.id()))) fields.put(field.id(), field);
            }
            GeneratedFields generated = new GeneratedFields(new HashMap<>(), new HashSet<>(), new HashSet<>());
            if (fields.isEmpty()) return generated;
            for (Edge edge : bytecode.edges()) {
                if (!(edge instanceof Edge.Accesses store) || store.access() != AccessKind.WRITE) continue;
                FieldNode field = fields.get(store.to());
                if (field == null || !declaringType(field.id()).equals(declaringType(store.from()))) continue;
                boolean isStatic = field.modifiers().contains(Modifier.STATIC);
                if (isStatic ? !isStaticInitializer(store.from()) : !isConstructor(store.from())) continue;
                String line = lineKey(store.from(), store.site().location());
                if (line == null) continue;
                FieldNode before = generated.byLine().putIfAbsent(line, field);
                if (before == null || before.id().equals(field.id())) continue;
                generated.shared().add(line);
                if (isStatic) generated.sharedStatic().add(declaringType(field.id()));
            }
            return generated;
        }

        /** The generated field whose initializer is on the line of the edge, from the field's initializer kind; null when none or several are. */
        FieldNode at(Edge edge) {
            String line = lineKey(edge.from(), siteOf(edge));
            return line == null || shared.contains(line) ? null : byLine.get(line);
        }
    }

    /** {@code S|T:p.T|src/p/T.java:3}: static or instance initializer, its type, and a line. */
    private static String lineKey(NodeId initializer, SourceSpan site) {
        if (site == null || site.startLine() <= 0) return null;
        return (isStaticInitializer(initializer) ? "S|" : "I|") + declaringType(initializer) + "|" + site.file() + ":" + site.startLine();
    }

    private static boolean holds(SourceSpan declaration, SourceSpan site) {
        return declaration.file().equals(site.file()) && declaration.startLine() <= site.startLine() && site.startLine() <= declaration.endLine();
    }

    private static boolean isStaticInitializer(NodeId id) {
        return id.value().endsWith("#" + JavaIds.STATIC_INITIALIZER_NAME + "()");
    }

    private static boolean isConstructor(NodeId id) {
        return id.value().contains("#.ctor(");
    }

    private static SourceSpan siteOf(Edge edge) {
        if (edge instanceof Edge.Invokes e) return e.site().location();
        if (edge instanceof Edge.Accesses e) return e.site().location();
        if (edge instanceof Edge.UsesType e) return e.site().location();
        return null;
    }

    private static Edge withFrom(Edge edge, NodeId from) {
        if (edge instanceof Edge.Invokes e) return new Edge.Invokes(from, e.to(), e.typeArguments(), e.site(), e.invocationKind(), e.receiver());
        if (edge instanceof Edge.Accesses e) return new Edge.Accesses(from, e.to(), e.access(), e.site(), e.receiver());
        if (edge instanceof Edge.UsesType e) return new Edge.UsesType(from, e.to(), e.role(), e.site());
        return edge;
    }

    /** {@code T:p.T} for {@code M:p.T#m()} and for {@code F:p.T.f}. */
    static NodeId declaringType(NodeId member) {
        String path = member.canonicalPath();
        int hash = path.indexOf('#');
        return NodeId.of(NodeKindLetter.TYPE, path.substring(0, hash >= 0 ? hash : path.lastIndexOf('.')));
    }
}
