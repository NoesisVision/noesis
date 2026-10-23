package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import vision.noesis.parser.model.Annotation;
import vision.noesis.parser.model.AnnotationArgument;
import vision.noesis.parser.model.AnnotationValue;
import vision.noesis.parser.model.AccessKind;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.DeclarationNode;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.ExpressionKind;
import vision.noesis.parser.model.FieldNode;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.NamespaceNode;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.Parameter;
import vision.noesis.parser.model.StubNode;
import vision.noesis.parser.model.TypeNode;
import vision.noesis.parser.model.TypeRef;
import vision.noesis.parser.model.TypeRef;
import vision.noesis.parser.model.TypeParameter;
import vision.noesis.parser.model.TypeParameterConstraint;

/** Queries over a model file, the way the .NET parser's tests read theirs; a failed lookup names the closest ids. */
final class Models {

    static final String SYNTAX = "vision.noesis.fixture.syntax.";
    static final String OTHER = "vision.noesis.fixture.other.";

    private Models() {}

    static final String LOMBOK = "vision.noesis.fixture.lombok.";

    /** The parse of the syntax fixture with the given engine, cached per engine. */
    static ParseResult parse(EngineKind engine) {
        return Fixtures.parse(engine);
    }

    static CodeModelFile lombok(EngineKind engine) {
        return Fixtures.lombok(engine).model("java-lombok");
    }

    static CodeModelFile syntax(EngineKind engine) {
        return parse(engine).model("java-syntax");
    }

    static CodeModelFile other(EngineKind engine) {
        return parse(engine).model("java-syntax-other");
    }

    static Optional<DeclarationNode> find(CodeModelFile model, String id) {
        return model.nodes().stream().filter(node -> node.id().value().equals(id)).findFirst();
    }

    static boolean has(CodeModelFile model, String id) {
        return find(model, id).isPresent();
    }

    static <T extends DeclarationNode> T node(CodeModelFile model, Class<T> kind, String id) {
        Optional<DeclarationNode> node = find(model, id);
        assertTrue(node.isPresent(), () -> "No node " + id + ". Closest: " + closest(model.nodes().stream().map(n -> n.id().value()), id));
        assertTrue(kind.isInstance(node.get()), () -> id + " is a " + node.get().getClass().getSimpleName() + ", not a " + kind.getSimpleName());
        return kind.cast(node.get());
    }

    static TypeNode type(CodeModelFile model, String path) {
        return node(model, TypeNode.class, "T:" + path);
    }

    static MethodNode method(CodeModelFile model, String path) {
        return node(model, MethodNode.class, "M:" + path);
    }

    static FieldNode field(CodeModelFile model, String path) {
        return node(model, FieldNode.class, "F:" + path);
    }

    static NamespaceNode namespace(CodeModelFile model, String path) {
        return node(model, NamespaceNode.class, "N:" + path);
    }

    static StubNode stub(CodeModelFile model, String id) {
        Optional<StubNode> stub = model.stubs().stream().filter(s -> s.id().value().equals(id)).findFirst();
        assertTrue(stub.isPresent(), () -> "No stub " + id + ". Closest: " + closest(model.stubs().stream().map(s -> s.id().value()), id));
        return stub.get();
    }

    static boolean hasStub(CodeModelFile model, String id) {
        return model.stubs().stream().anyMatch(s -> s.id().value().equals(id));
    }

    static <T extends Edge> Stream<T> edges(CodeModelFile model, Class<T> kind) {
        return model.edges().stream().filter(kind::isInstance).map(kind::cast);
    }

    static <T extends Edge> List<T> edgesFrom(CodeModelFile model, Class<T> kind, String from) {
        return edges(model, kind).filter(edge -> edge.from().value().equals(from)).collect(Collectors.toList());
    }

    static List<Edge.Invokes> invokes(CodeModelFile model, String from) {
        return edgesFrom(model, Edge.Invokes.class, from);
    }

    /** The INVOKES edges from one member to one target, in model order. */
    static List<Edge.Invokes> invokesTo(CodeModelFile model, String from, String to) {
        return invokes(model, from).stream().filter(edge -> edge.to().value().equals(to)).collect(Collectors.toList());
    }

    static List<Edge.Accesses> accesses(CodeModelFile model, String from) {
        return edgesFrom(model, Edge.Accesses.class, from);
    }

    static List<Edge.UsesType> usesTypes(CodeModelFile model, String from) {
        return edgesFrom(model, Edge.UsesType.class, from);
    }

    static boolean contains(CodeModelFile model, String from, String to) {
        return edges(model, Edge.Contains.class).anyMatch(edge -> edge.from().value().equals(from) && edge.to().value().equals(to));
    }

    static List<String> extendsOf(CodeModelFile model, String from) {
        return edgesFrom(model, Edge.Extends.class, from).stream().map(edge -> edge.to().canonical()).collect(Collectors.toList());
    }

    static List<String> implementsOf(CodeModelFile model, String from) {
        return edgesFrom(model, Edge.Implements.class, from).stream().map(edge -> edge.to().canonical()).collect(Collectors.toList());
    }

    static List<String> overridesOf(CodeModelFile model, String from) {
        return edgesFrom(model, Edge.Overrides.class, from).stream().map(edge -> edge.to().value()).collect(Collectors.toList());
    }

    static List<Edge.ImplementsMember> implementsMembersOf(CodeModelFile model, String from) {
        return edgesFrom(model, Edge.ImplementsMember.class, from);
    }

    /** Every IMPLEMENTS_MEMBER edge whose {@code declaredOn} is the given type. */
    static List<Edge.ImplementsMember> implementsMembersDeclaredOn(CodeModelFile model, String type) {
        return edges(model, Edge.ImplementsMember.class).filter(edge -> edge.declaredOn().value().equals(type)).collect(Collectors.toList());
    }

    /** The canonicals of a type parameter's type constraints, in declaration order; any other constraint kind fails. */
    static List<String> constraintsOf(TypeParameter parameter) {
        return parameter.constraints().stream().map(constraint -> {
            assertTrue(constraint instanceof TypeParameterConstraint.TypeConstraint, () -> parameter.name() + " has a non-type constraint " + constraint);
            return ((TypeParameterConstraint.TypeConstraint) constraint).type().canonical();
        }).collect(Collectors.toList());
    }

    /** An INVOKES edge to the method id, whatever the receiver. */
    static Predicate<Edge.Invokes> to(String id) {
        return edge -> edge.to().value().equals(id);
    }

    /** An INVOKES edge to the method id with the receiver; {@code null} is the receiver of a constructor call. */
    static Predicate<Edge.Invokes> to(String id, ExpressionKind receiver) {
        return edge -> edge.to().value().equals(id) && edge.receiver() == receiver;
    }

    static Predicate<Edge.Accesses> access(String id, AccessKind access) {
        return edge -> edge.to().value().equals(id) && edge.access() == access;
    }

    static List<String> typeArguments(Edge.Invokes edge) {
        return edge.typeArguments().stream().map(TypeRef::canonical).collect(Collectors.toList());
    }

    static <T> long count(List<T> items, Predicate<T> predicate) {
        return items.stream().filter(predicate).count();
    }

    /** Exactly one item matches; the message names what was looked for. */
    static <T> T one(List<T> items, Predicate<T> predicate, String what) {
        List<T> matches = items.stream().filter(predicate).collect(Collectors.toList());
        assertTrue(matches.size() == 1, () -> "Expected exactly one " + what + ", found " + matches.size() + (matches.isEmpty() ? " among " + items.size() + " items" : ": " + matches));
        return matches.get(0);
    }

    static <T> void atLeast(int expected, List<T> items, Predicate<T> predicate, String what) {
        long found = count(items, predicate);
        assertTrue(found >= expected, () -> "Expected at least " + expected + " " + what + ", found " + found + " among " + items.size());
    }

    static NodeId id(String value) {
        return new NodeId(value);
    }

    /** The one annotation of the given type, whatever order the engine wrote them in. */
    static Annotation annotation(List<Annotation> annotations, String typeId) {
        return one(annotations, a -> a.type() instanceof TypeRef.Named named && named.type().value().equals(typeId), "annotation " + typeId);
    }

    static AnnotationArgument argument(Annotation annotation, String name) {
        return one(annotation.arguments(), a -> a.name().equals(name), "argument " + name);
    }

    /** The source text of a literal annotation argument, as the model spells it. */
    static String literal(Annotation annotation, String name) {
        AnnotationValue value = argument(annotation, name).value();
        assertTrue(value instanceof AnnotationValue.Literal, () -> name + " is " + value);
        return ((AnnotationValue.Literal) value).text();
    }

    static Parameter parameter(MethodNode method, String name) {
        return one(method.signature().parameters(), p -> p.name().equals(name), "parameter " + name);
    }

    /** The canonical strings of a method's parameter types, in order. */
    static List<String> parameterTypes(MethodNode method) {
        return method.signature().parameters().stream().map(p -> p.type().canonical()).collect(Collectors.toList());
    }

    private static String closest(Stream<String> ids, String wanted) {
        String segment = lastSegment(wanted);
        return ids.filter(id -> id.contains(segment)).limit(5).collect(Collectors.joining(", "));
    }

    private static String lastSegment(String id) {
        String trimmed = id.endsWith(")") ? id.substring(0, id.indexOf('(')) : id;
        int cut = Math.max(trimmed.lastIndexOf('.'), Math.max(trimmed.lastIndexOf('#'), trimmed.lastIndexOf('+')));
        return cut < 0 ? trimmed : trimmed.substring(cut + 1);
    }
}
