package vision.noesis.scanner.model;

import java.util.List;

/**
 * @param name   the name references bind to: Maven artifactId, assembly name
 * @param target the platform the declarations were bound against: {@code jdk-21}, {@code net10.0}
 */
public record ArtifactNode(
        NodeId id,
        ArtifactKind kind,
        String name,
        String version,
        String rootDirectory,
        String target,
        boolean executable,
        List<ArtifactDependency> dependencies,
        List<Annotation> annotations,
        LanguageBag languageSpecific) {}
