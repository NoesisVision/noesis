package vision.noesis.scanner.core.hybrid;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import vision.noesis.scanner.model.AccessKind;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.DeclarationNode;
import vision.noesis.scanner.model.Edge;
import vision.noesis.scanner.model.FieldNode;
import vision.noesis.scanner.model.MethodNode;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.NodeKindLetter;
import vision.noesis.scanner.model.Parameter;
import vision.noesis.scanner.model.Signature;
import vision.noesis.scanner.model.SourceSpan;
import vision.noesis.scanner.model.TypeRef;

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
 *       lines of a field of its type is the field's, and the store into the field itself is no access.</li>
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
                List<MethodNode> candidates = compiledByNameAndArity.getOrDefault(nameAndArity(method), List.of());
                if (candidates.size() == 1) {
                    MethodNode match = candidates.get(0);
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
        for (DeclarationNode node : source.nodes()) {
            if (node instanceof FieldNode field && !field.locations().isEmpty()) {
                fieldsByType.computeIfAbsent(declaringType(field.id()), k -> new ArrayList<>()).add(field);
            }
        }
        if (fieldsByType.isEmpty()) return bytecode;
        // An instance initializer is copied into every constructor that does not delegate: the field takes one copy, the first constructor's by id.
        Map<NodeId, NodeId> constructorOf = new HashMap<>();
        for (Edge edge : bytecode.edges()) {
            FieldNode field = initializedField(edge, fieldsByType);
            if (field != null) constructorOf.merge(field.id(), edge.from(), (a, b) -> a.compareTo(b) <= 0 ? a : b);
        }
        List<Edge> edges = new ArrayList<>(bytecode.edges().size());
        boolean changed = false;
        for (Edge edge : bytecode.edges()) {
            FieldNode field = initializedField(edge, fieldsByType);
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

    /** The field of the constructor's or static initializer's type whose declaration holds the edge's line. */
    private static FieldNode initializedField(Edge edge, Map<NodeId, List<FieldNode>> fieldsByType) {
        String from = edge.from().value();
        if (!from.contains("#.ctor(") && !from.endsWith("#.cctor()")) return null;
        SourceSpan site = siteOf(edge);
        if (site == null || site.startLine() <= 0) return null;
        for (FieldNode field : fieldsByType.getOrDefault(declaringType(edge.from()), List.of())) {
            SourceSpan declaration = field.locations().get(0);
            if (declaration.file().equals(site.file()) && declaration.startLine() <= site.startLine() && site.startLine() <= declaration.endLine()) return field;
        }
        return null;
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
