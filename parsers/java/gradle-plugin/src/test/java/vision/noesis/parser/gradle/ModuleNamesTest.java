package vision.noesis.parser.gradle;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.File;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import vision.noesis.parser.core.ArtifactInput;
import vision.noesis.parser.gradle.ModuleInputs.ClasspathElement;

/**
 * Two projects of one build may have the same name ({@code :billing:api}, {@code :shipping:api}); their artifact ids and
 * the references of the projects that depend on them must still tell them apart, and the dependency order must not lose
 * one of them.
 */
class ModuleNamesTest {

    private static final File ROOT = new File("/build");

    @Test
    void sameNamedProjectsAreNamedByTheirPathsAndUniqueOnesKeepTheirNames() {
        List<ModuleInputs> modules = List.of(module(":billing:api"), module(":shipping:api"), module(":app", ":billing:api", ":shipping:api"));

        Map<String, String> names = ModuleInputs.uniqueNames(modules);

        assertEquals(Map.of(":billing:api", "billing:api", ":shipping:api", "shipping:api", ":app", "app"), names);
    }

    @Test
    void aDependentProjectReferencesEachSameNamedSiblingByItsOwnId() {
        ModuleInputs billing = module(":billing:api");
        ModuleInputs shipping = module(":shipping:api");
        ModuleInputs app = module(":app", ":billing:api", ":shipping:api");
        List<ModuleInputs> modules = List.of(billing, shipping, app);
        Map<String, String> names = ModuleInputs.uniqueNames(modules);

        ArtifactInput input = app.toArtifactInput(null, names);

        assertEquals("A:app", input.id().value());
        assertEquals(List.of("A:billing:api", "A:shipping:api"), input.classpath().stream().map(entry -> entry.dependency().id().value()).toList());
        assertEquals("A:billing:api", billing.toArtifactInput(null, names).id().value());
        assertEquals("api", billing.toArtifactInput(null, names).artifactId());
    }

    @Test
    void theDependencyOrderKeepsBothSameNamedProjectsBeforeTheirDependent() {
        ModuleInputs app = module(":app", ":billing:api", ":shipping:api");
        ModuleInputs billing = module(":billing:api");
        ModuleInputs shipping = module(":shipping:api");

        List<ModuleInputs> order = ParseTask.inDependencyOrder(List.of(app, shipping, billing));

        assertEquals(List.of(":billing:api", ":shipping:api", ":app"), order.stream().map(ModuleInputs::getProjectPath).toList());
    }

    private static ModuleInputs module(String path, String... dependencies) {
        String name = path.substring(path.lastIndexOf(':') + 1);
        List<ClasspathElement> classpath = java.util.Arrays.stream(dependencies)
                .map(dependency -> new ClasspathElement(new File(ROOT, dependency.replace(':', '/') + "/build/classes/java/main"), dependency,
                        dependency.substring(dependency.lastIndexOf(':') + 1), null, null))
                .toList();
        return new ModuleInputs(path, "com.acme", name, "1.0", new File(ROOT, path.replace(':', '/')), null, List.of(),
                new File(ROOT, path.replace(':', '/') + "/build/classes/java/main"), classpath, 17, "UTF-8", "jar", null);
    }
}
