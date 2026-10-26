package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static vision.noesis.parser.core.Models.SYNTAX;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.DeclarationNode;
import vision.noesis.parser.model.FieldNode;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.TypeNode;

/** The three {@code typeusage} fixtures put an own, an other-module and a library type in the same member positions; the model declares the same member names, nested types and member shapes for each. Edges and bodies are not compared here. */
class TypeUsageMirrorTest {

    private static final String OWN = SYNTAX + "typeusage.OwnModuleTypeUsage";
    private static final String OTHER = SYNTAX + "typeusage.OtherModuleTypeUsage";
    private static final String LIBRARY = SYNTAX + "typeusage.LibraryTypeUsage";

    /** Members each fixture needs because of what its base type or interfaces declare, not because of where the type comes from. */
    private static final Set<String> OWN_ONLY = Set.of("abstractMethodInAbstractClass", "methodInInterface", "put");
    private static final Set<String> OTHER_ONLY = Set.of("abstractMethodFromOtherModule", "plainMethodFromOtherModule", "put");
    private static final Set<String> LIBRARY_ONLY = Set.of("doForward", "doBackward", "intern");

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void theThreeUsagesDeclareTheSameMemberNames(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        Set<String> own = names(model, OWN, OWN_ONLY);
        Set<String> other = names(model, OTHER, OTHER_ONLY);
        Set<String> library = names(model, LIBRARY, LIBRARY_ONLY);
        assertEquals(own, other);
        assertEquals(own, library);
        assertTrue(own.size() >= 50, own.toString());
        assertTrue(own.containsAll(List.of("field", "listField", "arrayField", "constrainedToClass", "bodyLevelUse", "explicitTypeArguments", "CONST_ENUM_FIELD", ".ctor")), own.toString());
        assertTrue(members(model, OWN).containsKey("put") && members(model, OTHER).containsKey("put") && !members(model, LIBRARY).containsKey("put"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void theNestedTypesHaveTheSameSimpleNames(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        Set<String> expected = new TreeSet<>(List.of("DerivedFromGenericClassOfOrigin", "DerivedFromGenericOfOwnType", "EnumInTypeUsage", "FunctionalInterfaceWithCustomTypes",
                "GenericClassConstrainedToCustomTypes", "InterfaceWithCustomTypeMembers", "LocalFunction", "NestedClassWithCustomTypes", "RecordWithCustomTypeMembers"));
        for (String owner : List.of(OWN, OTHER, LIBRARY)) {
            assertEquals(expected, nestedTypeNames(model, owner), owner);
        }
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void sharedMembersHaveTheSameShapeWhateverTheTypeOrigin(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        Map<String, DeclarationNode> own = members(model, OWN);
        Map<String, DeclarationNode> other = members(model, OTHER);
        Map<String, DeclarationNode> library = members(model, LIBRARY);
        Set<String> shared = new TreeSet<>(own.keySet());
        shared.retainAll(other.keySet());
        shared.retainAll(library.keySet());
        for (String name : shared) {
            assertEquals(own.get(name).getClass(), other.get(name).getClass(), name);
            assertEquals(own.get(name).getClass(), library.get(name).getClass(), name);
            if (own.get(name) instanceof FieldNode field) {
                assertEquals(field.type().getClass(), ((FieldNode) other.get(name)).type().getClass(), name);
                assertEquals(field.type().getClass(), ((FieldNode) library.get(name)).type().getClass(), name);
                assertEquals(field.modifiers(), ((FieldNode) other.get(name)).modifiers(), name);
            }
            if (own.get(name) instanceof MethodNode method) {
                assertEquals(method.signature().parameters().size(), ((MethodNode) other.get(name)).signature().parameters().size(), name);
                assertEquals(method.signature().parameters().size(), ((MethodNode) library.get(name)).signature().parameters().size(), name);
                assertEquals(method.typeParameters().size(), ((MethodNode) library.get(name)).typeParameters().size(), name);
            }
        }
    }

    private static Set<String> names(CodeModelFile model, String owner, Set<String> originSpecific) {
        Set<String> names = new TreeSet<>(members(model, owner).keySet());
        assertTrue(names.containsAll(originSpecific), () -> owner + " lacks some of " + originSpecific);
        names.removeAll(originSpecific);
        return names;
    }

    private static Map<String, DeclarationNode> members(CodeModelFile model, String owner) {
        Map<String, DeclarationNode> members = new LinkedHashMap<>();
        for (DeclarationNode node : model.nodes()) {
            String id = node.id().value();
            if (id.startsWith("M:" + owner + "#") || id.startsWith("F:" + owner + ".")) members.putIfAbsent(node.name(), node);
        }
        return members;
    }

    private static Set<String> nestedTypeNames(CodeModelFile model, String owner) {
        return model.nodes().stream().filter(TypeNode.class::isInstance)
                .filter(node -> node.id().value().startsWith("T:" + owner + "+") && !node.id().value().substring(owner.length() + 3).contains("+"))
                .map(DeclarationNode::name).collect(Collectors.toCollection(TreeSet::new));
    }
}
