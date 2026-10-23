package vision.noesis.scanner.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import vision.noesis.scanner.model.ArtifactDependency;
import vision.noesis.scanner.model.ArtifactKind;
import vision.noesis.scanner.model.ArtifactNode;
import vision.noesis.scanner.model.LanguageBag;
import vision.noesis.scanner.model.NodeId;

/** The artifact node both engines write for a module: what the build says about it, before the stubs add their artifacts. */
public final class ArtifactNodes {

    private ArtifactNodes() {}

    public static ArtifactNode of(ArtifactInput input, ScanSession session, NodeId id, EngineKind engine) {
        Map<String, Object> bag = new LinkedHashMap<>();
        bag.put("java.groupId", input.groupId());
        bag.put("java.packaging", input.packaging());
        if (input.buildFile() != null) bag.put("java.buildFile", session.locations().relativePath(input.buildFile()));
        bag.put("java.engine", engine.id());
        if (input.mainClass() != null) bag.put("java.mainClass", input.mainClass());
        return new ArtifactNode(
                id,
                ArtifactKind.SOURCE,
                input.artifactId(),
                input.version(),
                session.locations().relativePath(input.rootDirectory()),
                "jdk-" + input.release(),
                input.executable(),
                dependenciesOf(input),
                List.of(),
                LanguageBag.of(bag));
    }

    public static List<ArtifactDependency> dependenciesOf(ArtifactInput input) {
        TreeMap<NodeId, ArtifactDependency> dependencies = new TreeMap<>();
        for (ClasspathEntry entry : input.classpath()) dependencies.putIfAbsent(entry.dependency().id(), entry.dependency());
        return new ArrayList<>(dependencies.values());
    }
}
