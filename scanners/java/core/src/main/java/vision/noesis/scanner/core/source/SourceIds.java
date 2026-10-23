package vision.noesis.scanner.core.source;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Name;
import javax.lang.model.element.NestingKind;
import javax.lang.model.element.PackageElement;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.VariableElement;
import vision.noesis.scanner.core.java.JavaIds;
import vision.noesis.scanner.model.NodeId;

/** Stable ids from javac's elements; remembers every element an id was built for, so the closure can stub the external ones. */
final class SourceIds {

    private final SourceContext context;
    private final Map<Element, NodeId> cache = new HashMap<>();
    private final Map<TypeElement, String> typePaths = new HashMap<>();
    private final Set<Element> referenced = new LinkedHashSet<>();

    SourceIds(SourceContext context) {
        this.context = context;
    }

    /** Every declaration element an id was built for so far. */
    Set<Element> referencedElements() {
        return referenced;
    }

    NodeId namespace(PackageElement pkg) {
        return JavaIds.namespace(pkg.isUnnamed() ? "" : pkg.getQualifiedName().toString());
    }

    // Ids nest (a method id spells its parameter types), so the cache is filled with get-then-put, never computeIfAbsent.
    NodeId type(TypeElement type) {
        NodeId cached = cache.get(type);
        if (cached != null) return cached;
        NodeId id = JavaIds.type(typePath(type));
        cache.put(type, id);
        referenced.add(type);
        return id;
    }

    /** Package, then every enclosing type's binary-name segment with its own arity, {@code +}-joined. */
    String typePath(TypeElement type) {
        String cached = typePaths.get(type);
        if (cached != null) return cached;
        List<TypeElement> chain = new ArrayList<>();
        for (Element current = type; current != null; current = current.getEnclosingElement()) {
            if (current instanceof TypeElement enclosing) chain.add(0, enclosing);
            if (current.getKind() == ElementKind.PACKAGE) break;
        }
        PackageElement pkg = context.javac.elements().getPackageOf(type);
        List<String> names = new ArrayList<>();
        List<Integer> arities = new ArrayList<>();
        for (TypeElement level : chain) {
            names.add(binarySegment(level));
            arities.add(level.getTypeParameters().size());
        }
        String path = JavaIds.typePath(pkg.isUnnamed() ? "" : pkg.getQualifiedName().toString(), names, arities);
        typePaths.put(type, path);
        return path;
    }

    /** The segment of the binary name a type adds: its simple name, or the compiler's number for an anonymous class ({@code Outer$1}, {@code Outer$1Local}). */
    String binarySegment(TypeElement type) {
        String binary = context.javac.elements().getBinaryName(type).toString();
        TypeElement outer = enclosingType(type);
        if (outer == null) {
            int dot = binary.lastIndexOf('.');
            return dot < 0 ? binary : binary.substring(dot + 1);
        }
        String outerBinary = context.javac.elements().getBinaryName(outer).toString();
        return binary.startsWith(outerBinary + "$") ? binary.substring(outerBinary.length() + 1) : type.getSimpleName().toString();
    }

    /** The node's name: the simple name, the binary segment for an anonymous class, {@code .ctor} for a constructor. */
    String nodeName(Element element) {
        if (element instanceof TypeElement type && type.getNestingKind() == NestingKind.ANONYMOUS) return binarySegment(type);
        if (element instanceof ExecutableElement method) {
            if (method.getKind() == ElementKind.CONSTRUCTOR) return JavaIds.CONSTRUCTOR_NAME;
            if (method.getKind() == ElementKind.STATIC_INIT) return JavaIds.STATIC_INITIALIZER_NAME;
        }
        return element.getSimpleName().toString();
    }

    NodeId member(Element element) {
        if (element instanceof TypeElement type) return type(type);
        if (element instanceof PackageElement pkg) return namespace(pkg);
        NodeId cached = cache.get(element);
        if (cached != null) return cached;
        NodeId id;
        if (element instanceof ExecutableElement method) id = method(method);
        else if (element instanceof VariableElement field) id = JavaIds.field(typePath(enclosingType(field)), field.getSimpleName().toString());
        else throw new IllegalArgumentException("Not a declaration element: " + element.getKind() + " " + element);
        cache.put(element, id);
        referenced.add(element);
        return id;
    }

    NodeId staticInitializer(TypeElement owner) {
        return JavaIds.method(typePath(owner), JavaIds.STATIC_INITIALIZER_NAME, 0, List.of());
    }

    private NodeId method(ExecutableElement method) {
        List<String> parameters = new ArrayList<>();
        for (VariableElement parameter : method.getParameters()) parameters.add(context.types.idCanonical(parameter.asType()));
        return JavaIds.method(typePath(enclosingType(method)), nodeName(method), method.getTypeParameters().size(), parameters);
    }

    static TypeElement enclosingType(Element element) {
        for (Element current = element.getEnclosingElement(); current != null; current = current.getEnclosingElement()) {
            if (current instanceof TypeElement type) return type;
            if (current.getKind() == ElementKind.PACKAGE) return null;
        }
        return null;
    }

    static boolean isNamed(Name name, String text) {
        return name.contentEquals(text);
    }
}
