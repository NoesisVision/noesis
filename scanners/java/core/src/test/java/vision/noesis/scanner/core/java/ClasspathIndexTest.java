package vision.noesis.scanner.core.java;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.ClasspathEntry;
import vision.noesis.scanner.model.ArtifactDependency;
import vision.noesis.scanner.model.ArtifactKind;
import vision.noesis.scanner.model.PackageReference;

/** A class file's location names its artifact, whatever characters the path to the jar holds. */
class ClasspathIndexTest {

    @Test
    void aJarUnderAPathWithASpaceIsFound() {
        Path jar = Path.of("/Users/John Doe/.m2/repository/g/lib/1.0/lib-1.0.jar").toAbsolutePath();
        ArtifactDependency library = new ArtifactDependency(JavaIds.libraryArtifact("g:lib", "1.0"), ArtifactKind.LIBRARY, new PackageReference("g:lib", "1.0"));
        ArtifactInput input = new ArtifactInput("p", "app", "1", Path.of("/app"), null, List.of(), Path.of("/app/classes"),
                List.of(new ClasspathEntry(jar, library)), 17, java.nio.charset.StandardCharsets.UTF_8, "jar", null);
        ClasspathIndex index = ClasspathIndex.of(List.of(input), List.of("app"), List.of(input.outputDirectory()));

        URI location = URI.create("jar:" + jar.toUri() + "!/g/lib/Type.class");

        assertEquals(library, index.dependencyOf(location).orElseThrow());
    }
}
