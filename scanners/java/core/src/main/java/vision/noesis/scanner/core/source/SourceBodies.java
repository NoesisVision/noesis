package vision.noesis.scanner.core.source;

import com.sun.source.tree.AnnotatedTypeTree;
import com.sun.source.tree.AnnotationTree;
import com.sun.source.tree.AssignmentTree;
import com.sun.source.tree.BindingPatternTree;
import com.sun.source.tree.BlockTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.CompoundAssignmentTree;
import com.sun.source.tree.ErroneousTree;
import com.sun.source.tree.ExpressionStatementTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.InstanceOfTree;
import com.sun.source.tree.LambdaExpressionTree;
import com.sun.source.tree.LiteralTree;
import com.sun.source.tree.MemberReferenceTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.NewArrayTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.ParenthesizedTree;
import com.sun.source.tree.StatementTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.TypeCastTree;
import com.sun.source.tree.UnaryTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.NestingKind;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.TypeParameterElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.ArrayType;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.ExecutableType;
import javax.lang.model.type.TypeKind;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.type.TypeVariable;
import javax.lang.model.util.ElementFilter;
import vision.noesis.scanner.core.Diagnostics;
import vision.noesis.scanner.model.AccessKind;
import vision.noesis.scanner.model.Edge;
import vision.noesis.scanner.model.ExpressionKind;
import vision.noesis.scanner.model.InvocationKind;
import vision.noesis.scanner.model.LanguageBag;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.SourceSpan;
import vision.noesis.scanner.model.TypeRef;
import vision.noesis.scanner.model.TypeUseRole;
import vision.noesis.scanner.model.UsageSite;

/**
 * Walks every body of a compilation unit for the body-level facts: INVOKES, ACCESSES, USES_TYPE and the diagnostics of
 * sites javac could not bind. Method bodies attribute to the method, field initializers to the field, static blocks to
 * {@code .cctor}, instance initializer blocks to every constructor that does not delegate to {@code this(...)}, lambdas
 * to the enclosing member via closure, and local and anonymous classes to their own members.
 */
final class SourceBodies extends TreePathScanner<Void, Void> {

    /** The member whose body is being walked. */
    private static final class Frame {
        final NodeId from;
        final ExecutableElement constructor;
        final Tree declaration;
        boolean sawConstructorCall;

        Frame(NodeId from, ExecutableElement constructor, Tree declaration) {
            this.from = from;
            this.constructor = constructor;
            this.declaration = declaration;
        }
    }

    private final SourceContext c;
    private final SourceDeclarations declarations;
    private final Trees trees;
    private CompilationUnitTree unit;
    private String sourceText;
    private Frame frame;
    private int closureDepth;

    SourceBodies(SourceContext context, SourceDeclarations declarations) {
        this.c = context;
        this.declarations = declarations;
        this.trees = context.javac.trees();
    }

    void scanUnit(CompilationUnitTree compilationUnit) {
        unit = compilationUnit;
        sourceText = c.javac.sourceText(compilationUnit);
        for (Tree declaration : compilationUnit.getTypeDecls()) {
            if (declaration instanceof ClassTree) scan(new TreePath(new TreePath(compilationUnit), declaration), null);
        }
    }

    // --- Members -----------------------------------------------------------------------------------------------------

    /** What a class's members leave for the end of the class: its constructors and its instance initializer blocks. */
    private static final class ClassState {
        final Map<MethodTree, ExecutableElement> constructors = new LinkedHashMap<>();
        final List<BlockTree> instanceInitializers = new ArrayList<>();
    }

    private ClassState classState;
    private boolean rescanningInitializer;

    @Override
    public Void visitClass(ClassTree tree, Void unused) {
        Element element = trees.getElement(getCurrentPath());
        if (!(element instanceof TypeElement type)) return null;
        if (type.getNestingKind() == NestingKind.LOCAL || type.getNestingKind() == NestingKind.ANONYMOUS) {
            NodeId typeId = declarations.emitType(type, frame == null ? null : frame.from);
            TypeElement outer = SourceIds.enclosingType(type);
            if (typeId != null && outer != null) c.builder.edge(new Edge.Contains(c.ids.type(outer), typeId));
        }
        Frame savedFrame = frame;
        int savedDepth = closureDepth;
        ClassState savedState = classState;
        closureDepth = 0;
        classState = new ClassState();
        for (Tree member : tree.getMembers()) {
            if (member instanceof MethodTree || member instanceof VariableTree || member instanceof BlockTree || member instanceof ClassTree) scan(member, unused);
        }
        for (Map.Entry<MethodTree, ExecutableElement> constructor : classState.constructors.entrySet()) {
            if (startsWithThisCall(constructor.getKey())) continue;
            frame = new Frame(c.ids.member(constructor.getValue()), constructor.getValue(), constructor.getKey());
            rescanningInitializer = true;
            for (BlockTree block : classState.instanceInitializers) scan(block, unused);
            rescanningInitializer = false;
        }
        addImplicitSuperCallsOfTreelessConstructors(type, tree, classState.constructors.values());
        frame = savedFrame;
        closureDepth = savedDepth;
        classState = savedState;
        return null;
    }

    private boolean isClassMember() {
        TreePath parent = getCurrentPath().getParentPath();
        return parent != null && parent.getLeaf() instanceof ClassTree;
    }

    @Override
    public Void visitMethod(MethodTree method, Void unused) {
        Element element = trees.getElement(getCurrentPath());
        if (!(element instanceof ExecutableElement executable)) return null;
        boolean constructor = executable.getKind() == ElementKind.CONSTRUCTOR;
        Frame saved = frame;
        frame = new Frame(c.ids.member(executable), constructor ? executable : null, method);
        scan(method.getBody(), unused);
        if (constructor && !frame.sawConstructorCall && method.getBody() != null) addImplicitSuperCall(executable, method);
        frame = saved;
        if (constructor && classState != null) classState.constructors.put(method, executable);
        return null;
    }

    /** A field's initializer belongs to the field; a compile-time constant is folded and has no body. A local variable is just walked. */
    @Override
    public Void visitVariable(VariableTree variable, Void unused) {
        if (!isClassMember()) return scan(variable.getInitializer(), unused);
        if (variable.getInitializer() == null) return null;
        Element element = trees.getElement(getCurrentPath());
        if (!(element instanceof VariableElement field) || field.getConstantValue() != null) return null;
        if (field.getKind() != ElementKind.FIELD && field.getKind() != ElementKind.ENUM_CONSTANT) return null;
        Frame saved = frame;
        frame = new Frame(c.ids.member(field), null, variable);
        scan(variable.getInitializer(), unused);
        frame = saved;
        return null;
    }

    /** A static block is the body of {@code .cctor}; an instance block runs in every constructor and is walked once per constructor. */
    @Override
    public Void visitBlock(BlockTree block, Void unused) {
        if (!isClassMember() || rescanningInitializer) return super.visitBlock(block, unused);
        if (!block.isStatic()) {
            classState.instanceInitializers.add(block);
            return null;
        }
        TypeElement type = (TypeElement) trees.getElement(getCurrentPath().getParentPath());
        Frame saved = frame;
        frame = new Frame(c.ids.staticInitializer(type), null, block);
        super.visitBlock(block, unused);
        frame = saved;
        return null;
    }

    private static boolean startsWithThisCall(MethodTree constructor) {
        if (constructor.getBody() == null || constructor.getBody().getStatements().isEmpty()) return false;
        StatementTree first = constructor.getBody().getStatements().get(0);
        return first instanceof ExpressionStatementTree statement
                && statement.getExpression() instanceof MethodInvocationTree invocation
                && invocation.getMethodSelect() instanceof IdentifierTree name
                && name.getName().contentEquals("this");
    }

    /** A constructor javac declared without a tree still calls its superclass constructor. */
    private void addImplicitSuperCallsOfTreelessConstructors(TypeElement type, ClassTree tree, java.util.Collection<ExecutableElement> withTrees) {
        for (ExecutableElement constructor : ElementFilter.constructorsIn(type.getEnclosedElements())) {
            if (withTrees.contains(constructor)) continue;
            if (trees.getTree(constructor) != null) continue;
            Frame saved = frame;
            frame = new Frame(c.ids.member(constructor), constructor, tree);
            addImplicitSuperCall(constructor, tree);
            frame = saved;
        }
    }

    /** The {@code super()} every constructor without an explicit constructor call makes; located at the constructor's start. */
    private void addImplicitSuperCall(ExecutableElement constructor, Tree declaration) {
        TypeElement owner = (TypeElement) constructor.getEnclosingElement();
        ExecutableElement target = implicitSuperConstructor(owner);
        if (target == null) return;
        SourceSpan location = c.locations.startOf(unit, declaration);
        if (location == null) location = c.locations.startOf(unit, trees.getTree(owner));
        if (location == null) return;
        c.builder.edge(new Edge.Invokes(frame.from, c.ids.member(target), List.of(), implicitSite(location), InvocationKind.CALL, ExpressionKind.BASE));
    }

    /** The no-argument constructor of the superclass; {@code Enum(String, int)} for an enum. */
    private ExecutableElement implicitSuperConstructor(TypeElement owner) {
        TypeElement superclass = SourceDeclarations.superclassOf(owner);
        if (superclass == null) return null;
        int expected = owner.getKind() == ElementKind.ENUM ? 2 : 0;
        for (ExecutableElement candidate : ElementFilter.constructorsIn(superclass.getEnclosedElements())) {
            if (candidate.getParameters().size() == expected) return candidate;
        }
        return null;
    }

    private static UsageSite implicitSite(SourceSpan location) {
        return new UsageSite(location, false, LanguageBag.of(Map.of("java.implicitSuperCall", true)));
    }

    // --- INVOKES -----------------------------------------------------------------------------------------------------

    @Override
    public Void visitMethodInvocation(MethodInvocationTree tree, Void unused) {
        Element element = trees.getElement(getCurrentPath());
        if (!(element instanceof ExecutableElement method)) {
            unbound(tree);
            return super.visitMethodInvocation(tree, unused);
        }
        ExpressionTree select = tree.getMethodSelect();
        if (method.getKind() == ElementKind.CONSTRUCTOR) {
            addConstructorCall(tree, method, select);
        } else {
            c.builder.edge(new Edge.Invokes(frame.from, c.ids.member(method), typeArgumentsOf(tree, method), site(tree, null), InvocationKind.CALL, receiverOf(select, method)));
        }
        return super.visitMethodInvocation(tree, unused);
    }

    /** {@code this(...)}, {@code super(...)}, or the {@code super()} javac inserted, which the source does not spell. */
    private void addConstructorCall(MethodInvocationTree tree, ExecutableElement constructor, ExpressionTree select) {
        frame.sawConstructorCall = true;
        boolean thisCall = select instanceof IdentifierTree name && name.getName().contentEquals("this");
        boolean synthetic = c.locations.isSynthetic(unit, tree, sourceText, thisCall ? "this" : "super");
        UsageSite site;
        if (synthetic) {
            SourceSpan location = c.locations.startOf(unit, frame.declaration);
            if (location == null) return;
            site = implicitSite(location);
        } else {
            site = site(tree, null);
        }
        c.builder.edge(new Edge.Invokes(frame.from, c.ids.member(constructor), List.of(), site, InvocationKind.CALL, thisCall ? ExpressionKind.THIS : ExpressionKind.BASE));
    }

    private ExpressionKind receiverOf(ExpressionTree select, ExecutableElement method) {
        if (select instanceof MemberSelectTree member) return classify(member.getExpression());
        return method.getModifiers().contains(Modifier.STATIC) ? ExpressionKind.TYPE : ExpressionKind.THIS;
    }

    /** Explicit type arguments as written; inferred ones recovered from the instantiated method type where they bind plainly. */
    private List<TypeRef> typeArgumentsOf(MethodInvocationTree tree, ExecutableElement method) {
        if (method.getTypeParameters().isEmpty()) return List.of();
        List<TypeRef> arguments = new ArrayList<>();
        if (!tree.getTypeArguments().isEmpty()) {
            for (Tree argument : tree.getTypeArguments()) arguments.add(c.types.of(trees.getTypeMirror(new TreePath(getCurrentPath(), argument))));
            return arguments;
        }
        TypeMirror instantiated = trees.getTypeMirror(new TreePath(getCurrentPath(), tree.getMethodSelect()));
        if (!(instantiated instanceof ExecutableType instance) || !(method.asType() instanceof ExecutableType declared)) return List.of();
        Map<TypeParameterElement, TypeMirror> bindings = new HashMap<>();
        for (int i = 0; i < declared.getParameterTypes().size() && i < instance.getParameterTypes().size(); i++) {
            bind(declared.getParameterTypes().get(i), instance.getParameterTypes().get(i), method, bindings);
        }
        bind(declared.getReturnType(), instance.getReturnType(), method, bindings);
        for (TypeParameterElement parameter : method.getTypeParameters()) {
            TypeMirror bound = bindings.get(parameter);
            if (bound == null) return List.of();
            arguments.add(c.types.of(bound));
        }
        return arguments;
    }

    private static void bind(TypeMirror declared, TypeMirror actual, ExecutableElement method, Map<TypeParameterElement, TypeMirror> bindings) {
        if (declared.getKind() == TypeKind.TYPEVAR) {
            Element parameter = ((TypeVariable) declared).asElement();
            if (parameter instanceof TypeParameterElement typeParameter && method.equals(typeParameter.getGenericElement()) && actual.getKind() != TypeKind.TYPEVAR) {
                bindings.putIfAbsent(typeParameter, actual);
            } else if (parameter instanceof TypeParameterElement typeParameter && method.equals(typeParameter.getGenericElement())) {
                bindings.putIfAbsent(typeParameter, actual);
            }
        } else if (declared.getKind() == TypeKind.DECLARED && actual.getKind() == TypeKind.DECLARED) {
            List<? extends TypeMirror> declaredArguments = ((DeclaredType) declared).getTypeArguments();
            List<? extends TypeMirror> actualArguments = ((DeclaredType) actual).getTypeArguments();
            for (int i = 0; i < declaredArguments.size() && i < actualArguments.size(); i++) bind(declaredArguments.get(i), actualArguments.get(i), method, bindings);
        } else if (declared.getKind() == TypeKind.ARRAY && actual.getKind() == TypeKind.ARRAY) {
            bind(((ArrayType) declared).getComponentType(), ((ArrayType) actual).getComponentType(), method, bindings);
        }
    }

    @Override
    public Void visitNewClass(NewClassTree tree, Void unused) {
        Element element = trees.getElement(getCurrentPath());
        TypeMirror created = trees.getTypeMirror(getCurrentPath());
        if (element instanceof ExecutableElement constructor) {
            List<TypeRef> typeArguments = c.types.of(created) instanceof TypeRef.Named named ? named.typeArguments() : List.of();
            c.builder.edge(new Edge.Invokes(frame.from, c.ids.member(constructor), typeArguments, site(tree, null), InvocationKind.CALL, null));
            scan(tree.getEnclosingExpression(), unused);
            scan(tree.getArguments(), unused);
            scan(tree.getClassBody(), unused);
            if (tree.getClassBody() != null) ensureAnonymousConstructor(constructor);
            return null;
        }
        if (created != null && created.getKind() == TypeKind.DECLARED) {
            addTypeUse(created, TypeUseRole.CREATION, tree);
        } else {
            unbound(tree);
        }
        scan(tree.getEnclosingExpression(), unused);
        scan(tree.getArguments(), unused);
        scan(tree.getClassBody(), unused);
        return null;
    }

    /** An anonymous class's constructor is javac's; it is a node so the creation has a target. */
    private void ensureAnonymousConstructor(ExecutableElement constructor) {
        if (c.builder.hasNode(c.ids.member(constructor))) return;
        TypeElement owner = (TypeElement) constructor.getEnclosingElement();
        NodeId id = declarations.emitMethod(constructor, owner, java.util.Set.of());
        if (id != null) c.builder.edge(new Edge.Contains(c.ids.type(owner), id));
    }

    // --- USES_TYPE ---------------------------------------------------------------------------------------------------

    @Override
    public Void visitTypeCast(TypeCastTree tree, Void unused) {
        addTypeUse(trees.getTypeMirror(new TreePath(getCurrentPath(), tree.getType())), TypeUseRole.CAST, tree);
        return scan(tree.getExpression(), unused);
    }

    @Override
    public Void visitInstanceOf(InstanceOfTree tree, Void unused) {
        Tree type = tree.getType();
        if (type == null && tree.getPattern() instanceof BindingPatternTree binding) type = binding.getVariable().getType();
        if (type != null) addTypeUse(trees.getTypeMirror(new TreePath(getCurrentPath(), type)), TypeUseRole.TYPE_TEST, tree);
        return scan(tree.getExpression(), unused);
    }

    @Override
    public Void visitNewArray(NewArrayTree tree, Void unused) {
        TypeMirror type = trees.getTypeMirror(getCurrentPath());
        if (type != null && type.getKind() == TypeKind.ARRAY) addTypeUse(type, TypeUseRole.CREATION, tree);
        scan(tree.getDimensions(), unused);
        scan(tree.getInitializers(), unused);
        return null;
    }

    // --- ACCESSES ----------------------------------------------------------------------------------------------------

    @Override
    public Void visitMemberSelect(MemberSelectTree tree, Void unused) {
        Element element = trees.getElement(getCurrentPath());
        if (element instanceof VariableElement field && isFieldAccess(field) && !isThisOrSuper(tree.getIdentifier().toString())) {
            addAccess(field, tree, classify(tree.getExpression()));
        }
        return scan(tree.getExpression(), unused);
    }

    @Override
    public Void visitIdentifier(IdentifierTree tree, Void unused) {
        Element element = trees.getElement(getCurrentPath());
        if (element instanceof VariableElement field && isFieldAccess(field) && !isThisOrSuper(tree.getName().toString())) {
            addAccess(field, tree, field.getModifiers().contains(Modifier.STATIC) ? ExpressionKind.TYPE : ExpressionKind.THIS);
        }
        return null;
    }

    /** Fields and enum constants that are not compile-time constants, which javac folds; an array's {@code length} is no member. */
    private static boolean isFieldAccess(VariableElement variable) {
        if (variable.getKind() != ElementKind.FIELD && variable.getKind() != ElementKind.ENUM_CONSTANT) return false;
        if (variable.getConstantValue() != null) return false;
        Element owner = variable.getEnclosingElement();
        return owner instanceof TypeElement type && !(type.getQualifiedName().contentEquals("Array") && variable.getSimpleName().contentEquals("length"));
    }

    private static boolean isThisOrSuper(String name) {
        return name.equals("this") || name.equals("super");
    }

    private void addAccess(VariableElement field, Tree tree, ExpressionKind receiver) {
        c.builder.edge(new Edge.Accesses(frame.from, c.ids.member(field), accessKind(getCurrentPath()), site(tree, null), receiver));
    }

    /** Read, write or both, from what the reference sits in: assignment target, compound assignment, increment. */
    private static AccessKind accessKind(TreePath path) {
        Tree node = path.getLeaf();
        TreePath parentPath = path.getParentPath();
        while (parentPath != null && parentPath.getLeaf() instanceof ParenthesizedTree) {
            node = parentPath.getLeaf();
            parentPath = parentPath.getParentPath();
        }
        if (parentPath == null) return AccessKind.READ;
        Tree parent = parentPath.getLeaf();
        if (parent instanceof AssignmentTree assignment && assignment.getVariable() == node) return AccessKind.WRITE;
        if (parent instanceof CompoundAssignmentTree compound && compound.getVariable() == node) return AccessKind.READ_WRITE;
        if (parent instanceof UnaryTree unary) {
            switch (unary.getKind()) {
                case POSTFIX_INCREMENT: case POSTFIX_DECREMENT: case PREFIX_INCREMENT: case PREFIX_DECREMENT:
                    return AccessKind.READ_WRITE;
                default:
                    break;
            }
        }
        return AccessKind.READ;
    }

    // --- Closures, skipped trees, unbound sites ----------------------------------------------------------------------

    @Override
    public Void visitLambdaExpression(LambdaExpressionTree tree, Void unused) {
        closureDepth++;
        scan(tree.getBody(), unused);
        closureDepth--;
        return null;
    }

    /** A method reference is not a call (REFERENCES_METHOD is deferred); only its receiver is walked. */
    @Override
    public Void visitMemberReference(MemberReferenceTree tree, Void unused) {
        return scan(tree.getQualifierExpression(), unused);
    }

    @Override
    public Void visitAnnotation(AnnotationTree tree, Void unused) {
        return null;
    }

    @Override
    public Void visitAnnotatedType(AnnotatedTypeTree tree, Void unused) {
        return scan(tree.getUnderlyingType(), unused);
    }

    @Override
    public Void visitErroneous(ErroneousTree tree, Void unused) {
        unbound(tree);
        return null;
    }

    private void unbound(Tree tree) {
        SourceSpan span = c.locations.spanOf(unit, tree);
        c.builder.diagnostic(Diagnostics.info(Diagnostics.UNBOUND_SITE, "Could not bind '" + text(tree) + "'.", span));
    }

    // --- Emitting ----------------------------------------------------------------------------------------------------

    private void addTypeUse(TypeMirror type, TypeUseRole role, Tree tree) {
        if (type == null) return;
        c.builder.edge(new Edge.UsesType(frame.from, c.types.of(type), role, site(tree, null)));
    }

    private UsageSite site(Tree tree, Map<String, Object> bag) {
        SourceSpan span = c.locations.spanOf(unit, tree);
        return new UsageSite(span, closureDepth > 0, bag == null ? LanguageBag.EMPTY : LanguageBag.of(bag));
    }

    private String text(Tree tree) {
        long start = trees.getSourcePositions().getStartPosition(unit, tree);
        long end = trees.getSourcePositions().getEndPosition(unit, tree);
        String text = start < 0 || end < start ? tree.toString() : sourceText.substring((int) start, (int) end);
        text = text.replaceAll("\\R", " ");
        return text.length() <= 120 ? text : text.substring(0, 120) + "…";
    }

    // --- Classifying expressions -------------------------------------------------------------------------------------

    /** Looks through parentheses and casts to what the receiver expression denotes. */
    private ExpressionKind classify(ExpressionTree expression) {
        ExpressionTree current = expression;
        while (true) {
            if (current instanceof ParenthesizedTree parenthesized) current = parenthesized.getExpression();
            else if (current instanceof TypeCastTree cast) current = cast.getExpression();
            else break;
        }
        if (current instanceof IdentifierTree identifier) {
            String name = identifier.getName().toString();
            if (name.equals("this")) return ExpressionKind.THIS;
            if (name.equals("super")) return ExpressionKind.BASE;
            return kindOf(trees.getElement(new TreePath(getCurrentPath(), identifier)));
        }
        if (current instanceof MemberSelectTree select) {
            String name = select.getIdentifier().toString();
            if (name.equals("this")) return ExpressionKind.THIS;
            if (name.equals("super")) return ExpressionKind.BASE;
            if (name.equals("class")) return ExpressionKind.LITERAL;
            return kindOf(trees.getElement(new TreePath(getCurrentPath(), select)));
        }
        if (current instanceof MethodInvocationTree) return ExpressionKind.RETURN_VALUE;
        if (current instanceof NewClassTree || current instanceof NewArrayTree) return ExpressionKind.CREATION;
        if (current instanceof LiteralTree) return ExpressionKind.LITERAL;
        return ExpressionKind.OTHER;
    }

    private static ExpressionKind kindOf(Element element) {
        if (element == null) return ExpressionKind.OTHER;
        switch (element.getKind()) {
            case PARAMETER: return ExpressionKind.PARAMETER;
            case LOCAL_VARIABLE: case RESOURCE_VARIABLE: case EXCEPTION_PARAMETER: case BINDING_VARIABLE: return ExpressionKind.LOCAL;
            case FIELD: case ENUM_CONSTANT: return ExpressionKind.FIELD;
            case CLASS: case INTERFACE: case ENUM: case RECORD: case ANNOTATION_TYPE: case PACKAGE: return ExpressionKind.TYPE;
            case TYPE_PARAMETER: return ExpressionKind.TYPE_PARAMETER;
            default: return ExpressionKind.OTHER;
        }
    }
}
