package vision.noesis.scanner.core.source;

import com.sun.source.tree.AnnotationTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.AssignmentTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.IdentifierTree;
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
import vision.noesis.scanner.core.java.Literals;
import vision.noesis.scanner.model.Annotation;
import vision.noesis.scanner.model.AnnotationArgument;
import vision.noesis.scanner.model.AnnotationValue;

/** Annotation mirrors as annotations: explicit element values only, named by element, positional when written without {@code name =}. */
final class SourceAnnotations {

    private final SourceContext context;

    SourceAnnotations(SourceContext context) {
        this.context = context;
    }

    List<Annotation> of(Element element) {
        List<Annotation> annotations = new ArrayList<>();
        // javac's getTree(element, mirror) dereferences the element's path, which a mandated or classpath element lacks.
        TreePath path = context.javac.trees().getPath(element);
        for (AnnotationMirror mirror : element.getAnnotationMirrors()) {
            com.sun.source.tree.Tree tree = path == null ? null : context.javac.trees().getTree(element, mirror);
            annotations.add(of(mirror, tree instanceof AnnotationTree annotationTree ? annotationTree : null, path == null ? null : path.getCompilationUnit()));
        }
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
