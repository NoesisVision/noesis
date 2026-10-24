package vision.noesis.parser.core.source;

import com.sun.source.tree.AnnotationTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.AssignmentTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.PackageTree;
import com.sun.source.tree.TypeParameterTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.SourcePositions;
import com.sun.source.util.TreePath;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.lang.model.element.AnnotationMirror;
import javax.lang.model.element.Element;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.util.SimpleAnnotationValueVisitor14;
import vision.noesis.parser.core.java.Literals;
import vision.noesis.parser.model.Annotation;
import vision.noesis.parser.model.AnnotationArgument;
import vision.noesis.parser.model.AnnotationValue;

/**
 * Annotation mirrors as annotations: explicit element values only, named by element, positional when written without
 * {@code name =}. The container javac synthesizes for repeated annotations is not written at all, so its own arguments
 * are not positional; the repeats inside it are read off their own trees.
 */
final class SourceAnnotations {

    private final SourceContext context;

    SourceAnnotations(SourceContext context) {
        this.context = context;
    }

    List<Annotation> of(Element element) {
        List<Annotation> annotations = new ArrayList<>();
        // javac's getTree(element, mirror) dereferences the element's path, which a mandated or classpath element lacks.
        TreePath path = context.javac.trees().getPath(element);
        CompilationUnitTree unit = path == null ? null : path.getCompilationUnit();
        for (AnnotationMirror mirror : element.getAnnotationMirrors()) {
            com.sun.source.tree.Tree tree = path == null ? null : context.javac.trees().getTree(element, mirror);
            List<AnnotationTree> repeats = path == null || tree instanceof AnnotationTree ? null : repeatsOf(mirror, path);
            annotations.add(repeats != null ? container(mirror, repeats, unit) : of(mirror, tree instanceof AnnotationTree annotationTree ? annotationTree : null, unit));
        }
        return annotations;
    }

    /** A synthesized container: no argument of it is written, so none is positional; each repeat reads its own tree. */
    private Annotation container(AnnotationMirror mirror, List<AnnotationTree> repeats, CompilationUnitTree unit) {
        List<AnnotationArgument> arguments = new ArrayList<>();
        for (Map.Entry<? extends ExecutableElement, ? extends javax.lang.model.element.AnnotationValue> entry : mirror.getElementValues().entrySet()) {
            String name = entry.getKey().getSimpleName().toString();
            AnnotationValue value = valueOf(entry.getValue());
            if (name.equals("value")) {
                List<AnnotationMirror> nested = nestedIn(entry.getValue());
                List<AnnotationValue> items = new ArrayList<>(nested.size());
                for (int i = 0; i < nested.size(); i++) items.add(new AnnotationValue.Nested(of(nested.get(i), repeats.get(i), unit)));
                value = new AnnotationValue.Array(items);
            }
            arguments.add(new AnnotationArgument(name, false, value));
        }
        return new Annotation(context.types.of(mirror.getAnnotationType()), arguments);
    }

    /**
     * The trees of the repeats in a mirror that has no tree of its own: the declaration's annotations of the repeated
     * type, which javac puts into the container in source order; null when the mirror is no such container.
     */
    private List<AnnotationTree> repeatsOf(AnnotationMirror mirror, TreePath path) {
        List<AnnotationMirror> nested = null;
        for (Map.Entry<? extends ExecutableElement, ? extends javax.lang.model.element.AnnotationValue> entry : mirror.getElementValues().entrySet()) {
            if (entry.getKey().getSimpleName().contentEquals("value")) nested = nestedIn(entry.getValue());
        }
        if (nested == null || nested.isEmpty()) return null;
        TypeMirror repeated = nested.get(0).getAnnotationType();
        List<AnnotationTree> repeats = new ArrayList<>();
        for (AnnotationTree tree : declaredOn(path.getLeaf())) {
            TypeMirror type = context.javac.trees().getTypeMirror(new TreePath(new TreePath(path, tree), tree.getAnnotationType()));
            if (type != null && context.javac.types().isSameType(type, repeated)) repeats.add(tree);
        }
        return repeats.size() == nested.size() ? repeats : null;
    }

    /** The annotations in an array value; null when it holds anything else. */
    private static List<AnnotationMirror> nestedIn(javax.lang.model.element.AnnotationValue value) {
        if (!(value.getValue() instanceof List<?> items)) return null;
        List<AnnotationMirror> nested = new ArrayList<>(items.size());
        for (Object item : items) {
            if (!(item instanceof javax.lang.model.element.AnnotationValue element) || !(element.getValue() instanceof AnnotationMirror annotation)) return null;
            nested.add(annotation);
        }
        return nested;
    }

    private static List<? extends AnnotationTree> declaredOn(com.sun.source.tree.Tree declaration) {
        if (declaration instanceof ClassTree type) return type.getModifiers().getAnnotations();
        if (declaration instanceof MethodTree method) return method.getModifiers().getAnnotations();
        if (declaration instanceof VariableTree variable) return variable.getModifiers().getAnnotations();
        if (declaration instanceof TypeParameterTree parameter) return parameter.getAnnotations();
        if (declaration instanceof PackageTree pkg) return pkg.getAnnotations();
        if (declaration instanceof CompilationUnitTree unit) return unit.getPackageAnnotations();
        return List.of();
    }

    /** The type annotations on a type mirror (a {@code TYPE_USE} annotation on a return type); no tree, so every argument counts as positional. */
    List<Annotation> ofType(javax.lang.model.type.TypeMirror type) {
        List<Annotation> annotations = new ArrayList<>();
        for (AnnotationMirror mirror : type.getAnnotationMirrors()) annotations.add(of(mirror, null, null));
        return annotations;
    }

    Annotation of(AnnotationMirror mirror, AnnotationTree tree, CompilationUnitTree unit) {
        Set<String> written = namedInSource(tree, unit);
        List<AnnotationArgument> arguments = new ArrayList<>();
        for (Map.Entry<? extends ExecutableElement, ? extends javax.lang.model.element.AnnotationValue> entry : mirror.getElementValues().entrySet()) {
            String name = entry.getKey().getSimpleName().toString();
            boolean positional = tree == null ? name.equals("value") : !written.contains(name);
            arguments.add(new AnnotationArgument(name, positional, valueOf(entry.getValue())));
        }
        return new Annotation(context.types.of(mirror.getAnnotationType()), arguments);
    }

    /** javac's parser rewrites {@code @A("x")} into {@code value = "x"}, so an argument counts as named only when the source spells its name. */
    private Set<String> namedInSource(AnnotationTree tree, CompilationUnitTree unit) {
        Set<String> names = new HashSet<>();
        if (tree == null || unit == null) return names;
        SourcePositions positions = context.javac.trees().getSourcePositions();
        String source = context.javac.sourceText(unit);
        for (ExpressionTree argument : tree.getArguments()) {
            if (!(argument instanceof AssignmentTree assignment) || !(assignment.getVariable() instanceof IdentifierTree name)) continue;
            long start = positions.getStartPosition(unit, name);
            long valueStart = positions.getStartPosition(unit, assignment.getExpression());
            if (start >= 0 && start < valueStart && source.startsWith(name.getName().toString(), (int) start)) names.add(name.getName().toString());
        }
        return names;
    }

    AnnotationValue valueOf(javax.lang.model.element.AnnotationValue value) {
        return value.accept(new SimpleAnnotationValueVisitor14<AnnotationValue, Void>() {
            @Override
            protected AnnotationValue defaultAction(Object o, Void unused) {
                return new AnnotationValue.Literal(Literals.format(o));
            }

            @Override
            public AnnotationValue visitType(TypeMirror type, Void unused) {
                return new AnnotationValue.TypeValue(context.types.of(type));
            }

            @Override
            public AnnotationValue visitEnumConstant(VariableElement constant, Void unused) {
                TypeElement enumType = (TypeElement) constant.getEnclosingElement();
                return new AnnotationValue.EnumValue(context.types.of(enumType.asType()), constant.getSimpleName().toString());
            }

            @Override
            public AnnotationValue visitAnnotation(AnnotationMirror nested, Void unused) {
                return new AnnotationValue.Nested(of(nested, null, null));
            }

            @Override
            public AnnotationValue visitArray(List<? extends javax.lang.model.element.AnnotationValue> items, Void unused) {
                List<AnnotationValue> values = new ArrayList<>(items.size());
                for (javax.lang.model.element.AnnotationValue item : items) values.add(valueOf(item));
                return new AnnotationValue.Array(values);
            }

            @Override
            public AnnotationValue visitUnknown(javax.lang.model.element.AnnotationValue unknown, Void unused) {
                return new AnnotationValue.Other(String.valueOf(unknown));
            }
        }, null);
    }
}
